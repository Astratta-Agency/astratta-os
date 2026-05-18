// Shared AWS SES v2 helpers (SigV4 signing + send) for Edge Functions.
// Used by send-portal-invite and send-content-approval-request.

const enc = new TextEncoder();

export async function sha256Hex(data: string | Uint8Array): Promise<string> {
  const buf = typeof data === "string" ? enc.encode(data) : data;
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hmac(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", cryptoKey, enc.encode(data));
}

export function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function signSesRequest(opts: {
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
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);

  const payloadHash = await sha256Hex(body);
  const canonicalHeaders =
    `content-type:application/json\nhost:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = [method, path, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");

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

export interface SesSendOptions {
  region?: string;
  accessKeyId: string;
  secretAccessKey: string;
  fromEmail: string;          // e.g. "Astratta <invites@astrattaagency.com>"
  replyTo?: string;
  toAddresses: string[];      // one or more recipients (use a single-element array for privacy)
  subject: string;
  html: string;
  text: string;
}

export interface SesSendResult {
  ok: boolean;
  status: number;
  messageId: string | null;
  error?: string;
}

export async function sendSesEmail(opts: SesSendOptions): Promise<SesSendResult> {
  const region = opts.region ?? "us-east-1";
  const host = `email.${region}.amazonaws.com`;
  const path = "/v2/email/outbound-emails";

  const payload = JSON.stringify({
    FromEmailAddress: opts.fromEmail,
    Destination: { ToAddresses: opts.toAddresses },
    ReplyToAddresses: opts.replyTo ? [opts.replyTo] : undefined,
    Content: {
      Simple: {
        Subject: { Data: opts.subject, Charset: "UTF-8" },
        Body: {
          Html: { Data: opts.html, Charset: "UTF-8" },
          Text: { Data: opts.text, Charset: "UTF-8" },
        },
      },
    },
  });

  const headers = await signSesRequest({
    region,
    accessKeyId: opts.accessKeyId,
    secretAccessKey: opts.secretAccessKey,
    body: payload,
    host,
    path,
  });

  const res = await fetch(`https://${host}${path}`, { method: "POST", headers, body: payload });
  if (!res.ok) {
    const errBody = await res.text();
    return { ok: false, status: res.status, messageId: null, error: errBody.slice(0, 500) };
  }
  const data = await res.json().catch(() => ({} as any));
  return { ok: true, status: res.status, messageId: data?.MessageId ?? null };
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
