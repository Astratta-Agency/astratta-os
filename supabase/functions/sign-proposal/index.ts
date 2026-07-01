// Edge Function: sign-proposal
// Public endpoint — records a client-side e-signature for a proposal.

import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BodySchema = z.object({
  token: z.string().uuid(),
  signer_name: z.string().trim().min(1).max(255),
  signer_email: z.string().email().max(255).optional().nullable(),
  signature_data_url: z.string().min(20).max(2_000_000),
  consent: z.boolean(),
});

const CONSENT_TEXT =
  "Acepto los términos y confirmo mi firma electrónica de esta propuesta.";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const raw = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) return json({ error: "Bad request" }, 400);
    const { token, signer_name, signer_email, signature_data_url, consent } = parsed.data;

    if (consent !== true) return json({ error: "Consent required" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: proposal, error: pErr } = await admin
      .from("proposals")
      .select("id, status")
      .eq("public_token", token)
      .maybeSingle();
    if (pErr) return json({ error: pErr.message }, 500);
    if (!proposal) return json({ error: "Not found" }, 404);
    if (proposal.status === "signed") return json({ error: "Already signed" }, 409);

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
      req.headers.get("cf-connecting-ip") ??
      null;
    const ua = req.headers.get("user-agent") ?? null;
    const now = new Date().toISOString();

    const { error: sigErr } = await admin.from("proposal_signatures").insert({
      proposal_id: proposal.id,
      signer_name,
      signer_email: signer_email ?? null,
      signature_data_url,
      consent_text: CONSENT_TEXT,
      ip_address: ip,
      user_agent: ua,
      signed_at: now,
    });
    if (sigErr) return json({ error: sigErr.message }, 500);

    const { error: upErr } = await admin
      .from("proposals")
      .update({ status: "signed", signed_at: now })
      .eq("id", proposal.id);
    if (upErr) return json({ error: upErr.message }, 500);

    return json({ success: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
