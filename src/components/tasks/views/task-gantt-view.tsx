import { useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  differenceInDays,
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { es } from "date-fns/locale";
import { Minus, Plus, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Task } from "@/hooks/useTasks";
import { STATUS_HEX } from "@/lib/task-view-colors";
import { EmptyState } from "@/components/empty-state";

type Scale = "day" | "week" | "month";

interface Props {
  tasks: Task[];
  onOpen: (id: string) => void;
}

const CELL_WIDTHS: Record<Scale, number> = { day: 36, week: 96, month: 140 };

function taskRange(t: Task): { start: Date; end: Date } | null {
  if (!t.due_date) return null;
  const end = parseISO(t.due_date);
  const daysBack = t.estimated_hours ? Math.max(1, Math.round(t.estimated_hours / 8)) : 1;
  const start = addDays(end, -daysBack + 1);
  return { start, end };
}

export function TaskGanttView({ tasks, onOpen }: Props) {
  const [scale, setScale] = useState<Scale>("day");
  const [zoom, setZoom] = useState(1);
  const [anchor, setAnchor] = useState(new Date());

  const scheduled = useMemo(
    () =>
      tasks
        .map((t) => ({ task: t, range: taskRange(t) }))
        .filter((x): x is { task: Task; range: { start: Date; end: Date } } => !!x.range),
    [tasks],
  );

  const bounds = useMemo(() => {
    if (scheduled.length === 0) {
      const s = startOfMonth(anchor);
      return { start: s, end: endOfMonth(s) };
    }
    let min = scheduled[0].range.start;
    let max = scheduled[0].range.end;
    for (const s of scheduled) {
      if (s.range.start < min) min = s.range.start;
      if (s.range.end > max) max = s.range.end;
    }
    return {
      start: addDays(startOfWeek(min, { weekStartsOn: 1 }), -7),
      end: addDays(max, 14),
    };
  }, [scheduled, anchor]);

  const days = useMemo(
    () => eachDayOfInterval({ start: bounds.start, end: bounds.end }),
    [bounds],
  );

  const cellWidth = CELL_WIDTHS[scale] * zoom;
  const totalWidth = days.length * (scale === "day" ? 1 : scale === "week" ? 1 / 7 : 1 / 30) * cellWidth;

  // Header cells depending on scale
  const headerCells = useMemo(() => {
    if (scale === "day") {
      return days.map((d) => ({
        key: d.toISOString(),
        label: format(d, "d", { locale: es }),
        sub: format(d, "EEE", { locale: es }),
        isToday: isSameDay(d, new Date()),
      }));
    }
    if (scale === "week") {
      const weeks: { key: string; label: string; sub: string; isToday: boolean }[] = [];
      let cursor = startOfWeek(bounds.start, { weekStartsOn: 1 });
      while (cursor <= bounds.end) {
        weeks.push({
          key: cursor.toISOString(),
          label: `S${format(cursor, "w")}`,
          sub: format(cursor, "dd MMM", { locale: es }),
          isToday:
            isSameDay(new Date(), cursor) ||
            (new Date() >= cursor && new Date() < addDays(cursor, 7)),
        });
        cursor = addDays(cursor, 7);
      }
      return weeks;
    }
    // month
    const months: { key: string; label: string; sub: string; isToday: boolean }[] = [];
    let cursor = startOfMonth(bounds.start);
    while (cursor <= bounds.end) {
      months.push({
        key: cursor.toISOString(),
        label: format(cursor, "MMM", { locale: es }),
        sub: format(cursor, "yyyy"),
        isToday: isSameMonth(cursor, new Date()),
      });
      cursor = addMonths(cursor, 1);
    }
    return months;
  }, [scale, days, bounds]);

  const totalDays = days.length;
  const chartWidth =
    scale === "day"
      ? totalDays * cellWidth
      : scale === "week"
        ? headerCells.length * cellWidth
        : headerCells.length * cellWidth;

  const dayPx = chartWidth / totalDays;

  const todayOffset = differenceInDays(new Date(), bounds.start) * dayPx;
  const showToday = new Date() >= bounds.start && new Date() <= bounds.end;

  if (scheduled.length === 0) {
    return (
      <EmptyState
        title="Aún no hay tareas con fecha para el Gantt"
        description="Agrega una fecha límite (y opcionalmente horas estimadas) a tus tareas para verlas en la línea de tiempo."
      />
    );
  }

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <Select value={scale} onValueChange={(v) => setScale(v as Scale)}>
          <SelectTrigger className="h-8 w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="day">Días</SelectItem>
            <SelectItem value="week">Semanas</SelectItem>
            <SelectItem value="month">Meses</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
          >
            <Minus className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setZoom((z) => Math.min(2.5, z + 0.25))}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => {
              setZoom(1);
              setAnchor(new Date());
            }}
          >
            <Maximize2 className="mr-1 h-3.5 w-3.5" /> Auto fit
          </Button>
        </div>
      </div>

      <div className="flex overflow-hidden">
        {/* Left sticky column */}
        <div className="w-64 shrink-0 border-r">
          <div className="h-12 border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
            Tarea
          </div>
          {scheduled.map(({ task, range }) => (
            <button
              key={task.id}
              type="button"
              onClick={() => onOpen(task.id)}
              className="flex h-10 w-full flex-col justify-center border-b px-3 text-left text-xs transition hover:bg-muted/40"
            >
              <span className="truncate font-medium">{task.title}</span>
              <span className="truncate text-[10px] text-muted-foreground">
                {format(range.start, "dd MMM", { locale: es })} →{" "}
                {format(range.end, "dd MMM", { locale: es })}
              </span>
            </button>
          ))}
        </div>

        {/* Right scrollable timeline */}
        <div className="relative overflow-x-auto">
          <div style={{ width: chartWidth }}>
            {/* Header */}
            <div className="flex h-12 border-b bg-muted/40">
              {headerCells.map((c) => {
                const w =
                  scale === "day"
                    ? cellWidth
                    : scale === "week"
                      ? cellWidth
                      : cellWidth;
                return (
                  <div
                    key={c.key}
                    style={{ width: w }}
                    className={cn(
                      "flex shrink-0 flex-col items-center justify-center border-r text-[10px] text-muted-foreground",
                      c.isToday && "bg-primary/5 font-semibold text-primary",
                    )}
                  >
                    <span className="font-medium">{c.label}</span>
                    <span className="text-[9px]">{c.sub}</span>
                  </div>
                );
              })}
            </div>

            {/* Rows */}
            <div className="relative">
              {showToday && (
                <div
                  className="pointer-events-none absolute top-0 z-10 h-full w-px bg-primary/50"
                  style={{ left: todayOffset }}
                />
              )}
              {scheduled.map(({ task, range }) => {
                const startOffset = differenceInDays(range.start, bounds.start) * dayPx;
                const width = Math.max(
                  dayPx,
                  (differenceInDays(range.end, range.start) + 1) * dayPx,
                );
                return (
                  <div key={task.id} className="relative h-10 border-b">
                    <button
                      type="button"
                      onClick={() => onOpen(task.id)}
                      className="absolute top-1.5 flex h-7 items-center rounded-md px-2 text-[11px] font-medium text-white shadow-sm transition hover:opacity-90"
                      style={{
                        left: startOffset,
                        width,
                        backgroundColor: STATUS_HEX[task.status],
                      }}
                    >
                      <span className="truncate">{task.title}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
