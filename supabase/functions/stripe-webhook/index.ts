// Edge Function: stripe-webhook
// Public endpoint (no Supabase auth — authenticated via Stripe-Signature
// instead). Configure this URL as a webhook endpoint in the Stripe
// Dashboard listening for: invoice.paid, invoice.payment_failed,
// invoice.voided, invoice.marked_uncollectible.
//
// Requires secrets (Project Settings -> Edge Functions -> Secrets):
//   STRIPE_SECRET_KEY
//   STRIPE_WEBHOOK_SECRET  (from the Stripe webhook endpoint's "Signing secret")

import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17.4.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "stripe-signature, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!stripeKey || !webhookSecret) {
    console.error("[stripe-webhook] missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET");
    return json({ error: "stripe_not_configured" }, 500);
  }

  const stripe = new Stripe(stripeKey, {
    apiVersion: "2024-06-20",
    httpClient: Stripe.createFetchHttpClient(),
  });
  const cryptoProvider = Stripe.createSubtleCryptoProvider();

  const signature = req.headers.get("Stripe-Signature");
  const body = await req.text();

  let event: Stripe.Event;
  try {
    if (!signature) throw new Error("missing_signature");
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret, undefined, cryptoProvider);
  } catch (err) {
    console.error("[stripe-webhook] signature verification failed", err);
    return json({ error: "invalid_signature" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  try {
    switch (event.type) {
      case "invoice.paid": {
        const obj = event.data.object as Stripe.Invoice;
        const { data: invoice } = await admin
          .from("invoices")
          .select("id, workspace_id, client_id, currency")
          .eq("stripe_invoice_id", obj.id)
          .maybeSingle();
        if (!invoice) {
          console.warn("[stripe-webhook] invoice.paid for unknown stripe_invoice_id", obj.id);
          break;
        }

        const paymentIntentId = typeof obj.payment_intent === "string" ? obj.payment_intent : obj.payment_intent?.id ?? null;

        // Idempotency: Stripe may redeliver the same event.
        if (paymentIntentId) {
          const { data: existing } = await admin
            .from("payments")
            .select("id")
            .eq("stripe_payment_intent_id", paymentIntentId)
            .maybeSingle();
          if (existing) break;
        }

        await admin.from("payments").insert({
          workspace_id: invoice.workspace_id,
          invoice_id: invoice.id,
          client_id: invoice.client_id,
          amount: (obj.amount_paid ?? 0) / 100,
          currency: obj.currency || invoice.currency || "usd",
          method: "stripe",
          status: "succeeded",
          stripe_payment_intent_id: paymentIntentId,
          receipt_url: obj.hosted_invoice_url ?? null,
        });
        break;
      }

      case "invoice.payment_failed": {
        const obj = event.data.object as Stripe.Invoice;
        const { data: invoice } = await admin
          .from("invoices")
          .select("id, workspace_id, client_id, invoice_number")
          .eq("stripe_invoice_id", obj.id)
          .maybeSingle();
        if (!invoice) break;

        await admin.from("payments").insert({
          workspace_id: invoice.workspace_id,
          invoice_id: invoice.id,
          client_id: invoice.client_id,
          amount: (obj.amount_due ?? 0) / 100,
          currency: obj.currency || "usd",
          method: "stripe",
          status: "failed",
        });

        const { data: members } = await admin
          .from("workspace_members")
          .select("user_id")
          .eq("workspace_id", invoice.workspace_id)
          .eq("status", "active")
          .in("role", ["owner", "team_member"]);

        if (members?.length) {
          await admin.from("notifications").insert(
            members.map((m) => ({
              workspace_id: invoice.workspace_id,
              recipient_user_id: m.user_id,
              type: "invoice_payment_failed",
              title: `Pago fallido: ${invoice.invoice_number}`,
              body: "El cobro automático de Stripe falló. Revisa el método de pago del cliente.",
              link: `/app/finanzas?invoice=${invoice.id}`,
            })),
          );
        }
        break;
      }

      case "invoice.voided":
      case "invoice.marked_uncollectible": {
        const obj = event.data.object as Stripe.Invoice;
        await admin
          .from("invoices")
          .update({ status: "void", void_at: new Date().toISOString() })
          .eq("stripe_invoice_id", obj.id);
        break;
      }

      default:
        // Ignore other event types.
        break;
    }
  } catch (e) {
    console.error("[stripe-webhook] handler error", event.type, e);
    // Still return 200 so Stripe doesn't hammer retries for a bug on our side
    // once we've at least logged it — but surface 500 for signature/setup issues.
    return json({ received: true, error: "handler_error" }, 200);
  }

  return json({ received: true });
});
