import { Badge } from "@/components/ui/badge";
import type { ProjectStatus, ProjectType } from "@/integrations/supabase/database.types";

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  planning: "Planning",
  in_progress: "En ejecución",
  paused: "Pausado",
  delivered: "Entregado",
  closed: "Cerrado",
};

const STATUS_CLASS: Record<ProjectStatus, string> = {
  planning: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
  in_progress: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  paused: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  delivered: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30",
  closed: "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30",
};

export const PROJECT_STATUS_BAR_CLASS: Record<ProjectStatus, string> = {
  planning: "bg-sky-500 text-white",
  in_progress: "bg-emerald-500 text-white",
  paused: "bg-amber-500 text-white",
  delivered: "bg-indigo-500 text-white",
  closed: "bg-slate-400 text-white",
};

export const PROJECT_STATUS_ORDER: ProjectStatus[] = [
  "planning",
  "in_progress",
  "paused",
  "delivered",
  "closed",
];

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <Badge variant="outline" className={STATUS_CLASS[status]}>
      {PROJECT_STATUS_LABEL[status]}
    </Badge>
  );
}

export const PROJECT_TYPE_LABEL: Record<ProjectType, string> = {
  web_dev: "Web Dev",
  social_media: "Social Media",
  paid_ads: "Paid Ads",
  graphic_design: "Diseño",
  branding: "Branding",
  audit: "Auditoría",
};

export const PROJECT_TYPES: ProjectType[] = [
  "web_dev",
  "social_media",
  "paid_ads",
  "graphic_design",
  "branding",
  "audit",
];

export function ProjectTypeChip({ type }: { type: ProjectType }) {
  return (
    <Badge variant="secondary" className="text-xs font-medium">
      {PROJECT_TYPE_LABEL[type]}
    </Badge>
  );
}

export function computeProgress(
  status: ProjectStatus,
  start: string | null,
  end: string | null,
): number | null {
  if (status === "delivered" || status === "closed") return 100;
  if (status === "planning") return 0;
  if (status === "paused") return null;
  if (!start || !end) return null;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  const t = Date.now();
  if (e <= s) return null;
  return Math.max(0, Math.min(100, Math.round(((t - s) / (e - s)) * 100)));
}

export function effectiveProgress(
  status: ProjectStatus,
  start: string | null,
  end: string | null,
  manualProgress?: number | null,
): number | null {
  if (manualProgress != null) return manualProgress;
  return computeProgress(status, start, end);
}

export function isOverdue(status: ProjectStatus, end: string | null): boolean {
  if (!end) return false;
  if (status !== "planning" && status !== "in_progress") return false;
  return new Date(end) < new Date();
}
