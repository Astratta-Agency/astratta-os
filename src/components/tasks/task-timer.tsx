import { useEffect, useMemo, useState } from "react";
import { parseISO } from "date-fns";
import { Play, Square } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  useStartTimer,
  useStopTimer,
  useTaskTimeEntries,
  type Task,
} from "@/hooks/useTasks";

function fmtDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

interface Props {
  task: Task;
}

export function TaskTimer({ task }: Props) {
  const start = useStartTimer();
  const stop = useStopTimer();
  const { data: entries = [] } = useTaskTimeEntries(task.id);

  const running = !!task.timer_started_at;
  const [nowMs, setNowMs] = useState(Date.now());
  useEffect(() => {
    if (!running) return;
    const iv = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [running]);

  const runningSeconds = useMemo(() => {
    if (!task.timer_started_at) return 0;
    return Math.max(0, Math.floor((nowMs - parseISO(task.timer_started_at).getTime()) / 1000));
  }, [nowMs, task.timer_started_at]);

  const loggedHours = entries.reduce((s, e) => s + Number(e.hours || 0), 0);
  const est = task.estimated_hours ?? 0;
  const pct = est > 0 ? Math.min(100, (loggedHours / est) * 100) : 0;
  const overBudget = est > 0 && loggedHours > est;

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Tiempo</div>
          {running ? (
            <div className="font-mono text-2xl tabular-nums text-primary">
              {fmtDuration(runningSeconds)}
            </div>
          ) : (
            <div className="font-mono text-2xl tabular-nums text-muted-foreground">
              00:00:00
            </div>
          )}
        </div>
        {running ? (
          <Button
            variant="destructive"
            onClick={async () => {
              try {
                await stop.mutateAsync({ taskId: task.id });
                toast.success("Timer detenido");
              } catch (e: any) {
                toast.error("No se pudo detener", { description: e?.message });
              }
            }}
            disabled={stop.isPending}
          >
            <Square className="mr-2 h-4 w-4" /> Detener
          </Button>
        ) : (
          <Button
            onClick={async () => {
              try {
                await start.mutateAsync(task.id);
                toast.success("Timer iniciado");
              } catch (e: any) {
                toast.error("No se pudo iniciar", { description: e?.message });
              }
            }}
            disabled={start.isPending}
          >
            <Play className="mr-2 h-4 w-4" /> Iniciar timer
          </Button>
        )}
      </div>

      <div className="space-y-1">
        <div
          className={cn(
            "flex justify-between text-xs",
            overBudget ? "text-orange-600 dark:text-orange-400" : "text-muted-foreground",
          )}
        >
          <span>
            {loggedHours.toFixed(2)}h registradas
            {est > 0 && ` de ${est}h estimadas`}
          </span>
          {overBudget && <span className="font-medium">Excedido</span>}
        </div>
        {est > 0 && (
          <Progress
            value={pct}
            className={cn("h-1.5", overBudget && "[&>div]:bg-orange-500")}
          />
        )}
      </div>
    </div>
  );
}
