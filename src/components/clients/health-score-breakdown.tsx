import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { useClientHealth } from "@/hooks/useClientDetail";
import { HEALTH_COMPONENTS, HEALTH_LEVEL, describeHealthComponent, healthLevel } from "@/lib/health";
import { HealthScoreDial } from "./health-score-dial";

interface Props {
  clientId: string;
  score: number | null;
}

/** The client's health dial; click it to see what the number is made of. */
export function HealthScoreBreakdown({ clientId, score }: Props) {
  const { data, isLoading, isError } = useClientHealth(clientId);
  const breakdown = data?.breakdown;

  return (
    <Popover>
      <PopoverTrigger
        className="rounded-md outline-none ring-offset-background transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label="Ver desglose del health score"
      >
        <HealthScoreDial score={score} label="Health score" tone="health" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[22rem] max-w-[calc(100vw-2rem)] space-y-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Health score</p>
          <p className="text-xs text-muted-foreground">
            Se calcula solo, a partir de pagos, entregas, aprobaciones y la relación con el cliente.
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : isError || !breakdown ? (
          <p className="text-xs text-muted-foreground">El desglose todavía no está disponible.</p>
        ) : breakdown.reason === "status" ? (
          <p className="text-xs text-muted-foreground">
            Solo se calcula para clientes activos o pausados.
          </p>
        ) : (
          <>
            {breakdown.reason === "no_data" && (
              <p className="text-xs text-muted-foreground">
                Aún no hay facturas, tareas ni contenido suficientes para calcularlo.
              </p>
            )}
            <ul className="space-y-3">
              {HEALTH_COMPONENTS.map(({ key, label }) => {
                const comp = breakdown.components[key];
                const s = comp?.score ?? null;
                const level = s == null ? null : HEALTH_LEVEL[healthLevel(s)];
                return (
                  <li key={key} className="space-y-1">
                    <div className="flex items-baseline justify-between gap-2 text-xs">
                      <span className="font-medium text-foreground">
                        {label}
                        {comp && <span className="ml-1 font-normal text-muted-foreground">· peso {comp.weight}%</span>}
                      </span>
                      <span className={`tabular-nums font-semibold ${level?.text ?? "text-muted-foreground"}`}>
                        {s ?? "—"}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      {level && <div className={`h-full ${level.bar}`} style={{ width: `${s}%` }} />}
                    </div>
                    <p className="text-xs text-muted-foreground">{describeHealthComponent(key, breakdown)}</p>
                  </li>
                );
              })}
            </ul>
            <p className="border-t border-border pt-2 text-[11px] text-muted-foreground">
              Los componentes sin datos no cuentan en el promedio.
              {data?.computed_at &&
                ` Actualizado ${formatDistanceToNow(new Date(data.computed_at), { addSuffix: true, locale: es })}.`}
            </p>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
