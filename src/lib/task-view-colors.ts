import type { TaskPriority, TaskStatus } from "@/hooks/useTasks";

// Semantic hex colors used both by Tailwind pill classes and Recharts fills.
export const STATUS_HEX: Record<TaskStatus, string> = {
  todo: "#94a3b8", // slate-400
  doing: "#ff7503", // Astratta secondary
  review: "#5140f2", // Astratta primary
  done: "#10b981", // emerald-500
};

export const PRIORITY_HEX: Record<TaskPriority, string> = {
  p0: "#ef4444",
  p1: "#f97316",
  p2: "#64748b",
  p3: "#94a3b8",
};

export const STATUS_PILL: Record<TaskStatus, string> = {
  todo: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
  doing: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-500/15 dark:text-orange-300",
  review: "bg-primary/10 text-primary border-primary/20",
  done: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300",
};

export const STATUS_DOT: Record<TaskStatus, string> = {
  todo: "bg-slate-400",
  doing: "bg-orange-500",
  review: "bg-primary",
  done: "bg-emerald-500",
};

export const STATUS_ORDER: TaskStatus[] = ["todo", "doing", "review", "done"];
