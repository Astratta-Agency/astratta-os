// Edge Function: send-contract
// Sends the client the public link to view/sign a contract via Resend, and
// marks the contract as sent (first send: draft -> sent; already-sent
// contracts can be resent without changing status again). Notifies all
// active client_admin users for the contract's client, same recipient
// resolution as send-content-approval-request.
//
// Always returns HTTP 200 so the UI can fall back to manual copy-link UX.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";
import { validateRequest } from "../_shared/auth.ts";
import { escapeHtml, sendResendEmail } from "../_shared/resend.ts";

// Canonical production origin for client-facing links. Mirrors the fix
// already applied to send-portal-invite / send-content-approval-request:
// never trust Origin (may be a staff browser on a stale domain) and never
// point clients at the old Lovable domain.
const PROD_ORIGIN = "https://app.astrattaagency.com";

const SENDABLE_STATUSES = new Set(["draft", "sent"]);

const BodySchema = z.object({
  contract_id: z.string().uuid(),
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function renderEmail(args: {
  clientName: string;
  workspaceName: string;
  workspaceWebsite: string | null;
  primaryColor: string;
  logoUrl: string | null;
  contractTitle: string;
  contractUrl: string;
  isResend: boolean;
}): { html: string; text: string; subject: string } {
  const { clientName, workspaceName, workspaceWebsite, primaryColor, logoUrl, contractTitle, contractUrl, isResend } = args;
  const safeClient = escapeHtml(clientName);
  const safeWorkspaceName = escapeHtml(workspaceName);
  const safeTitle = escapeHtml(contractTitle);
  const footerHost = workspaceWebsite ? workspaceWebsite.replace(/^https?:\/\//, "").replace(/\/$/, "") : null;
  const subject = `${isResend ? "Recordatorio: " : ""}Contrato para firmar — ${contractTitle}`;

  const logoBlock = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="${safeClient} logo" height="48" style="display:block;margin:0 auto 24px;max-height:48px;" />`
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
          <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;text-align:center;color:#0f172a;">Tenés un contrato para revisar y firmar</h1>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">${safeWorkspaceName} te envió el contrato <strong>${safeTitle}</strong> para ${safeClient}. Podés revisarlo y firmarlo directamente desde el enlace.</p>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:28px auto;">
            <tr><td style="border-radius:8px;background:${primaryColor};">
              <a href="${escapeHtml(contractUrl)}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">Ver y firmar contrato</a>
            </td></tr>
          </table>
          <p style="margin:16px 0 0;font-size:13px;color:#64748b;text-align:center;">Si el botón no funciona, copiá y pegá este enlace:<br/>${escapeHtml(contractUrl)}</p>
        </td></tr>
        <tr><td style="padding:20px 40px 32px;border-top:1px solid #e2e8f0;text-align:center;font-size:12px;color:#94a3b8;">
          Powered by <strong style="color:#475569;">${safeWorkspaceName}</strong>${footerHost ? ` · ${escapeHtml(footerHost)}` : ""}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const text = [
    `Tenés un contrato para revisar y firmar: ${contractTitle}`,
    "",
    `${workspaceName} te envió el contrato "${contractTitle}" para ${clientName}.`,
    "",
    `Ver y firmar: ${contractUrl}`,
    "",
    `— ${workspaceName}${footerHost ? ` · ${footerHost}` : ""}`,
  ].join("\n");

  return { html, text, subject };
}

// ----------------- Handler -----------------
Deno.serve(async (req) => {
  try {
    const authResult = await validateRequest(req, corsHeaders);
    if ("errorResponse" in authResult) return authResult.errorResponse;
    const userId = authResult.user.id;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const raw = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) return json({ error: "invalid_body", details: parsed.error.flatten() }, 400);
    const { contract_id } = parsed.data;

    // --- Load contract ---
    const { data: contract, error: contractErr } = await admin
      .from("contracts")
      .select("id, workspace_id, client_id, title, status, public_token, sent_at")
      .eq("id", contract_id)
      .maybeSingle();
    if (contractErr) return json({ error: "contract_lookup_failed", detail: contractErr.message }, 500);
    if (!contract) return json({ error: "contract_not_found" }, 404);

    // --- Verify caller is an active workspace member ---
    const { data: membership } = await admin
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", contract.workspace_id)
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();
    if (!membership) return json({ error: "forbidden" }, 403);

    if (!SENDABLE_STATUSES.has(contract.status)) {
      return json(
        { emailed: false, error: "invalid_status_for_send", status: contract.status },
        200,
      );
    }
    const isResend = contract.status === "sent";

    // --- Load client + workspace branding ---
    const { data: client, error: clientErr } = await admin
      .from("clients")
      .select("id, name, brand_primary_color, logo_url, workspace:workspaces(name, website)")
      .eq("id", contract.client_id)
      .maybeSingle();
    if (clientErr) return json({ error: "client_lookup_failed", detail: clientErr.message }, 500);
    if (!client) return json({ error: "client_not_found" }, 404);

    // --- Resolve recipients: active client_admin users (same rule as send-content-approval-request) ---
    const { data: clientUsers, error: cuErr } = await admin
      .from("client_users")
      .select("user_id, invited_email")
      .eq("client_id", contract.client_id)
      .eq("role", "client_admin")
      .eq("status", "active");
    if (cuErr) return json({ error: "client_users_lookup_failed", detail: cuErr.message }, 500);

    const userIds = (clientUsers ?? []).map((cu) => cu.user_id).filter(Boolean) as string[];
    const userEmails = new Map<string, string>();
    if (userIds.length > 0) {
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
      return json({ emailed: false, error: "no_recipients", recipient_count: 0 }, 200);
    }

    // --- Build contract link (always the canonical production origin) ---
    const contractUrl = `${PROD_ORIGIN}/contratos/${contract.public_token}`;
    const primaryColor = client.brand_primary_color || "#5140f2";

    const { html, text, subject } = renderEmail({
      clientName: client.name,
      workspaceName: (client.workspace as any)?.name ?? "tu agencia",
      workspaceWebsite: (client.workspace as any)?.website ?? null,
      primaryColor,
      logoUrl: client.logo_url,
      contractTitle: contract.title,
      contractUrl,
      isResend,
    });

    // --- Resend credentials ---
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("FROM_EMAIL") ?? "invites@astrattaagency.com";
    const replyTo = Deno.env.get("REPLY_TO_EMAIL") ?? "hello@astrattaagency.com";

    if (!resendApiKey) {
      console.error("[send-contract] missing Resend API key");
      return json({ emailed: false, error: "resend_api_key_missing", contractUrl }, 200);
    }

    // --- Send one email per recipient (privacy) in parallel ---
    const sendResults = await Promise.all(
      recipients.map(async (email) => {
        const res = await sendResendEmail({
          apiKey: resendApiKey,
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

    if (sent === 0) {
      console.error("[send-contract] all sends failed", sendResults);
      return json({
        emailed: false,
        sent,
        failed,
        error: "all_sends_failed",
        results: sendResults.map((r) => ({ email: r.email, error: r.error ?? `resend_${r.status}` })),
      }, 200);
    }

    // --- Transition status + audit trail (only on first send) ---
    if (!isResend) {
      const { error: updateErr } = await admin
        .from("contracts")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", contract.id)
        .eq("status", "draft");
      if (updateErr) {
        console.error("[send-contract] status update failed", updateErr);
      }
    }

    await admin.from("contract_events").insert({
      contract_id: contract.id,
      event_type: isResend ? "resent" : "sent",
    });

    return json({
      emailed: true,
      sent,
      failed,
      isResend,
      contractUrl,
      recipientEmails: recipients,
    });
  } catch (e) {
    console.error("[send-contract] unexpected", e);
    return json({ emailed: false, error: "unexpected", detail: String(e) }, 200);
  }
});
