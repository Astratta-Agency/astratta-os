// Edge Function: send-team-invite
// Invites a new team member (team_member or collaborator) to the workspace.
// Same dual-resolve pattern as send-portal-invite, but for workspace_members.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";
import { validateRequest } from "../_shared/auth.ts";
import { escapeHtml, sendSesEmail } from "../_shared/ses.ts";

const BodySchema = z.object({
  workspace_id: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(["team_member", "collaborator"]),
  title: z.string().max(120).optional().nullable(),
  weekly_capacity_hours: z.number().min(0).max(168).optional().nullable(),
  hourly_rate: z.number().min(0).optional().nullable(),
  full_name: z.string().trim().min(1).max(200).optional().nullable(),
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function renderEmail(args: {
  workspaceName: string;
  actionUrl: string;
  recipientEmail: string;
  isNewAccount: boolean;
}): { html: string; text: string; subject: string } {
  const { workspaceName, actionUrl, recipientEmail, isNewAccount } = args;
  const primaryColor = "#5140f2";
  const subject = `Te invitamos al equipo de Astratta OS`;
  const ctaLabel = isNewAccount ? "Crear mi contraseña y acceder" : "Acceder a Astratta OS";

  const html = `<!doctype html>
<html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width" /></head>
<body style="margin:0;padding:0;background:#f6f7fb;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f6f7fb;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
        <tr><td style="height:60px;background:${primaryColor};"></td></tr>
        <tr><td style="padding:32px 40px;">
          <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;text-align:center;color:#0f172a;">Te invitamos al equipo de Astratta OS</h1>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">Fuiste invitado a colaborar en <strong>${escapeHtml(workspaceName)}</strong>. Desde Astratta OS vas a poder gestionar clientes, proyectos, contenido y tu tiempo de trabajo.</p>
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
    `Te invitamos al equipo de Astratta OS`,
    ``,
    `Fuiste invitado a colaborar en ${workspaceName}.`,
    ``,
    `${ctaLabel}: ${actionUrl}`,
    `Inicia sesión con tu correo: ${recipientEmail}`,
    ``,
    `— Astratta Agency · astrattaagency.com`,
  ].join("\n");

  return { html, text, subject };
}

Deno.serve(async (req) => {
  try {
    const authResult = await validateRequest(req, corsHeaders);
    if ("errorResponse" in authResult) return authResult.errorResponse;
    const userId = authResult.user.id;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const raw = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) return json({ error: "invalid_body", details: parsed.error.flatten() }, 400);
    const { workspace_id, email, role, title, weekly_capacity_hours, hourly_rate, full_name } = parsed.data;

    const admin = createClient(supabaseUrl, serviceKey);

    // Verify caller is owner
    const { data: ownerMembership } = await admin
      .from("workspace_members")
      .select("user_id, role")
      .eq("workspace_id", workspace_id)
      .eq("user_id", userId)
      .eq("role", "owner")
      .maybeSingle();
    if (!ownerMembership) return json({ error: "forbidden" }, 403);

    const { data: workspace } = await admin
      .from("workspaces")
      .select("id, name")
      .eq("id", workspace_id)
      .maybeSingle();
    if (!workspace) return json({ error: "workspace_not_found" }, 404);

    const originHeader = req.headers.get("origin");
    const siteBase = (Deno.env.get("SITE_URL") ?? (originHeader ? new URL(originHeader).origin : "")).replace(/\/$/, "");
    const loginUrl = `${siteBase}/login`;

    let actionUrl = loginUrl;
    let isNewAccount = false;
    let resolvedUserId: string | null = null;

    const normalizedEmail = email.toLowerCase().trim();

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: normalizedEmail,
      email_confirm: true,
      user_metadata: full_name ? { full_name } : undefined,
    });

    if (!createErr && created?.user) {
      isNewAccount = true;
      resolvedUserId = created.user.id;
    } else if (createErr && !`${createErr.message}`.toLowerCase().includes("already")) {
      console.error("[send-team-invite] createUser failed", createErr);
    }

    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: normalizedEmail,
      options: { redirectTo: `${siteBase}/reset-password` },
    });
    if (!linkErr && linkData?.properties?.action_link) {
      actionUrl = linkData.properties.action_link;
    }
    if (!resolvedUserId && linkData?.user?.id) {
      resolvedUserId = linkData.user.id;
    }

    if (!resolvedUserId) {
      return json({ emailed: false, error: "user_resolve_failed" }, 200);
    }

    // Upsert workspace_members row
    const memberRow = {
      workspace_id,
      user_id: resolvedUserId,
      role,
      status: "active",
      title: title ?? null,
      weekly_capacity_hours: weekly_capacity_hours ?? 40,
      hourly_rate: hourly_rate ?? null,
    };
    const { error: upsertErr } = await admin
      .from("workspace_members")
      .upsert(memberRow, { onConflict: "workspace_id,user_id" });
    if (upsertErr) {
      // Fall back to plain insert if the unique constraint uses a different name
      const { error: insErr } = await admin.from("workspace_members").insert(memberRow);
      if (insErr && !`${insErr.message}`.toLowerCase().includes("duplicate")) {
        console.error("[send-team-invite] member insert failed", insErr);
        return json({ emailed: false, error: "member_insert_failed", detail: insErr.message, actionUrl }, 200);
      }
    }

    const { html, text, subject } = renderEmail({
      workspaceName: (workspace as any).name,
      actionUrl,
      recipientEmail: normalizedEmail,
      isNewAccount,
    });

    const accessKeyId = Deno.env.get("AWS_ACCESS_KEY_ID");
    const secretAccessKey = Deno.env.get("AWS_SECRET_ACCESS_KEY");
    const fromEmail = Deno.env.get("FROM_EMAIL") ?? "invites@astrattaagency.com";
    const replyTo = Deno.env.get("REPLY_TO_EMAIL") ?? "hello@astrattaagency.com";

    if (!accessKeyId || !secretAccessKey) {
      console.error("[send-team-invite] missing AWS credentials");
      return json({ emailed: false, error: "aws_credentials_missing", actionUrl }, 200);
    }

    const sesResult = await sendSesEmail({
      region: Deno.env.get("AWS_REGION") ?? "us-east-1",
      accessKeyId,
      secretAccessKey,
      fromEmail: `Astratta <${fromEmail}>`,
      replyTo,
      toAddresses: [normalizedEmail],
      subject,
      html,
      text,
    });

    if (!sesResult.ok) {
      console.error("[send-team-invite] SES error", sesResult.status, sesResult.error);
      return json({ emailed: false, error: `ses_${sesResult.status}`, detail: sesResult.error, actionUrl }, 200);
    }
    return json({ emailed: true, messageId: sesResult.messageId, isNewAccount });
  } catch (e) {
    console.error("[send-team-invite] unexpected", e);
    return json({ emailed: false, error: "unexpected", detail: String(e) }, 200);
  }
});
