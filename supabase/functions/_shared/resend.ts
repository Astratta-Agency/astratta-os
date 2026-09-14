// Shared Resend helpers for Edge Functions.
// Used by send-portal-invite, send-team-invite, and send-content-approval-request.
// Replaces the old Amazon SES v2 (SigV4) helper in _shared/ses.ts.

export interface ResendSendOptions {
  apiKey: string;
  fromEmail: string;          // e.g. "Astratta <invites@astrattaagency.com>"
  replyTo?: string;
  toAddresses: string[];      // one or more recipients (use a single-element array for privacy)
  subject: string;
  html: string;
  text: string;
}

export interface ResendSendResult {
  ok: boolean;
  status: number;
  messageId: string | null;
  error?: string;
}

export async function sendResendEmail(opts: ResendSendOptions): Promise<ResendSendResult> {
  const payload = {
    from: opts.fromEmail,
    to: opts.toAddresses,
    reply_to: opts.replyTo || undefined,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errBody = await res.text();
    return { ok: false, status: res.status, messageId: null, error: errBody.slice(0, 500) };
  }
  const data = await res.json().catch(() => ({} as any));
  return { ok: true, status: res.status, messageId: data?.id ?? null };
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
