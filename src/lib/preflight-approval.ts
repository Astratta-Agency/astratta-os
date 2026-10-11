import type { Channel, PostStatus } from "@/lib/post-states";
import { CHANNEL_LABEL } from "@/lib/post-states";
import type { PostVariantRow } from "@/hooks/usePostEditor";

export type PreflightError = {
  code:
    | "no_channels"
    | "missing_caption"
    | "missing_schedule"
    | "schedule_in_past"
    | "no_client_admin";
  message: string;
  action?: { label: string; path: string };
};

export type PreflightInput = {
  post: {
    channels: Channel[];
    scheduled_for: string | null;
    media_urls: string[];
    status: PostStatus;
  };
  variants: PostVariantRow[];
  clientAdmins: { user_id: string | null; status: string }[];
  clientSlug: string;
};

export type PreflightResult =
  | { ok: true; errors: [] }
  | { ok: false; errors: PreflightError[] };

export function runApprovalPreflight(input: PreflightInput): PreflightResult {
  const errors: PreflightError[] = [];
  const { post, variants, clientAdmins, clientSlug } = input;

  // 1. Channels
  if (!post.channels || post.channels.length === 0) {
    errors.push({
      code: "no_channels",
      message: "Debes activar al menos un canal antes de enviar a aprobación",
    });
  }

  // 2. Caption per enabled channel
  const variantsByChannel = new Map<Channel, PostVariantRow>();
  variants.filter((v) => v.is_enabled).forEach((v) => variantsByChannel.set(v.channel, v));
  for (const ch of post.channels ?? []) {
    const v = variantsByChannel.get(ch);
    const caption = (v?.caption ?? "").trim();
    if (!caption) {
      errors.push({
        code: "missing_caption",
        message: `Falta el caption para ${CHANNEL_LABEL[ch] ?? ch}`,
      });
    }
  }

  // 3. Schedule
  if (!post.scheduled_for) {
    errors.push({
      code: "missing_schedule",
      message: "Define una fecha de publicación futura antes de enviar",
    });
  } else {
    const when = new Date(post.scheduled_for).getTime();
    if (!Number.isFinite(when) || when <= Date.now()) {
      errors.push({
        code: "schedule_in_past",
        message: "La fecha de publicación debe ser futura",
      });
    }
  }

  // 4. At least one client_admin
  const hasAdmin = (clientAdmins ?? []).some(
    (a) => a.status === "active" || a.status === "invited",
  );
  if (!hasAdmin) {
    errors.push({
      code: "no_client_admin",
      message:
        "Este cliente no tiene admin invitado al portal. Invita uno desde Stakeholders.",
      action: { label: "Ir a Stakeholders", path: `/app/clientes/${clientSlug}#stakeholders` },
    });
  }

  return errors.length === 0
    ? { ok: true, errors: [] }
    : { ok: false, errors };
}
