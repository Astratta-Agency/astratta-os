import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ProjectsStats } from "@/hooks/useProjects";

interface Props {
  stats: ProjectsStats | undefined;
  loading?: boolean;
  activeFilter?: string | null;
  onSelect: (key: "all-active" | "in_progress" | "paused" | "delivered-month" | "overdue") => void;
  onClear?: () => void;
  filtersActive?: boolean;
}

const CARDS: {
  key: "all-active" | "in_progress" | "paused" | "delivered-month" | "overdue";
  label: string;
  pick: (s: ProjectsStats) => number;
  danger?: boolean;
}[] = [
  { key: "all-active", label: "Total activos", pick: (s) => s.totalActive },
  { key: "in_progress", label: "En ejecución", pick: (s) => s.inProgress },
  { key: "paused", label: "Pausados", pick: (s) => s.paused },
  { key: "delivered-month", label: "Entregados este mes", pick: (s) => s.deliveredThisMonth },
  { key: "overdue", label: "Vencidos", pick: (s) => s.overdue, danger: true },
];

export function ProjectsKpiBar({ stats, loading, activeFilter, onSelect, onClear, filtersActive }: Props) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-5">
        {CARDS.map((c) => {
          const value = stats ? c.pick(stats) : 0;
          const highlightDanger = c.danger && value > 0;
          const active = activeFilter === c.key;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => onSelect(c.key)}
              className="text-left"
            >
              <Card
                className={cn(
                  "p-4 transition hover:border-primary/60 hover:shadow-sm",
                  active && "border-primary ring-1 ring-primary/30",
                  highlightDanger && "border-destructive/60 bg-destructive/5",
                )}
              >
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{c.label}</p>
                <p
                  className={cn(
                    "mt-1 text-2xl font-semibold tabular-nums",
                    highlightDanger && "text-destructive",
                  )}
                >
                  {loading ? "—" : value}
                </p>
              </Card>
            </button>
          );
        })}
      </div>
      {filtersActive && onClear && (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={onClear}>
            Limpiar filtros
          </Button>
        </div>
      )}
    </div>
  );
}
