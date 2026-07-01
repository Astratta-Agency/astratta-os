// Edge Function: capture-lead
// Public endpoint (no auth) — receives lead submissions from the embedded
// form on astrattaagency.com and inserts them into `leads` via the admin
// (service role) client. RLS on `leads` does NOT allow anon inserts, so
// this function is the only way public visitors reach the table.

import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BodySchema = z.object({
  workspace_slug: z.string().min(1).max(200),
  company_name: z.string().trim().min(1).max(255),
  contact_name: z.string().trim().min(1).max(255),
  contact_email: z.string().email().max(255),
  contact_phone: z.string().max(50).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  utm_source: z.string().max(255).optional().nullable(),
  utm_medium: z.string().max(255).optional().nullable(),
  utm_campaign: z.string().max(255).optional().nullable(),
  utm_content: z.string().max(255).optional().nullable(),
  utm_term: z.string().max(255).optional().nullable(),
  honeypot: z.string().optional().nullable(),
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function deriveSource(utmSource: string | null | undefined): string {
  if (!utmSource) return "organic";
  const s = utmSource.toLowerCase();
  if (s.includes("google")) return "google_ads";
  if (s.includes("facebook") || s.includes("meta") || s.includes("instagram")) return "meta_ads";
  return "other";
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

    // Anti-spam honeypot — silently succeed.
    if (data.honeypot && data.honeypot.trim().length > 0) {
      return json({ success: true });
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

    const source = deriveSource(data.utm_source);

    const { error: insErr } = await admin.from("leads").insert({
      workspace_id: workspace.id,
      company_name: data.company_name,
      contact_name: data.contact_name,
      contact_email: data.contact_email,
      contact_phone: data.contact_phone || null,
      notes: data.notes || null,
      source,
      utm_source: data.utm_source || null,
      utm_medium: data.utm_medium || null,
      utm_campaign: data.utm_campaign || null,
      utm_content: data.utm_content || null,
      utm_term: data.utm_term || null,
      stage: "lead",
      probability: 10,
    });

    if (insErr) {
      console.error("[capture-lead] insert failed", insErr);
      return json({ success: false, error: "insert_failed", detail: insErr.message }, 500);
    }

    return json({ success: true });
  } catch (e) {
    console.error("[capture-lead] unexpected", e);
    return json({ success: false, error: "unexpected", detail: String(e) }, 500);
  }
});
