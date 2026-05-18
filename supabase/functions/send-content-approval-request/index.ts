// Edge Function: send-content-approval-request
// Notifies all active client_admin users of a client when a social_posts row
// enters status='pending_approval'. Sends one branded SES v2 email per
// recipient (privacy-preserving) and writes an audit row to
// content_approval_history. Triggered either manually from the UI (JWT auth)
// or automatically by a DB trigger (x-internal-secret header).
//
// Always returns HTTP 200 so callers can fall back to manual copy-link UX.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";
import { escapeHtml, sendSesEmail } from "../_shared/ses.ts";

const BodySchema = z.object({
  post_id: z.string().uuid(),
  source: z.enum(["manual", "trigger"]).default("manual"),
  force: z.boolean().default(false),
  message: z.string().max(300).nullable().optional(),
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// ----------------- HTML template -----------------
function formatScheduledEs(iso: string | null): string {
  if (!iso) return "Sin fecha programada";
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("es-AR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return iso;
  }
}

function renderEmail(args: {
  clientName: string;
  primaryColor: string;
  logoUrl: string | null;
  post: {
    title: string;
    type: string;
    preview_url: string | null;
    caption: string | null;
    scheduled_for: string | null;
  };
  portalUrl: string;
}): { html: string; text: string; subject: string } {
  const { clientName, primaryColor, logoUrl, post, portalUrl } = args;
  const safeClient = escapeHtml(clientName);
  const safeTitle = escapeHtml(post.title);
  const safeType = escapeHtml(post.type.replace(/_/g, " "));
  const captionPreview = post.caption
    ? escapeHtml(post.caption.length > 200 ? post.caption.slice(0, 200) + "…" : post.caption)
    : null;
  const scheduledLabel = escapeHtml(formatScheduledEs(post.scheduled_for));
  const subject = `Nuevo contenido para aprobar — ${clientName}`;

  const logoBlock = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="${safeClient} logo" height="48" style="display:block;margin:0 auto 24px;max-height:48px;" />`
    : "";

  const previewBlock = post.preview_url
    ? `<img src="${escapeHtml(post.preview_url)}" alt="${safeTitle}" style="display:block;width:100%;max-width:480px;border-radius:8px;margin:0 auto 20px;" />`
    : "";

  const captionBlock = captionPreview
    ? `<p style="margin:16px 0 0;padding:12px 16px;background:#f8fafc;border-radius:6px;font-size:14px;line-height:1.6;color:#475569;white-space:pre-wrap;">${captionPreview}</p>`
    : "";

  const html = `<!doctype html>
<html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width" /></head>
<body style="margin:0;padding:0;background:#f6f7fb;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f6f7fb;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
        <tr><td style="height:60px;background:${primaryColor};"></td></tr>
        <tr><td style="padding:32px 40px;">
          ${logoBlock}
          <h1 style="margin:0 0 8px;font-size:22px;line-height:1.3;text-align:center;color:#0f172a;">Nuevo contenido para aprobar</h1>
          <p style="margin:0 0 24px;font-size:14px;color:#64748b;text-align:center;">Tu equipo en Astratta dejó listo un contenido para ${safeClient}.</p>
          ${previewBlock}
          <div style="border:1px solid #e2e8f0;border-radius:8px;padding:16px 20px;margin:0 0 8px;">
            <div style="display:inline-block;padding:2px 10px;border-radius:999px;background:${primaryColor};color:#ffffff;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.4px;margin-bottom:8px;">${safeType}</div>
            <h2 style="margin:4px 0 8px;font-size:17px;color:#0f172a;">${safeTitle}</h2>
            <p style="margin:0;font-size:13px;color:#64748b;">📅 ${scheduledLabel}</p>
            ${captionBlock}
          </div>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:28px auto;">
            <tr><td style="border-radius:8px;background:${primaryColor};">
              <a href="${escapeHtml(portalUrl)}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">Revisar y aprobar</a>
            </td></tr>
          </table>
          <p style="margin:16px 0 0;font-size:13px;color:#64748b;text-align:center;">También podés solicitar cambios o rechazar el contenido desde el portal.</p>
        </td></tr>
        <tr><td style="padding:20px 40px 32px;border-top:1px solid #e2e8f0;text-align:center;font-size:12px;color:#94a3b8;">
          Powered by <strong style="color:#475569;">Astratta Agency</strong> · astrattaagency.com
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const text = [
    `Nuevo contenido para aprobar — ${clientName}`,
    "",
    `Título: ${post.title}`,
    `Tipo: ${post.type}`,
    `Programado: ${formatScheduledEs(post.scheduled_for)}`,
    post.caption ? `\nCopy:\n${post.caption.slice(0, 200)}${post.caption.length > 200 ? "…" : ""}` : "",
    "",
    `Revisar y aprobar: ${portalUrl}`,
    "",
    "— Astratta Agency · astrattaagency.com",
  ].join("\n");

  return { html, text, subject };
}

// ----------------- Handler -----------------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const internalSecret = Deno.env.get("INTERNAL_TRIGGER_SECRET") ?? "";

    // --- Parse body first (needed to determine source) ---
    const raw = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return json({ error: "invalid_body", details: parsed.error.flatten() }, 400);
    }
    const { post_id, source, force, message } = parsed.data;

    // --- Auth: either internal-secret or JWT (verify in code per signing-keys system) ---
    let callerUserId: string | null = null;
    if (source === "trigger") {
      const provided = req.headers.get("x-internal-secret") ?? "";
      if (!internalSecret || provided !== internalSecret) {
        return json({ error: "invalid_internal_secret" }, 401);
      }
    } else {
      const authHeader = req.headers.get("Authorization") ?? "";
      if (!authHeader.startsWith("Bearer ")) return json({ error: "missing_token" }, 401);
      const authClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const token = authHeader.replace("Bearer ", "");
      const { data: claimsData, error: claimsErr } = await authClient.auth.getClaims(token);
      if (claimsErr || !claimsData?.claims?.sub) {
        console.error("[send-content-approval-request] invalid_token", claimsErr);
        return json({ error: "invalid_token" }, 401);
      }
      callerUserId = claimsData.claims.sub as string;
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // --- Load post ---
    const { data: post, error: postErr } = await admin
      .from("social_posts")
      .select("id, client_id, workspace_id, title, type, preview_url, caption, scheduled_for, status")
      .eq("id", post_id)
      .maybeSingle();
    if (postErr) return json({ error: "post_lookup_failed", detail: postErr.message }, 500);
    if (!post) return json({ error: "post_not_found" }, 404);

    // --- Manual source: enforce workspace membership ---
    if (source === "manual" && callerUserId) {
      const { data: membership } = await admin
        .from("workspace_members")
        .select("user_id")
        .eq("workspace_id", post.workspace_id)
        .eq("user_id", callerUserId)
        .maybeSingle();
      if (!membership) return json({ error: "forbidden" }, 403);
    }

    // --- Status transition: move into pending_approval atomically with send ---
    const TRANSITIONABLE = new Set([
      "draft",
      "pending_internal_review",
      "rejected",
      "changes_requested",
    ]);
    if (post.status !== "pending_approval") {
      if (!TRANSITIONABLE.has(post.status)) {
        return json(
          { emailed: false, error: "invalid_status_transition", status: post.status },
          200,
        );
      }
      const { error: transErr } = await admin
        .from("social_posts")
        .update({ status: "pending_approval" })
        .eq("id", post.id);
      if (transErr) {
        return json({ error: "status_transition_failed", detail: transErr.message }, 500);
      }
      post.status = "pending_approval";
    }

    // --- Load client ---
    const { data: client, error: clientErr } = await admin
      .from("clients")
      .select("id, name, slug, brand_primary_color, brand_secondary_color, logo_url")
      .eq("id", post.client_id)
      .maybeSingle();
    if (clientErr) return json({ error: "client_lookup_failed", detail: clientErr.message }, 500);
    if (!client) return json({ error: "client_not_found" }, 404);

    // --- Idempotency: skip if a sent_for_approval row exists in last 4 hours ---
    if (!force) {
      const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
      const { data: recent } = await admin
        .from("content_approval_history")
        .select("id, created_at")
        .eq("post_id", post_id)
        .in("action", ["sent_for_approval", "resent"])
        .gte("created_at", fourHoursAgo)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (recent) {
        return json({
          emailed: true,
          sent: 0,
          failed: 0,
          skipped: true,
          reason: "duplicate_within_4h_window",
          last_sent_at: recent.created_at,
        });
      }
    }

    // --- Resolve recipients: active client_admin users ---
    const { data: clientUsers, error: cuErr } = await admin
      .from("client_users")
      .select("user_id, invited_email")
      .eq("client_id", post.client_id)
      .eq("role", "client_admin")
      .eq("status", "active");
    if (cuErr) return json({ error: "client_users_lookup_failed", detail: cuErr.message }, 500);

    // Fetch auth.users emails for user_id-based rows
    const userIds = (clientUsers ?? []).map((cu) => cu.user_id).filter(Boolean) as string[];
    const userEmails = new Map<string, string>();
    if (userIds.length > 0) {
      // listUsers paginates; for typical admin counts (<10) one page is fine.
      const { data: usersPage } = await admin.auth.admin.listUsers({ perPage: 200, page: 1 });
      for (const u of usersPage?.users ?? []) {
        if (u.email && userIds.includes(u.id)) userEmails.set(u.id, u.email);
      }
    }

    const recipients = Array.from(
      new Set(
        (clientUsers ?? [])
          .map((cu) => (cu.user_id ? userEmails.get(cu.user_id) : cu.invited_email))
          .filter((e): e is string => !!e && e.includes("@"))
          .map((e) => e.toLowerCase().trim()),
      ),
    );

    if (recipients.length === 0) {
      return json({
        emailed: false,
        error: "no_recipients",
        recipient_count: 0,
      });
    }

    // --- Build portal URL + email ---
    const originHeader = req.headers.get("origin");
    const siteBase =
      Deno.env.get("SITE_URL") ?? (originHeader ? new URL(originHeader).origin : "");
    const portalUrl = `${siteBase.replace(/\/$/, "")}/portal/${client.slug}/aprobaciones/${post.id}`;
    const primaryColor = client.brand_primary_color || "#5140f2";

    const { html, text, subject } = renderEmail({
      clientName: client.name,
      primaryColor,
      logoUrl: client.logo_url,
      post: {
        title: post.title,
        type: post.type,
        preview_url: post.preview_url,
        caption: post.caption,
        scheduled_for: post.scheduled_for,
      },
      portalUrl,
    });

    // --- SES credentials ---
    const accessKeyId = Deno.env.get("AWS_ACCESS_KEY_ID");
    const secretAccessKey = Deno.env.get("AWS_SECRET_ACCESS_KEY");
    const region = Deno.env.get("AWS_REGION") ?? "us-east-1";
    const fromEmail = Deno.env.get("FROM_EMAIL") ?? "invites@astrattaagency.com";
    const replyTo = Deno.env.get("REPLY_TO_EMAIL") ?? "hello@astrattaagency.com";

    if (!accessKeyId || !secretAccessKey) {
      console.error("[send-content-approval-request] missing AWS credentials");
      return json({ emailed: false, error: "aws_credentials_missing" }, 200);
    }

    // --- Send one email per recipient (privacy) in parallel ---
    const sendResults = await Promise.all(
      recipients.map(async (email) => {
        const res = await sendSesEmail({
          region,
          accessKeyId,
          secretAccessKey,
          fromEmail: `Astratta <${fromEmail}>`,
          replyTo,
          toAddresses: [email],
          subject,
          html,
          text,
        });
        return { email, ...res };
      }),
    );

    const sent = sendResults.filter((r) => r.ok).length;
    const failed = sendResults.length - sent;

    const sesMessageIds: Record<string, string> = {};
    for (const r of sendResults) {
      sesMessageIds[r.email] = r.ok ? (r.messageId ?? "ok") : `error: ${r.error ?? r.status}`;
    }

    // --- Audit log ---
    await admin.from("content_approval_history").insert({
      post_id: post.id,
      client_id: post.client_id,
      action: force ? "resent" : "sent_for_approval",
      actor_user_id: callerUserId,
      recipient_emails: recipients,
      ses_message_ids: sesMessageIds,
      metadata: {
        source,
        force,
        message: message ?? null,
        scheduled_for: post.scheduled_for,
        brand_color_used: primaryColor,
        sent,
        failed,
      },
    });

    // --- Update last_approval_sent_at ---
    await admin
      .from("social_posts")
      .update({ last_approval_sent_at: new Date().toISOString() })
      .eq("id", post.id);

    return json({
      emailed: sent > 0,
      sent,
      failed,
      skipped: false,
      portalUrl,
      recipientEmails: recipients,
      results: sendResults.map((r) => ({
        email: r.email,
        messageId: r.ok ? r.messageId : null,
        error: r.ok ? undefined : (r.error ?? `ses_${r.status}`),
      })),
    });
  } catch (e) {
    console.error("[send-content-approval-request] unexpected", e);
    return json({ emailed: false, error: "unexpected", detail: String(e) }, 200);
  }
});
