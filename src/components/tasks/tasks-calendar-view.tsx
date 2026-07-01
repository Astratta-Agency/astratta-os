import { useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Task } from "@/hooks/useTasks";
import { PRIORITY_CLASS, PRIORITY_LABEL } from "@/lib/task-labels";

interface Props {
  tasks: Task[];
  onOpen: (id: string) => void;
}

export function TasksCalendarView({ tasks, onOpen }: Props) {
  const [anchor, setAnchor] = useState(new Date());
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [anchor]);

  const byDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      if (!t.due_date) continue;
      const key = t.due_date;
      map.set(key, [...(map.get(key) ?? []), t]);
    }
    return map;
  }, [tasks]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold capitalize">
          {format(anchor, "MMMM yyyy", { locale: es })}
        </h2>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={() => setAnchor((d) => addMonths(d, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAnchor(new Date())}>
            Hoy
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAnchor((d) => addMonths(d, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border bg-border text-xs">
        {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
          <div key={d} className="bg-background px-2 py-1 text-center font-medium text-muted-foreground">
            {d}
          </div>
        ))}
        {days.map((d) => {
          const key = format(d, "yyyy-MM-dd");
          const items = byDay.get(key) ?? [];
          const isCurrentMonth = isSameMonth(d, anchor);
          const isToday = isSameDay(d, new Date());
          return (
            <div
              key={key}
              className={cn(
                "min-h-24 bg-background p-1.5",
                !isCurrentMonth && "bg-muted/30 text-muted-foreground",
              )}
            >
              <div
                className={cn(
                  "mb-1 text-right text-[11px] font-medium",
                  isToday && "text-primary",
                )}
              >
                {format(d, "d")}
              </div>
              <div className="space-y-1">
                {items.slice(0, 4).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onOpen(t.id)}
                    className="flex w-full items-center gap-1 truncate rounded bg-muted/50 px-1 py-0.5 text-left text-[11px] hover:bg-muted"
                  >
                    <Badge className={cn("h-4 px-1 text-[9px]", PRIORITY_CLASS[t.priority])}>
                      {PRIORITY_LABEL[t.priority]}
                    </Badge>
                    <span className="truncate">{t.title}</span>
                  </button>
                ))}
                {items.length > 4 && (
                  <div className="text-[10px] text-muted-foreground">+{items.length - 4} más</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Bridge to keep unused imports honest
export const __x = { parseISO };
