// Edge Function: send-portal-invite
// Sends a branded portal invitation email via Amazon SES v2 (SigV4 signed).
// Also provisions (or links) the Supabase Auth account for the invited
// email so the link in the email actually works. Handles two cases:
//   1. Brand-new email -> createUser() provisions the account.
//   2. Email already has an account (e.g. already a contact for a
//      different client) -> generateLink() still resolves the existing
//      user's id so we can link THIS client's client_users row to it.
// Without step 2, a contact who is already a portal user elsewhere would
// get a client_users row that never gets user_id set, so they'd never see
// the new client in their portal even after logging in successfully.
// Returns { emailed: true, messageId } on success, { emailed: false, error } on failure
// (always HTTP 200 so the client dialog can fall back to manual copy-link flow).

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";
import { validateRequest } from "../_shared/auth.ts";
import { escapeHtml, sendSesEmail } from "../_shared/ses.ts";

const BodySchema = z.object({
  client_id: z.string().uuid(),
  email: z.string().email(),
  welcome_message: z.string().max(500).nullable().optional(),
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function renderEmail(args: {
  clientName: string;
  primaryColor: string;
  logoUrl: string | null;
  welcomeMessage: string | null;
  actionUrl: string;
  recipientEmail: string;
  isNewAccount: boolean;
}): { html: string; text: string; subject: string } {
  const { clientName, primaryColor, logoUrl, welcomeMessage, actionUrl, recipientEmail, isNewAccount } = args;
  const safeName = escapeHtml(clientName);
  const safeMsg = welcomeMessage ? escapeHtml(welcomeMessage) : null;
  const subject = `Te invitamos al portal de ${clientName} x Astratta`;
  const ctaLabel = isNewAccount ? "Crear mi contraseña y acceder" : "Acceder al portal";

  const logoBlock = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="${safeName} logo" height="48" style="display:block;margin:0 auto 24px;max-height:48px;" />`
    : "";

  const msgBlock = safeMsg
    ? `<blockquote style="margin:24px 0;padding:12px 16px;border-left:4px solid ${primaryColor};color:#475569;font-style:italic;background:#f8fafc;">${safeMsg}</blockquote>`
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
          <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;text-align:center;color:#0f172a;">Te invitamos al portal de ${safeName}</h1>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">Desde tu portal vas a poder aprobar contenido, revisar reportes y acceder a los documentos que tu equipo en Astratta gestiona para ${safeName}.</p>
          ${msgBlock}
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:28px auto;">
            <tr><td style="border-radius:8px;background:${primaryColor};">
              <a href="${escapeHtml(actionUrl)}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">${ctaLabel}</a>
            </td></tr>
          </table>
          <p style="margin:24px 0 0;font-size:13px;color:#64748b;text-align:center;">Inicia sesión con tu correo: <strong>${escapeHtml(recipientEmail)}</strong></p>
        </td></tr>
        <tr><td style="padding:20px 40px 32px;border-top:1px solid #e2e8f0;text-align:center;font-size:12px;color:#94a3b8;">
          Powered by <strong style="color:#475569;">Astratta Agency</strong> · astrattaagency.com
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const text = [
    `Te invitamos al portal de ${clientName}`,
    "",
    `Desde tu portal vas a poder aprobar contenido, revisar reportes y acceder a los documentos que tu equipo en Astratta gestiona para ${clientName}.`,
    welcomeMessage ? `\n"${welcomeMessage}"\n` : "",
    `${ctaLabel}: ${actionUrl}`,
    `Inicia sesión con tu correo: ${recipientEmail}`,
    "",
    "— Astratta Agency · astrattaagency.com",
  ].join("\n");

  return { html, text, subject };
}

// ----------------- Handler -----------------
Deno.serve(async (req) => {
  try {
    // --- Auth ---
    const authResult = await validateRequest(req, corsHeaders);
    if ("errorResponse" in authResult) return authResult.errorResponse;
    const userId = authResult.user.id;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // --- Validate body ---
    const raw = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) return json({ error: "invalid_body", details: parsed.error.flatten() }, 400);
    const { client_id, email, welcome_message } = parsed.data;

    // --- Load client + verify membership ---
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: client, error: clientErr } = await admin
      .from("clients")
      .select("id, name, slug, workspace_id, brand_primary_color, brand_secondary_color, logo_url")
      .eq("id", client_id)
      .maybeSingle();
    if (clientErr) return json({ error: "client_lookup_failed", detail: clientErr.message }, 500);
    if (!client) return json({ error: "client_not_found" }, 404);

    const { data: membership } = await admin
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", client.workspace_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!membership) return json({ error: "forbidden" }, 403);

    // --- Build URLs ---
    const originHeader = req.headers.get("origin");
    const siteBase = (Deno.env.get("SITE_URL") ?? (originHeader ? new URL(originHeader).origin : "")).replace(/\/$/, "");
    const portalUrl = `${siteBase}/portal/login`;

    // --- Provision the Auth account (or resolve the existing one) ---
    let actionUrl = portalUrl;
    let isNewAccount = false;
    let resolvedUserId: string | null = null;

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
    });

    if (!createErr && created?.user) {
      isNewAccount = true;
      resolvedUserId = created.user.id;
    } else if (createErr && !`${createErr.message}`.toLowerCase().includes("already")) {
      console.error("[send-portal-invite] createUser failed", createErr);
    }

    // Whether the account is brand new or already existed, generateLink
    // resolves the user id AND gives us a real, working action link — for an
    // existing user this doubles as a password-reset link, which is fine
    // even if they already know their password (they can just ignore it and
    // use /portal/login directly).
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: `${siteBase}/portal/reset-password` },
    });
    if (!linkErr && linkData?.properties?.action_link) {
      actionUrl = linkData.properties.action_link;
    }
    if (!resolvedUserId && linkData?.user?.id) {
      resolvedUserId = linkData.user.id;
    }

    // Link this account (new or pre-existing) to the client_users row the
    // dialog just inserted, whichever client this invite is for.
    if (resolvedUserId) {
      await admin
        .from("client_users")
        .update({ user_id: resolvedUserId, status: "active", accepted_at: new Date().toISOString() })
        .eq("client_id", client_id)
        .eq("invited_email", email)
        .is("user_id", null);
    }

    // --- Email content ---
    const primaryColor = client.brand_primary_color || "#5140f2";
    const { html, text, subject } = renderEmail({
      clientName: client.name,
      primaryColor,
      logoUrl: client.logo_url,
      welcomeMessage: welcome_message ?? null,
      actionUrl,
      recipientEmail: email,
      isNewAccount,
    });

    // --- Send via SES v2 ---
    const accessKeyId = Deno.env.get("AWS_ACCESS_KEY_ID");
    const secretAccessKey = Deno.env.get("AWS_SECRET_ACCESS_KEY");
    const fromEmail = Deno.env.get("FROM_EMAIL") ?? "invites@astrattaagency.com";
    const replyTo = Deno.env.get("REPLY_TO_EMAIL") ?? "hello@astrattaagency.com";

    if (!accessKeyId || !secretAccessKey) {
      console.error("[send-portal-invite] missing AWS credentials");
      return json({ emailed: false, error: "aws_credentials_missing", actionUrl }, 200);
    }

    const sesResult = await sendSesEmail({
      region: Deno.env.get("AWS_REGION") ?? "us-east-1",
      accessKeyId,
      secretAccessKey,
      fromEmail: `Astratta <${fromEmail}>`,
      replyTo,
      toAddresses: [email],
      subject,
      html,
      text,
    });

    if (!sesResult.ok) {
      console.error("[send-portal-invite] SES error", sesResult.status, sesResult.error);
      return json({ emailed: false, error: `ses_${sesResult.status}`, detail: sesResult.error, actionUrl }, 200);
    }
    return json({ emailed: true, messageId: sesResult.messageId, isNewAccount });
  } catch (e) {
    console.error("[send-portal-invite] unexpected", e);
    return json({ emailed: false, error: "unexpected", detail: String(e) }, 200);
  }
});
