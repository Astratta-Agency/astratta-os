// Edge Function: send-notification-emails
// Delivers the email copies of in-app notifications. Rows are queued in
// public.notification_email_outbox by the apply_notification_preferences()
// trigger when the recipient turned on "Email" for that event in
// Configuración → Notificaciones. pg_cron calls this function every minute
// while there are pending rows.
//
// Auth: X-Sync-Secret header must match the SYNC_CRON_SECRET edge secret (the
// same internal cron secret used by google-calendar-sync-cycle).

import { createClient } from "npm:@supabase/supabase-js@2";
import { escapeHtml, sendResendEmail } from "../_shared/resend.ts";

const PROD_ORIGIN = "https://app.astrattaagency.com";
const BRAND_COLOR = "#0f172a";
const BATCH_SIZE = 50;

type OutboxRow = {
  id: string;
  workspace_id: string;
  recipient_user_id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  attempts: number;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

function buildNotificationUrl(link: string | null): string {
  if (!link) return `${PROD_ORIGIN}/app`;
  if (/^https?:\/\//i.test(link)) return link;
  return `${PROD_ORIGIN}${link.startsWith("/") ? "" : "/"}${link}`;
}

function renderEmail(args: {
  workspaceName: string;
  title: string;
  body: string | null;
  url: string;
}): { html: string; text: string; subject: string } {
  const { workspaceName, title, body, url } = args;
  const safeTitle = escapeHtml(title);
  const safeBody = body ? escapeHtml(body).replace(/\n/g, "<br/>") : "";
  const safeWorkspace = escapeHtml(workspaceName);
  const settingsUrl = `${PROD_ORIGIN}/app/configuracion?tab=notificaciones`;

  const html = `<!doctype html>
<html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width" /></head>
<body style="margin:0;padding:0;background:#f6f7fb;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f6f7fb;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
        <tr><td style="height:8px;background:${BRAND_COLOR};"></td></tr>
        <tr><td style="padding:32px 40px;">
          <p style="margin:0 0 8px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#64748b;">${safeWorkspace}</p>
          <h1 style="margin:0 0 16px;font-size:20px;line-height:1.35;color:#0f172a;">${safeTitle}</h1>
          ${safeBody ? `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">${safeBody}</p>` : ""}
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0 0;">
            <tr><td style="border-radius:8px;background:${BRAND_COLOR};">
              <a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">Ver en Astratta OS</a>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:16px 40px 28px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;">
          Recibís este email porque activaste las notificaciones por email para este evento.
          <a href="${escapeHtml(settingsUrl)}" style="color:#64748b;">Cambiar preferencias</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const text = [
    title,
    "",
    ...(body ? [body, ""] : []),
    `Ver en Astratta OS: ${url}`,
    "",
    `— ${workspaceName}`,
    `Cambiar preferencias: ${settingsUrl}`,
  ].join("\n");

  return { html, text, subject: `${title} · ${workspaceName}` };
}

Deno.serve(async (req) => {
  const secret = Deno.env.get("SYNC_CRON_SECRET") ?? "";
  const provided = req.headers.get("X-Sync-Secret") ?? "";
  if (!secret || provided !== secret) {
    return json({ error: "unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const fromAddress = Deno.env.get("FROM_EMAIL") ?? "invites@astrattaagency.com";
  const replyTo = Deno.env.get("REPLY_TO_EMAIL") ?? "hello@astrattaagency.com";

  if (!resendApiKey) {
    console.error("[send-notification-emails] missing RESEND_API_KEY");
    return json({ error: "resend_api_key_missing" }, 500);
  }

  const admin = createClient(supabaseUrl, serviceKey);

  const { data: claimed, error: claimErr } = await admin.rpc("claim_notification_emails", {
    p_limit: BATCH_SIZE,
  });
  if (claimErr) {
    console.error("[send-notification-emails] claim failed", claimErr);
    return json({ error: "claim_failed", detail: claimErr.message }, 500);
  }
  const rows = (claimed ?? []) as OutboxRow[];
  if (rows.length === 0) return json({ processed: 0 });

  const workspaceIds = [...new Set(rows.map((r) => r.workspace_id))];
  const { data: workspaces } = await admin
    .from("workspaces")
    .select("id, name")
    .in("id", workspaceIds);
  const workspaceName = new Map<string, string>(
    (workspaces ?? []).map((w: { id: string; name: string | null }) => [w.id, w.name ?? "Astratta OS"]),
  );

  const emailCache = new Map<string, string | null>();
  const getEmail = async (userId: string) => {
    if (emailCache.has(userId)) return emailCache.get(userId)!;
    const { data } = await admin.auth.admin.getUserById(userId);
    const email = data?.user?.email ?? null;
    emailCache.set(userId, email);
    return email;
  };

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of rows) {
    const email = await getEmail(row.recipient_user_id);
    if (!email) {
      skipped++;
      await admin
        .from("notification_email_outbox")
        .update({ status: "skipped", last_error: "recipient_has_no_email" })
        .eq("id", row.id);
      continue;
    }

    const wsName = workspaceName.get(row.workspace_id) ?? "Astratta OS";
    const { html, text, subject } = renderEmail({
      workspaceName: wsName,
      title: row.title,
      body: row.body,
      url: buildNotificationUrl(row.link),
    });

    const res = await sendResendEmail({
      apiKey: resendApiKey,
      fromEmail: `${wsName.replace(/[<>",;\r\n]/g, "").trim() || "Astratta OS"} <${fromAddress.replace(/^.*<|>$/g, "")}>`,
      replyTo,
      toAddresses: [email],
      subject,
      html,
      text,
    });

    if (res.ok) {
      sent++;
      await admin
        .from("notification_email_outbox")
        .update({ status: "sent", sent_at: new Date().toISOString(), last_error: null })
        .eq("id", row.id);
    } else {
      failed++;
      // Back to pending so the next run retries; claim_notification_emails
      // stops after 5 attempts, which leaves the row as 'failed'.
      await admin
        .from("notification_email_outbox")
        .update({
          status: row.attempts >= 5 ? "failed" : "pending",
          last_error: res.error ?? `resend_${res.status}`,
        })
        .eq("id", row.id);
    }
  }

  return json({ processed: rows.length, sent, failed, skipped });
});
