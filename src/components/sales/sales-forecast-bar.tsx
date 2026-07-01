import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, Trophy } from "lucide-react";
import type { LeadRow } from "@/hooks/useSales";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function isSameMonth(iso: string | null, now: Date): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

export function SalesForecastBar({ leads }: { leads: LeadRow[] }) {
  const { forecast, undatedForecast, wonThisMonth, wonCount } = useMemo(() => {
    const now = new Date();
    let forecast = 0;
    let undatedForecast = 0;
    let wonThisMonth = 0;
    let wonCount = 0;
    for (const l of leads) {
      if (l.stage === "ganado") {
        if (isSameMonth(l.updated_at, now)) {
          wonThisMonth += Number(l.estimated_value ?? 0);
          wonCount += 1;
        }
      } else if (l.stage !== "perdido") {
        const weighted = Number(l.estimated_value ?? 0) * (Number(l.probability ?? 0) / 100);
        if (l.expected_close_date) {
          if (isSameMonth(l.expected_close_date, now)) forecast += weighted;
        } else {
          undatedForecast += weighted;
        }
      }
    }
    return { forecast, undatedForecast, wonThisMonth, wonCount };
  }, [leads]);

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <Card>
        <CardContent className="flex items-center gap-3 p-4">
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Forecast este mes</p>
            <p className="text-xl font-semibold">{usd.format(forecast)}</p>
            <p className="text-[11px] text-muted-foreground">Ponderado por probabilidad</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex items-center gap-3 p-4">
          <div className="rounded-lg bg-muted p-2 text-muted-foreground">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Sin fecha de cierre</p>
            <p className="text-xl font-semibold">{usd.format(undatedForecast)}</p>
            <p className="text-[11px] text-muted-foreground">Leads activos sin `expected_close_date`</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex items-center gap-3 p-4">
          <div className="rounded-lg bg-secondary/15 p-2" style={{ color: "#ff7503" }}>
            <Trophy className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Ganado este mes</p>
            <p className="text-xl font-semibold">{usd.format(wonThisMonth)}</p>
            <p className="text-[11px] text-muted-foreground">{wonCount} lead{wonCount === 1 ? "" : "s"} cerrado{wonCount === 1 ? "" : "s"}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
