import { useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, FolderKanban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PROJECT_STATUS_BAR_CLASS } from "@/components/projects/project-meta";
import type { ProjectRow } from "@/hooks/useProjects";

interface Props {
  rows: ProjectRow[];
  onOpenProject: (p: ProjectRow) => void;
}

const WEEKDAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function ProjectChip({
  project,
  onOpen,
}: {
  project: ProjectRow;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      className="group flex w-full items-center gap-1.5 overflow-hidden rounded border border-border bg-background px-1.5 py-1 text-left hover:bg-muted"
      title={`${project.name} — ${project.client?.name ?? ""}`}
    >
      <span
        className={cn(
          "h-full w-1 shrink-0 self-stretch rounded-sm",
          PROJECT_STATUS_BAR_CLASS[project.status].split(" ")[0],
        )}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium leading-tight">
          {project.name}
        </span>
        {project.client?.name && (
          <span className="block truncate text-[10px] leading-tight text-muted-foreground">
            {project.client.name}
          </span>
        )}
      </span>
    </button>
  );
}

export function ProjectsCalendarView({ rows, onOpenProject }: Props) {
  const [anchor, setAnchor] = useState<Date>(new Date());

  const monthLabel = useMemo(() => {
    const s = format(anchor, "LLLL yyyy", { locale: es });
    return s.charAt(0).toUpperCase() + s.slice(1);
  }, [anchor]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(anchor), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(anchor), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [anchor]);

  const { byDay, undated } = useMemo(() => {
    const map = new Map<string, ProjectRow[]>();
    const und: ProjectRow[] = [];
    for (const p of rows) {
      if (!p.end_date) {
        und.push(p);
        continue;
      }
      const key = format(new Date(p.end_date), "yyyy-MM-dd");
      const list = map.get(key) ?? [];
      list.push(p);
      map.set(key, list);
    }
    return { byDay: map, undated: und };
  }, [rows]);

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
        <FolderKanban className="mb-3 h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Aún no hay proyectos para este filtro
        </p>
      </div>
    );
  }

  const today = new Date();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setAnchor(addMonths(anchor, -1))}
          className="h-9 w-9"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setAnchor(new Date())}
          className="h-9"
        >
          Hoy
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setAnchor(addMonths(anchor, 1))}
          className="h-9 w-9"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <span className="ml-3 min-w-[180px] text-sm font-medium">{monthLabel}</span>
      </div>

      {undated.length > 0 && (
        <div className="rounded-lg border bg-muted/30 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Sin fecha límite ({undated.length})
          </p>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {undated.map((p) => (
              <ProjectChip key={p.id} project={p} onOpen={() => onOpenProject(p)} />
            ))}
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border bg-background">
        <div className="grid grid-cols-7 border-b bg-muted/50 text-xs font-medium text-muted-foreground">
          {WEEKDAYS.map((d) => (
            <div key={d} className="p-2 text-center">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const dayProjects = byDay.get(key) ?? [];
            const inMonth = isSameMonth(day, anchor);
            const isToday = isSameDay(day, today);
            const visible = dayProjects.slice(0, 3);
            const extra = dayProjects.length - visible.length;
            return (
              <div
                key={key}
                className={cn(
                  "min-h-[110px] border-b border-r p-1.5 last:border-r-0",
                  !inMonth && "bg-muted/20 text-muted-foreground",
                )}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span
                    className={cn(
                      "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs",
                      isToday && "bg-primary text-primary-foreground font-semibold",
                    )}
                  >
                    {format(day, "d")}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  {visible.map((p) => (
                    <ProjectChip
                      key={p.id}
                      project={p}
                      onOpen={() => onOpenProject(p)}
                    />
                  ))}
                  {extra > 0 && (
                    <span className="px-1 text-[10px] text-muted-foreground">
                      +{extra} más
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
