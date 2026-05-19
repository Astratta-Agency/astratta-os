import { createClient } from "npm:@supabase/supabase-js@2";

type ValidateResult =
  | { user: { id: string }; authedClient: ReturnType<typeof createClient> }
  | { errorResponse: Response };

export async function validateRequest(
  req: Request,
  corsHeaders: Record<string, string>,
): Promise<ValidateResult> {
  if (req.method === "OPTIONS") {
    return { errorResponse: new Response("ok", { headers: corsHeaders }) };
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return {
      errorResponse: new Response(
        JSON.stringify({ error: "missing_token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      ),
    };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const authedClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsErr } = await authedClient.auth.getClaims(token);
  if (claimsErr || !claimsData?.claims?.sub) {
    console.error("[validateRequest] invalid_token", claimsErr);
    return {
      errorResponse: new Response(
        JSON.stringify({ error: "invalid_token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      ),
    };
  }

  return {
    user: { id: claimsData.claims.sub as string },
    authedClient,
  };
}
