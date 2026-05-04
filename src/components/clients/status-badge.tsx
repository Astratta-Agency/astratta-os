import { Badge } from "@/components/ui/badge";
import type { ClientStatus } from "@/hooks/useClients";

const map: Record<ClientStatus, { label: string; className: string }> = {
  prospect: { label: "Prospecto", className: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30" },
  active: { label: "Activo", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30" },
  paused: { label: "Pausado", className: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30" },
  churned: { label: "Churned", className: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30" },
};

export function StatusBadge({ status }: { status: ClientStatus }) {
  const m = map[status];
  return (
    <Badge variant="outline" className={m.className}>
      {m.label}
    </Badge>
  );
}
