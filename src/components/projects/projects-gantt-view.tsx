import { useMemo } from "react";
import {
  addDays,
  differenceInCalendarDays,
  eachMonthOfInterval,
  eachWeekOfInterval,
  endOfDay,
  format,
  max as maxDate,
  min as minDate,
  startOfDay,
} from "date-fns";
import { es } from "date-fns/locale";
import { FolderKanban } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { AssignedAvatars } from "@/components/projects/assigned-avatars";
import {
  PROJECT_STATUS_BAR_CLASS,
  PROJECT_STATUS_LABEL,
  ProjectTypeChip,
  effectiveProgress,
} from "@/components/projects/project-meta";
import type { ProjectRow, WorkspaceMember } from "@/hooks/useProjects";

interface Props {
  rows: ProjectRow[];
  members: WorkspaceMember[];
  onOpenProject: (p: ProjectRow) => void;
}

const DAY_WIDTH = 30;
const ROW_HEIGHT = 40;
const LEFT_COL_WIDTH = 240;

export function ProjectsGanttView({ rows, members, onOpenProject }: Props) {
  const withDates = useMemo(
    () => rows.filter((r) => r.start_date && r.end_date),
    [rows],
  );
  const missingCount = rows.length - withDates.length;

  const range = useMemo(() => {
    if (withDates.length === 0) return null;
    const starts = withDates.map((r) => new Date(r.start_date as string));
    const ends = withDates.map((r) => new Date(r.end_date as string));
    const rangeStart = addDays(startOfDay(minDate(starts)), -3);
    const rangeEnd = addDays(endOfDay(maxDate(ends)), 3);
    const totalDays = differenceInCalendarDays(rangeEnd, rangeStart) + 1;
    return { rangeStart, rangeEnd, totalDays };
  }, [withDates]);

  const groups = useMemo(() => {
    const map = new Map<string, { client: ProjectRow["client"]; projects: ProjectRow[] }>();
    for (const p of withDates) {
      const key = p.client_id;
      const g = map.get(key) ?? { client: p.client, projects: [] };
      g.projects.push(p);
      map.set(key, g);
    }
    return Array.from(map.values()).sort((a, b) =>
      (a.client?.name ?? "").localeCompare(b.client?.name ?? ""),
    );
  }, [withDates]);

  if (rows.length === 0 || !range) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
        <FolderKanban className="mb-3 h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {rows.length === 0
            ? "Aún no hay proyectos para este filtro"
            : "Ninguno de los proyectos filtrados tiene fechas definidas"}
        </p>
      </div>
    );
  }

  const { rangeStart, rangeEnd, totalDays } = range;
  const timelineWidth = totalDays * DAY_WIDTH;

  // Ticks: monthly if >90 days, else weekly
  const useMonthlyTicks = totalDays > 90;
  const ticks = useMonthlyTicks
    ? eachMonthOfInterval({ start: rangeStart, end: rangeEnd })
    : eachWeekOfInterval({ start: rangeStart, end: rangeEnd }, { weekStartsOn: 1 });

  const today = new Date();
  const todayOffset = differenceInCalendarDays(today, rangeStart);
  const todayVisible = todayOffset >= 0 && todayOffset <= totalDays;

  const totalRows = groups.reduce((n, g) => n + g.projects.length + 1, 0);
  const chartHeight = totalRows * ROW_HEIGHT;

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border bg-background">
        <div className="relative" style={{ minWidth: LEFT_COL_WIDTH + timelineWidth }}>
          {/* Header row with date ticks */}
          <div
            className="sticky top-0 z-20 flex border-b bg-muted/40"
            style={{ height: 36 }}
          >
            <div
              className="sticky left-0 z-30 shrink-0 border-r bg-muted/40 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              style={{ width: LEFT_COL_WIDTH }}
            >
              Proyecto
            </div>
            <div className="relative shrink-0" style={{ width: timelineWidth }}>
              {ticks.map((t, i) => {
                const offset = differenceInCalendarDays(t, rangeStart);
                if (offset < 0 || offset > totalDays) return null;
                return (
                  <div
                    key={i}
                    className="absolute top-0 h-full border-l border-border/60 pl-1.5 text-[10px] text-muted-foreground"
                    style={{ left: offset * DAY_WIDTH }}
                  >
                    {useMonthlyTicks
                      ? format(t, "LLL yyyy", { locale: es })
                      : format(t, "d MMM", { locale: es })}
                  </div>
                );
              })}
              {todayVisible && (
                <div
                  className="absolute top-0 -translate-x-1/2 rounded bg-destructive px-1.5 py-0.5 text-[10px] font-semibold text-destructive-foreground"
                  style={{ left: todayOffset * DAY_WIDTH }}
                >
                  Hoy
                </div>
              )}
            </div>
          </div>

          {/* Body */}
          <div className="relative flex">
            {/* Left sticky column */}
            <div
              className="sticky left-0 z-10 shrink-0 border-r bg-background"
              style={{ width: LEFT_COL_WIDTH }}
            >
              {groups.map((g) => (
                <div key={g.client?.id ?? "unknown"}>
                  <div
                    className="flex items-center gap-2 border-b bg-muted/30 px-3"
                    style={{ height: ROW_HEIGHT }}
                  >
                    <Avatar className="h-5 w-5">
                      {g.client?.logo_url && (
                        <AvatarImage src={g.client.logo_url} alt={g.client.name} />
                      )}
                      <AvatarFallback className="text-[9px]">
                        {(g.client?.name ?? "?").slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate text-xs font-semibold">
                      {g.client?.name ?? "Sin cliente"}
                    </span>
                  </div>
                  {g.projects.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => onOpenProject(p)}
                      className="flex w-full items-center gap-2 border-b px-3 text-left hover:bg-muted/50"
                      style={{ height: ROW_HEIGHT }}
                    >
                      <span className="min-w-0 flex-1 truncate text-xs font-medium">
                        {p.name}
                      </span>
                      <ProjectTypeChip type={p.type} />
                    </button>
                  ))}
                </div>
              ))}
            </div>

            {/* Timeline area */}
            <div
              className="relative shrink-0"
              style={{ width: timelineWidth, height: chartHeight }}
            >
              {/* Vertical tick lines */}
              {ticks.map((t, i) => {
                const offset = differenceInCalendarDays(t, rangeStart);
                if (offset < 0 || offset > totalDays) return null;
                return (
                  <div
                    key={i}
                    className="absolute top-0 h-full border-l border-muted"
                    style={{ left: offset * DAY_WIDTH }}
                  />
                );
              })}
              {/* Today line */}
              {todayVisible && (
                <div
                  className="absolute top-0 z-10 h-full w-px bg-destructive/70"
                  style={{ left: todayOffset * DAY_WIDTH }}
                />
              )}

              {/* Rows */}
              <TooltipProvider delayDuration={150}>
                {(() => {
                  let rowIndex = 0;
                  return groups.map((g) => {
                    const groupHeaderIndex = rowIndex;
                    rowIndex += 1;
                    return (
                      <div key={g.client?.id ?? "u"}>
                        <div
                          className="absolute left-0 right-0 border-b bg-muted/30"
                          style={{ top: groupHeaderIndex * ROW_HEIGHT, height: ROW_HEIGHT }}
                        />
                        {g.projects.map((p) => {
                          const currentRow = rowIndex;
                          rowIndex += 1;
                          const start = new Date(p.start_date as string);
                          const end = new Date(p.end_date as string);
                          const startOffset = differenceInCalendarDays(start, rangeStart);
                          const duration = Math.max(
                            1,
                            differenceInCalendarDays(end, start) + 1,
                          );
                          const progress = effectiveProgress(
                            p.status,
                            p.start_date,
                            p.end_date,
                            p.progress,
                          );
                          const barLeft = startOffset * DAY_WIDTH;
                          const barWidth = duration * DAY_WIDTH;
                          const showAvatars = barWidth > 100;
                          return (
                            <div
                              key={p.id}
                              className="absolute left-0 right-0 border-b"
                              style={{
                                top: currentRow * ROW_HEIGHT,
                                height: ROW_HEIGHT,
                              }}
                            >
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    onClick={() => onOpenProject(p)}
                                    className={cn(
                                      "absolute top-1.5 flex items-center overflow-hidden rounded px-2 text-left text-xs font-medium shadow-sm ring-1 ring-black/5 hover:brightness-110",
                                      PROJECT_STATUS_BAR_CLASS[p.status],
                                    )}
                                    style={{
                                      left: barLeft,
                                      width: barWidth - 4,
                                      height: ROW_HEIGHT - 12,
                                    }}
                                    title={p.name}
                                  >
                                    {progress != null && progress > 0 && (
                                      <span
                                        className="absolute inset-y-0 left-0 bg-black/20"
                                        style={{ width: `${progress}%` }}
                                      />
                                    )}
                                    <span className="relative z-[1] truncate">
                                      {p.name}
                                    </span>
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <div className="space-y-0.5 text-xs">
                                    <div className="font-semibold">{p.name}</div>
                                    <div className="text-muted-foreground">
                                      {p.client?.name}
                                    </div>
                                    <div>{PROJECT_STATUS_LABEL[p.status]}</div>
                                    <div className="text-muted-foreground">
                                      {format(start, "dd MMM", { locale: es })} –{" "}
                                      {format(end, "dd MMM yyyy", { locale: es })}
                                    </div>
                                    {progress != null && (
                                      <div className="text-muted-foreground">
                                        Progreso: {progress}%
                                      </div>
                                    )}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                              {showAvatars && p.assigned_team_ids.length > 0 && (
                                <div
                                  className="absolute top-1/2 -translate-y-1/2"
                                  style={{ left: barLeft + barWidth + 4 }}
                                >
                                  <AssignedAvatars
                                    ids={p.assigned_team_ids}
                                    members={members}
                                    max={3}
                                    size="sm"
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  });
                })()}
              </TooltipProvider>
            </div>
          </div>
        </div>
      </div>
      {missingCount > 0 && (
        <p className="text-xs text-muted-foreground">
          {missingCount} proyecto{missingCount === 1 ? "" : "s"} sin fechas definidas no
          se muestra{missingCount === 1 ? "" : "n"} aquí.
        </p>
      )}
    </div>
  );
}
