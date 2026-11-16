// Client health score: shared thresholds, labels and the shape of the
// breakdown stored in public.client_health (see the client_health_score
// migration for how each component is calculated).

import { usd } from "@/lib/money";

export type HealthLevel = "healthy" | "watch" | "risk";
export type HealthFilter = "all" | HealthLevel | "none";

export const HEALTHY_MIN = 70;
export const WATCH_MIN = 40;

export function healthLevel(score: number): HealthLevel {
  if (score >= HEALTHY_MIN) return "healthy";
  if (score >= WATCH_MIN) return "watch";
  return "risk";
}

export const HEALTH_LEVEL: Record<HealthLevel, { label: string; bar: string; stroke: string; text: string }> = {
  healthy: {
    label: "Saludable",
    bar: "bg-emerald-500",
    stroke: "stroke-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  watch: {
    label: "En observación",
    bar: "bg-amber-500",
    stroke: "stroke-amber-500",
    text: "text-amber-600 dark:text-amber-400",
  },
  risk: {
    label: "En riesgo",
    bar: "bg-rose-500",
    stroke: "stroke-rose-500",
    text: "text-rose-600 dark:text-rose-400",
  },
};

export type HealthComponentKey = "payments" | "delivery" | "approvals" | "relationship";

export type HealthBreakdown = {
  version: number;
  score: number | null;
  reason: "status" | "no_data" | null;
  components: {
    payments?: {
      score: number | null;
      weight: number;
      open_count: number;
      overdue_count: number;
      overdue_amount: number;
      max_days_overdue: number;
    };
    delivery?: { score: number | null; weight: number; open_tasks: number; overdue_tasks: number };
    approvals?: {
      score: number | null;
      weight: number;
      recent_posts: number;
      changes_requested: number;
      rejected: number;
      stalled: number;
    };
    relationship?: {
      score: number | null;
      weight: number;
      contract: "active" | "expiring" | "pending" | "expired" | null;
      contract_end_date: string | null;
      days_since_activity: number | null;
    };
  };
};

export const HEALTH_COMPONENTS: { key: HealthComponentKey; label: string }[] = [
  { key: "payments", label: "Pagos" },
  { key: "delivery", label: "Entrega" },
  { key: "approvals", label: "Aprobaciones" },
  { key: "relationship", label: "Relación" },
];

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const money = (n: number) => usd.format(n);

/** One line explaining why a component has the score it has. */
export function describeHealthComponent(key: HealthComponentKey, b: HealthBreakdown): string {
  const c = b.components;
  switch (key) {
    case "payments": {
      const p = c.payments;
      if (!p || p.score == null) return "Sin facturas emitidas";
      if (p.overdue_count === 0) {
        return p.open_count > 0
          ? `Al día · ${plural(p.open_count, "factura por cobrar", "facturas por cobrar")}`
          : "Al día · sin saldo pendiente";
      }
      return `${plural(p.overdue_count, "factura vencida", "facturas vencidas")} · ${money(
        Number(p.overdue_amount),
      )} · hasta ${plural(p.max_days_overdue, "día", "días")} de atraso`;
    }
    case "delivery": {
      const d = c.delivery;
      if (!d || d.score == null) return "Sin tareas recientes";
      if (d.overdue_tasks === 0) return `Sin atrasos · ${plural(d.open_tasks, "tarea abierta", "tareas abiertas")}`;
      return `${plural(d.overdue_tasks, "tarea atrasada", "tareas atrasadas")} de ${plural(
        d.open_tasks,
        "abierta",
        "abiertas",
      )}`;
    }
    case "approvals": {
      const a = c.approvals;
      if (!a || a.score == null) return "Sin contenido reciente";
      const issues = [
        a.changes_requested > 0 && `${a.changes_requested} con cambios solicitados`,
        a.rejected > 0 && plural(a.rejected, "rechazada", "rechazadas"),
        a.stalled > 0 && `${a.stalled} esperando aprobación hace más de 5 días`,
      ].filter(Boolean);
      const base = plural(a.recent_posts, "publicación reciente", "publicaciones recientes");
      return issues.length ? `${issues.join(" · ")} (de ${base})` : `Sin fricción · ${base}`;
    }
    case "relationship": {
      const r = c.relationship;
      if (!r || r.score == null) return "Sin datos";
      const contract =
        r.contract === "active"
          ? "Contrato vigente"
          : r.contract === "expiring"
            ? "Contrato vence en menos de 30 días"
            : r.contract === "pending"
              ? "Contrato pendiente de firma"
              : r.contract === "expired"
                ? "Contrato vencido"
                : "Sin contrato registrado";
      const activity =
        r.days_since_activity == null
          ? null
          : r.days_since_activity === 0
            ? "actividad hoy"
            : `última actividad hace ${plural(r.days_since_activity, "día", "días")}`;
      return activity ? `${contract} · ${activity}` : contract;
    }
  }
}
