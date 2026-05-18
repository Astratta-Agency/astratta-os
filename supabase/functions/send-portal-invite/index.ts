// Edge Function: send-portal-invite
// Sends a branded portal invitation email via Amazon SES v2 (SigV4 signed).
// Returns { emailed: true, messageId } on success, { emailed: false, error } on failure
// (always HTTP 200 so the client dialog can fall back to manual copy-link flow).

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";

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

// ----------------- AWS SigV4 -----------------
const enc = new TextEncoder();

async function sha256Hex(data: string | Uint8Array): Promise<string> {
  const buf = typeof data === "string" ? enc.encode(data) : data;
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmac(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", cryptoKey, enc.encode(data));
}

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function signSesRequest(opts: {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  body: string;
  host: string;
  path: string;
}): Promise<Record<string, string>> {
  const { region, accessKeyId, secretAccessKey, body, host, path } = opts;
  const service = "ses";
  const method = "POST";
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, ""); // YYYYMMDDTHHMMSSZ
  const dateStamp = amzDate.slice(0, 8);

  const payloadHash = await sha256Hex(body);
  const canonicalHeaders =
    `content-type:application/json\nhost:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = [
    method,
    path,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join("\n");

  const kDate = await hmac(enc.encode("AWS4" + secretAccessKey), dateStamp);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, service);
  const kSigning = await hmac(kService, "aws4_request");
  const signature = toHex(await hmac(kSigning, stringToSign));

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    "Content-Type": "application/json",
    "Host": host,
    "X-Amz-Date": amzDate,
    "X-Amz-Content-Sha256": payloadHash,
    "Authorization": authorization,
  };
}

// ----------------- HTML template -----------------
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderEmail(args: {
  clientName: string;
  primaryColor: string;
  logoUrl: string | null;
  welcomeMessage: string | null;
  portalUrl: string;
  recipientEmail: string;
}): { html: string; text: string; subject: string } {
  const { clientName, primaryColor, logoUrl, welcomeMessage, portalUrl, recipientEmail } = args;
  const safeName = escapeHtml(clientName);
  const safeMsg = welcomeMessage ? escapeHtml(welcomeMessage) : null;
  const subject = `Te invitamos al portal de ${clientName} x Astratta`;

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
              <a href="${escapeHtml(portalUrl)}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">Acceder al portal</a>
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
    `Acceder al portal: ${portalUrl}`,
    `Inicia sesión con tu correo: ${recipientEmail}`,
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
    // --- Auth ---
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "missing_token" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsErr } = await authClient.auth.getClaims();
    if (claimsErr || !claimsData?.claims?.sub) return json({ error: "invalid_token" }, 401);
    const userId = claimsData.claims.sub as string;

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

    // --- Build URLs + email content ---
    const originHeader = req.headers.get("origin");
    const siteBase = Deno.env.get("SITE_URL") ?? (originHeader ? new URL(originHeader).origin : "");
    const portalUrl = `${siteBase.replace(/\/$/, "")}/portal/login`;

    const primaryColor = client.brand_primary_color || "#5140f2";
    const { html, text, subject } = renderEmail({
      clientName: client.name,
      primaryColor,
      logoUrl: client.logo_url,
      welcomeMessage: welcome_message ?? null,
      portalUrl,
      recipientEmail: email,
    });

    // --- Send via SES v2 ---
    const region = Deno.env.get("AWS_REGION") ?? "us-east-1";
    const accessKeyId = Deno.env.get("AWS_ACCESS_KEY_ID");
    const secretAccessKey = Deno.env.get("AWS_SECRET_ACCESS_KEY");
    const fromEmail = Deno.env.get("FROM_EMAIL") ?? "invites@astrattaagency.com";
    const replyTo = Deno.env.get("REPLY_TO_EMAIL") ?? "hello@astrattaagency.com";

    if (!accessKeyId || !secretAccessKey) {
      console.error("[send-portal-invite] missing AWS credentials");
      return json({ emailed: false, error: "aws_credentials_missing" }, 200);
    }

    const host = `email.${region}.amazonaws.com`;
    const path = "/v2/email/outbound-emails";
    const payload = JSON.stringify({
      FromEmailAddress: `Astratta <${fromEmail}>`,
      Destination: { ToAddresses: [email] },
      ReplyToAddresses: [replyTo],
      Content: {
        Simple: {
          Subject: { Data: subject, Charset: "UTF-8" },
          Body: {
            Html: { Data: html, Charset: "UTF-8" },
            Text: { Data: text, Charset: "UTF-8" },
          },
        },
      },
    });

    const headers = await signSesRequest({
      region,
      accessKeyId,
      secretAccessKey,
      body: payload,
      host,
      path,
    });

    const sesRes = await fetch(`https://${host}${path}`, {
      method: "POST",
      headers,
      body: payload,
    });

    if (!sesRes.ok) {
      const errBody = await sesRes.text();
      console.error("[send-portal-invite] SES error", sesRes.status, errBody);
      return json({ emailed: false, error: `ses_${sesRes.status}`, detail: errBody.slice(0, 500) }, 200);
    }

    const sesData = await sesRes.json().catch(() => ({}));
    return json({ emailed: true, messageId: sesData?.MessageId ?? null });
  } catch (e) {
    console.error("[send-portal-invite] unexpected", e);
    return json({ emailed: false, error: "unexpected", detail: String(e) }, 200);
  }
});
