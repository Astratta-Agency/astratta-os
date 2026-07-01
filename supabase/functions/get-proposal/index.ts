// Edge Function: get-proposal
// Public endpoint — fetches a proposal by its public_token, records a
// `viewed` event, and if it's the first view updates first_viewed_at and
// (if status was draft/sent) promotes the status to `viewed`.

import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BodySchema = z.object({ token: z.string().uuid() });

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
    const { token } = parsed.data;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: proposal, error: pErr } = await admin
      .from("proposals")
      .select("*")
      .eq("public_token", token)
      .maybeSingle();
    if (pErr) return json({ error: pErr.message }, 500);
    if (!proposal) return json({ error: "Not found" }, 404);

    let lead: { company_name: string; contact_name: string } | null = null;
    if (proposal.lead_id) {
      const { data: leadRow } = await admin
        .from("leads")
        .select("company_name, contact_name")
        .eq("id", proposal.lead_id)
        .maybeSingle();
      lead = (leadRow as any) ?? null;
    }

    const { data: signature } = await admin
      .from("proposal_signatures")
      .select("*")
      .eq("proposal_id", proposal.id)
      .maybeSingle();

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
      req.headers.get("cf-connecting-ip") ??
      null;
    const ua = req.headers.get("user-agent") ?? null;

    await admin.from("proposal_events").insert({
      proposal_id: proposal.id,
      event_type: "viewed",
      ip_address: ip,
      user_agent: ua,
    });

    const patch: Record<string, unknown> = {};
    if (!proposal.first_viewed_at) patch.first_viewed_at = new Date().toISOString();
    if (proposal.status === "draft" || proposal.status === "sent") patch.status = "viewed";
    if (Object.keys(patch).length > 0) {
      await admin.from("proposals").update(patch).eq("id", proposal.id);
      Object.assign(proposal, patch);
    }

    return json({ proposal, lead, signature: signature ?? null });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
