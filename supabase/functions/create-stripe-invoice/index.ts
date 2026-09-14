// Edge Function: create-stripe-invoice
// Authenticated (workspace member with write access on the invoice).
// Given an invoice_id, this:
//   1. Reads the invoice + items + client through an RLS-scoped client
//      (proves the caller is actually allowed to write this invoice).
//   2. Creates or reuses a Stripe Customer for the client.
//   3. Pushes invoice items to Stripe, finalizes the Stripe Invoice, and
//      emails it to the client via Stripe (collection_method: send_invoice).
//   4. Syncs stripe_invoice_id / hosted_invoice_url / pdf back onto our row
//      and flips status -> 'sent' (via service role client).
//
// Requires secrets (Project Settings -> Edge Functions -> Secrets):
//   STRIPE_SECRET_KEY

import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17.4.0";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BodySchema = z.object({ invoice_id: z.string().uuid() });

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ success: false, error: "missing_auth" }, 401);

    const raw = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return json({ success: false, error: "invalid_body", details: parsed.error.flatten() }, 400);
    }
    const { invoice_id } = parsed.data;

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      console.error("[create-stripe-invoice] STRIPE_SECRET_KEY not configured");
      return json({ success: false, error: "stripe_not_configured" }, 500);
    }
    const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // RLS-scoped client — proves the caller can write this invoice.
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: invoice, error: invErr } = await userClient
      .from("invoices")
      .select("*, invoice_items(*), clients(id, name, stripe_customer_id)")
      .eq("id", invoice_id)
      .maybeSingle();

    if (invErr) {
      console.error("[create-stripe-invoice] invoice fetch failed", invErr);
      return json({ success: false, error: "invoice_fetch_failed", detail: invErr.message }, 500);
    }
    if (!invoice) return json({ success: false, error: "invoice_not_found_or_forbidden" }, 404);
    if (!invoice.invoice_items || invoice.invoice_items.length === 0) {
      return json({ success: false, error: "invoice_has_no_items" }, 400);
    }
    if (invoice.status === "paid" || invoice.status === "void") {
      return json({ success: false, error: "invoice_not_sendable", detail: `status is ${invoice.status}` }, 400);
    }

    const client = invoice.clients as { id: string; name: string; stripe_customer_id: string | null };

    // Primary contact email for the Stripe customer.
    const { data: contact } = await admin
      .from("client_contacts")
      .select("email, name")
      .eq("client_id", client.id)
      .eq("is_primary", true)
      .maybeSingle();

    if (!contact?.email) {
      return json({ success: false, error: "client_missing_billing_email", detail: "Add a primary contact with an email before sending a Stripe invoice." }, 400);
    }

    let stripeCustomerId = client.stripe_customer_id;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        name: client.name,
        email: contact.email,
        metadata: { astratta_client_id: client.id },
      });
      stripeCustomerId = customer.id;
      await admin.from("clients").update({ stripe_customer_id: stripeCustomerId }).eq("id", client.id);
    }

    const daysUntilDue = invoice.due_date
      ? Math.max(1, Math.ceil((new Date(invoice.due_date).getTime() - Date.now()) / 86400000))
      : 15;

    const stripeInvoice = await stripe.invoices.create({
      customer: stripeCustomerId,
      collection_method: "send_invoice",
      days_until_due: daysUntilDue,
      currency: invoice.currency || "usd",
      description: invoice.notes || undefined,
      footer: invoice.terms || undefined,
      metadata: { astratta_invoice_id: invoice.id, astratta_invoice_number: invoice.invoice_number },
      auto_advance: false,
    });

    for (const item of invoice.invoice_items as Array<{ description: string; quantity: number; unit_price: number }>) {
      await stripe.invoiceItems.create({
        customer: stripeCustomerId,
        invoice: stripeInvoice.id,
        currency: invoice.currency || "usd",
        description: item.description,
        quantity: item.quantity,
        unit_amount_decimal: String(Math.round(item.unit_price * 100)),
      });
    }

    if (invoice.tax_rate && Number(invoice.tax_rate) > 0) {
      const taxRate = await stripe.taxRates.create({
        display_name: "Tax",
        percentage: Number(invoice.tax_rate),
        inclusive: false,
      });
      await stripe.invoices.update(stripeInvoice.id, { default_tax_rates: [taxRate.id] });
    }

    const finalized = await stripe.invoices.finalizeInvoice(stripeInvoice.id);
    const sent = await stripe.invoices.sendInvoice(stripeInvoice.id);

    const { error: updErr } = await admin
      .from("invoices")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        stripe_customer_id: stripeCustomerId,
        stripe_invoice_id: sent.id,
        stripe_hosted_invoice_url: sent.hosted_invoice_url,
        stripe_invoice_pdf: sent.invoice_pdf,
      })
      .eq("id", invoice.id);

    if (updErr) {
      console.error("[create-stripe-invoice] failed to sync invoice row", updErr);
      return json({
        success: true,
        warning: "stripe_invoice_sent_but_sync_failed",
        hosted_invoice_url: sent.hosted_invoice_url,
        invoice_pdf: sent.invoice_pdf,
      });
    }

    return json({
      success: true,
      hosted_invoice_url: sent.hosted_invoice_url,
      invoice_pdf: sent.invoice_pdf,
      stripe_invoice_id: sent.id,
    });
  } catch (e) {
    console.error("[create-stripe-invoice] unexpected", e);
    return json({ success: false, error: "unexpected", detail: String(e) }, 500);
  }
});
