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

export type Channel = "instagram" | "facebook" | "linkedin" | "tiktok" | "x" | "threads";

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

export const POST_STATE_TRANSITIONS: Record<PostStatus, PostStatus[]> = {
  idea: ["draft", "archived"],
  draft: ["pending_internal_review", "pending_approval", "archived"],
  pending_internal_review: ["draft", "pending_approval", "rejected"],
  pending_approval: ["approved", "changes_requested", "rejected", "draft"],
  changes_requested: ["draft", "pending_approval", "archived"],
  approved: ["scheduled", "draft"],
  scheduled: ["approved", "published", "archived"],
  published: ["archived"],
  rejected: ["draft", "archived"],
  archived: ["draft"],
};

export const CHANNELS: Channel[] = ["instagram", "facebook", "linkedin", "tiktok", "x", "threads"];

export const CHANNEL_LABEL: Record<Channel, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  x: "X",
  threads: "Threads",
};
