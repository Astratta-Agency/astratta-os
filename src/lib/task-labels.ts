import type { TaskPriority, TaskStatus, TaskType } from "@/hooks/useTasks";

export const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "Por hacer",
  doing: "En curso",
  review: "Revisión",
  done: "Hecho",
};

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  p0: "P0",
  p1: "P1",
  p2: "P2",
  p3: "P3",
};

export const PRIORITY_CLASS: Record<TaskPriority, string> = {
  p0: "bg-destructive text-destructive-foreground",
  p1: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  p2: "bg-muted text-foreground",
  p3: "bg-muted/60 text-muted-foreground",
};

export const TYPE_LABEL: Record<TaskType, string> = {
  produccion: "Producción",
  revision: "Revisión",
  aprobacion: "Aprobación",
  reunion: "Reunión",
  admin: "Admin",
};

export const STATUS_CLASS: Record<TaskStatus, string> = {
  todo: "bg-muted text-foreground",
  doing: "bg-primary/15 text-primary",
  review: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  done: "bg-green-500/15 text-green-700 dark:text-green-300",
};
