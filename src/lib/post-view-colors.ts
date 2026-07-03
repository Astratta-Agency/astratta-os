import type { PostStatus } from "@/lib/post-states";

/**
 * Semantic color mapping for post status Kanban columns.
 * Groups:
 *  - idea / draft            → slate (in-flight, internal)
 *  - internal review         → orange (Astratta secondary #ff7503)
 *  - pending / changes       → amber (waiting on client)
 *  - approved / scheduled    → primary purple (#5140f2)
 *  - published               → green
 *  - rejected                → red
 *  - archived                → muted gray
 */
export const POST_STATUS_HEX: Record<PostStatus, string> = {
  idea: "#94a3b8",              // slate-400
  draft: "#64748b",             // slate-500
  pending_internal_review: "#ff7503", // Astratta secondary
  pending_approval: "#f59e0b",  // amber-500
  changes_requested: "#eab308", // yellow-500
  approved: "#5140f2",          // Astratta primary
  scheduled: "#7c3aed",         // violet-600
  published: "#10b981",         // emerald-500
  rejected: "#ef4444",          // red-500
  archived: "#a1a1aa",          // zinc-400
};

export const POST_STATUS_DOT: Record<PostStatus, string> = {
  idea: "bg-slate-400",
  draft: "bg-slate-500",
  pending_internal_review: "bg-orange-500",
  pending_approval: "bg-amber-500",
  changes_requested: "bg-yellow-500",
  approved: "bg-primary",
  scheduled: "bg-violet-600",
  published: "bg-emerald-500",
  rejected: "bg-red-500",
  archived: "bg-zinc-400",
};
