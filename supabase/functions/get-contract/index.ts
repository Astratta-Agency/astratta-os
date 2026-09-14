// Edge Function: get-contract
// Public endpoint — fetches a contract by its public_token, records a
// `viewed` event. Contracts have no "viewed" status in the state machine,
// so unlike get-proposal this does not promote status on view.

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

    const { data: contract, error: cErr } = await admin
      .from("contracts")
      .select("*")
      .eq("public_token", token)
      .maybeSingle();
    if (cErr) return json({ error: cErr.message }, 500);
    if (!contract) return json({ error: "Not found" }, 404);

    let client: { name: string } | null = null;
    if (contract.client_id) {
      const { data: clientRow } = await admin
        .from("clients")
        .select("name")
        .eq("id", contract.client_id)
        .maybeSingle();
      client = (clientRow as any) ?? null;
    }

    const { data: signatures } = await admin
      .from("contract_signatures")
      .select("*")
      .eq("contract_id", contract.id)
      .order("signed_at", { ascending: true });

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
      req.headers.get("cf-connecting-ip") ??
      null;
    const ua = req.headers.get("user-agent") ?? null;

    await admin.from("contract_events").insert({
      contract_id: contract.id,
      event_type: "viewed",
      ip_address: ip,
      user_agent: ua,
    });

    return json({ contract, client, signatures: signatures ?? [] });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
