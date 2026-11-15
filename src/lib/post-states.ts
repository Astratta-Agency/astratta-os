export type PostStatus =
  | "idea"
  | "draft"
  | "pending_internal_review"
  | "pending_approval"
  | "changes_requested"
  | "approved"
  | "rejected"
  | "scheduled"
  | "published"
  | "archived";

export type Channel = "instagram" | "facebook" | "linkedin" | "tiktok" | "x" | "threads" | "google_business" | "nextdoor";

export const POST_STATE_META: Record<PostStatus, { label: string; color: string }> = {
  idea: { label: "Idea", color: "hsl(0 0% 60%)" },
  draft: { label: "Borrador", color: "hsl(217 91% 60%)" },
  pending_internal_review: { label: "Revisión interna", color: "hsl(38 92% 50%)" },
  pending_approval: { label: "Esperando cliente", color: "hsl(23 100% 51%)" },
  changes_requested: { label: "Cambios solicitados", color: "hsl(43 96% 56%)" },
  approved: { label: "Aprobado", color: "hsl(142 71% 45%)" },
  scheduled: { label: "Programado", color: "hsl(245 87% 60%)" },
  published: { label: "Publicado", color: "hsl(158 100% 30%)" },
  rejected: { label: "Rechazado", color: "hsl(0 84% 60%)" },
  archived: { label: "Archivado", color: "hsl(0 0% 70%)" },
};

export const POST_STATE_ORDER: PostStatus[] = [
  "idea",
  "draft",
  "pending_internal_review",
  "pending_approval",
  "changes_requested",
  "approved",
  "scheduled",
  "published",
  "rejected",
  "archived",
];

/**
 * La aprobación del cliente es el camino recomendado, no un candado: el equipo
 * puede marcar Programado/Publicado desde cualquier estado activo (ver
 * `skipsClientApproval`), y corregir hacia atrás desde Publicado.
 */
export const POST_STATE_TRANSITIONS: Record<PostStatus, PostStatus[]> = {
  idea: ["draft", "scheduled", "published", "archived"],
  draft: ["pending_internal_review", "pending_approval", "scheduled", "published", "archived"],
  pending_internal_review: ["draft", "pending_approval", "scheduled", "published", "rejected"],
  pending_approval: ["approved", "changes_requested", "rejected", "draft", "scheduled", "published"],
  changes_requested: ["draft", "pending_approval", "scheduled", "published", "archived"],
  approved: ["scheduled", "published", "draft"],
  scheduled: ["published", "approved", "draft", "archived"],
  published: ["scheduled", "draft", "archived"],
  rejected: ["draft", "archived"],
  archived: ["draft"],
};

const PRE_APPROVAL: PostStatus[] = [
  "idea",
  "draft",
  "pending_internal_review",
  "pending_approval",
  "changes_requested",
];

/**
 * true cuando el cambio lleva la publicación a Programado/Publicado sin haber
 * pasado por la aprobación del cliente. La interfaz pide confirmación y el
 * salto queda registrado en el historial como `approval_skipped`.
 */
export function skipsClientApproval(from: PostStatus, to: PostStatus): boolean {
  return (to === "scheduled" || to === "published") && PRE_APPROVAL.includes(from);
}

export const CHANNELS: Channel[] = ["instagram", "facebook", "linkedin", "tiktok", "x", "threads", "google_business", "nextdoor"];

export const CHANNEL_LABEL: Record<Channel, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  x: "X",
  threads: "Threads",
  google_business: "Google Business",
  nextdoor: "Nextdoor",
};
