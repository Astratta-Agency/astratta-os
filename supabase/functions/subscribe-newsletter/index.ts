// Edge Function: subscribe-newsletter
// Public endpoint (no auth) — receives newsletter signups from the blog
// (inline opt-in, footer opt-in, /newsletter landing).
// Upserts into `subscribers` via the service-role client (RLS blocks
// anon writes) scoped to the astratta-agency workspace. Re-subscribing
// with the same email flips status back to 'subscribed'.
//
// Deliberately does NOT send any email here. AWS SES is still in sandbox
// mode (single verified recipient only) as of this writing — outbound
// sending happens later from a separate `notify-subscribers` function once
// SES has production access + domain DKIM verified. This function's only
// job is capture, so signups work today regardless of SES status.

import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BodySchema = z.object({
  workspace_slug: z.string().min(1).max(200),
  email: z.string().trim().email().max(255),
  interest_tag: z.string().trim().max(100).optional().nullable(),
  source_page: z.string().trim().max(100).optional().nullable(),
  recaptcha_token: z.string().trim().min(1).optional().nullable(),
  honeypot: z.string().optional().nullable(),
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// reCAPTCHA v3 verification. Only enforced when RECAPTCHA_SECRET_KEY is
// configured — same secret already used by capture-lead.
async function verifyRecaptcha(token: string | null | undefined): Promise<{ ok: boolean; reason?: string }> {
  const secret = Deno.env.get("RECAPTCHA_SECRET_KEY");
  if (!secret) return { ok: true };
  if (!token) return { ok: false, reason: "missing_token" };

  const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ secret, response: token }),
  });
  const result = await res.json().catch(() => null);
  if (!result?.success) return { ok: false, reason: "verify_failed" };
  if (typeof result.score === "number" && result.score < 0.5) {
    return { ok: false, reason: `low_score_${result.score}` };
  }
  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const raw = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return json({ success: false, error: "invalid_body", details: parsed.error.flatten() }, 400);
    }
    const data = parsed.data;

    if (data.honeypot && data.honeypot.trim().length > 0) {
      return json({ success: true });
    }

    const rc = await verifyRecaptcha(data.recaptcha_token);
    if (!rc.ok) {
      console.warn("[subscribe-newsletter] recaptcha rejected", rc.reason);
      return json({ success: false, error: "recaptcha_failed" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: workspace, error: wsErr } = await admin
      .from("workspaces")
      .select("id")
      .eq("slug", data.workspace_slug)
      .maybeSingle();
    if (wsErr) return json({ success: false, error: "workspace_lookup_failed", detail: wsErr.message }, 500);
    if (!workspace) return json({ success: false, error: "workspace_not_found" }, 404);

    const { error: upsertErr } = await admin
      .from("subscribers")
      .upsert(
        {
          workspace_id: workspace.id,
          email: data.email.toLowerCase(),
          interest_tag: data.interest_tag || null,
          source_page: data.source_page || null,
          status: "subscribed",
          unsubscribed_at: null,
        },
        { onConflict: "workspace_id,email" },
      );

    if (upsertErr) {
      console.error("[subscribe-newsletter] upsert failed", upsertErr);
      return json({ success: false, error: "insert_failed", detail: upsertErr.message }, 500);
    }

    return json({ success: true });
  } catch (e) {
    console.error("[subscribe-newsletter] unexpected", e);
    return json({ success: false, error: "unexpected", detail: String(e) }, 500);
  }
});
