// Edge Function: meta-data-deletion
// Public endpoint (no Supabase auth).
//   POST: Meta's Data Deletion Request Callback, authenticated via the
//         signed_request signature. Configure this URL in the Meta app under
//         Settings -> Basic -> Data Deletion Request URL.
//   GET ?code=: status lookup for the public /eliminacion-datos page. The code
//         is an unguessable UUID and the response contains no account data.
//
// Requires secrets (Project Settings -> Edge Functions -> Secrets):
//   META_APP_SECRET

import { createClient } from "npm:@supabase/supabase-js@2";
import { parseMetaSignedRequest } from "../_shared/meta-signed-request.ts";

const STATUS_PAGE_URL = "https://app.astrattaagency.com/eliminacion-datos";
const META_PLATFORMS = ["facebook_page", "instagram_business"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  if (req.method === "GET") {
    const code = new URL(req.url).searchParams.get("code") ?? "";
    if (!UUID_RE.test(code)) return json({ error: "not_found" }, 404);

    const { data, error } = await admin
      .from("social_data_deletion_requests")
      .select("status")
      .eq("confirmation_code", code)
      .maybeSingle();
    if (error) {
      console.error("[meta-data-deletion] status lookup failed", error);
      return json({ error: "lookup_failed" }, 500);
    }
    if (!data) return json({ error: "not_found" }, 404);
    return json({ status: data.status });
  }

  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const appSecret = Deno.env.get("META_APP_SECRET");
  if (!appSecret) {
    console.error("[meta-data-deletion] missing META_APP_SECRET");
    return json({ error: "meta_not_configured" }, 500);
  }

  const signedRequest = new URLSearchParams(await req.text()).get("signed_request") ?? "";
  const payload = await parseMetaSignedRequest(signedRequest, appSecret);
  if (!payload) return json({ error: "invalid_signature" }, 400);

  const { data: request, error: insertError } = await admin
    .from("social_data_deletion_requests")
    .insert({ platform: "meta" })
    .select("confirmation_code")
    .single();
  if (insertError) {
    console.error("[meta-data-deletion] could not record request", insertError);
    return json({ error: "request_failed" }, 500);
  }
  const code = request.confirmation_code;

  // Metrics hang off social_connections with on delete cascade, and a trigger
  // removes the tokens from vault.
  const { error: deleteError } = await admin
    .from("social_connections")
    .delete()
    .in("platform", META_PLATFORMS)
    .eq("external_user_id", payload.user_id);

  if (deleteError) {
    console.error("[meta-data-deletion] delete failed", code, deleteError);
    await admin
      .from("social_data_deletion_requests")
      .update({ status: "failed" })
      .eq("confirmation_code", code);
    return json({ error: "delete_failed" }, 500);
  }

  const { error: updateError } = await admin
    .from("social_data_deletion_requests")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("confirmation_code", code);
  if (updateError) console.error("[meta-data-deletion] status update failed", code, updateError);

  return json({ url: `${STATUS_PAGE_URL}?code=${code}`, confirmation_code: code });
});
