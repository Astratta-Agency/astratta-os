// Edge Function: ping
// 10-line health-check. Returns user_id if a valid Bearer token is sent.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let userId: string | null = null;
  const authHeader = req.headers.get("Authorization") ?? "";
  if (authHeader.startsWith("Bearer ")) {
    try {
      const client = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const token = authHeader.replace("Bearer ", "");
      const { data } = await client.auth.getClaims(token);
      userId = (data?.claims?.sub as string) ?? null;
    } catch {
      /* ignore */
    }
  }

  return new Response(
    JSON.stringify({ ok: true, ts: new Date().toISOString(), user_id: userId }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
  );
});
