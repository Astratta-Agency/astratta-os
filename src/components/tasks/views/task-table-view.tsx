import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Plus, FileImage, ListChecks } from "lucide-react";
import { format, isBefore, parseISO, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/empty-state";
import type { Task, TaskStatus } from "@/hooks/useTasks";
import type { WorkspaceMember } from "@/hooks/useProjects";
import { PRIORITY_CLASS, PRIORITY_LABEL, STATUS_LABEL } from "@/lib/task-labels";
import { STATUS_DOT, STATUS_ORDER, STATUS_PILL } from "@/lib/task-view-colors";
import { usePostsByIds } from "@/hooks/useContentSubtasks";

export type GroupBy = "status" | "priority" | "assignee" | "project" | "none";

interface Props {
  tasks: Task[];
  members: WorkspaceMember[];
  projects?: { id: string; name: string }[];
  onOpen: (id: string) => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onCreate?: (defaults: { status?: TaskStatus }) => void;
  groupBy: GroupBy;
}

function memberInfo(members: WorkspaceMember[], id: string | null) {
  if (!id) return null;
  const m = members.find((x) => x.user_id === id);
  if (!m) return null;
  const name = m.full_name || m.email || "Miembro";
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return { name, initials, avatar: m.avatar_url };
}

export function TaskTableView({
  tasks,
  members,
  projects = [],
  onOpen,
  onStatusChange,
  onCreate,
  groupBy,
}: Props) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const postIds = tasks.map((t) => t.related_post_id).filter((x): x is string => !!x);
  const { data: postMap = {} } = usePostsByIds(postIds);
  const projectMap = useMemo(
    () => Object.fromEntries(projects.map((p) => [p.id, p.name])),
    [projects],
  );

  const groups = useMemo(() => {
    if (groupBy === "none") return [{ key: "all", label: "Todas las tareas", color: "#94a3b8", tasks }];
    const g = new Map<string, { key: string; label: string; color?: string; tasks: Task[] }>();
    const push = (k: string, label: string, t: Task, color?: string) => {
      if (!g.has(k)) g.set(k, { key: k, label, color, tasks: [] });
      g.get(k)!.tasks.push(t);
    };
    for (const t of tasks) {
      if (groupBy === "status") {
        push(t.status, STATUS_LABEL[t.status], t);
      } else if (groupBy === "priority") {
        push(t.priority, PRIORITY_LABEL[t.priority], t);
      } else if (groupBy === "assignee") {
        const m = memberInfo(members, t.assigned_to);
        push(t.assigned_to ?? "unassigned", m?.name ?? "Sin asignar", t);
      } else if (groupBy === "project") {
        push(t.project_id ?? "none", t.project_id ? projectMap[t.project_id] ?? "Proyecto" : "Sin proyecto", t);
      }
    }
    if (groupBy === "status") {
      return STATUS_ORDER.filter((s) => g.has(s)).map((s) => g.get(s)!);
    }
    return Array.from(g.values());
  }, [tasks, groupBy, members, projectMap]);

  if (tasks.length === 0) {
    return (
      <EmptyState
        title="Aún no hay tareas para mostrar"
        description="Crea tu primera tarea para empezar a hacer seguimiento."
      />
    );
  }

  const today = startOfDay(new Date());

  return (
    <div className="space-y-3">
      {groups.map((group) => {
        const isCollapsed = collapsed[group.key];
        return (
          <div key={group.key} className="overflow-hidden rounded-lg border bg-card">
            <button
              type="button"
              onClick={() => setCollapsed((c) => ({ ...c, [group.key]: !c[group.key] }))}
              className="flex w-full items-center gap-2 border-b bg-muted/40 px-3 py-2 text-left transition hover:bg-muted"
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
              {groupBy === "status" && (
                <span
                  className={cn("h-2 w-2 rounded-full", STATUS_DOT[group.key as TaskStatus])}
                />
              )}
              <span className="text-sm font-semibold">{group.label}</span>
              <Badge variant="outline" className="rounded-full text-[10px]">
                {group.tasks.length}
              </Badge>
            </button>

            {!isCollapsed && (
              <div className="divide-y">
                <div className="hidden grid-cols-[minmax(240px,2fr)_140px_100px_180px_140px_150px] gap-2 border-b bg-muted/20 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground md:grid">
                  <div>Tarea</div>
                  <div>Responsable</div>
                  <div>Prioridad</div>
                  <div>Cliente / Proyecto</div>
                  <div>Fecha límite</div>
                  <div>Status</div>
                </div>
                {group.tasks.map((t) => {
                  const assigned = memberInfo(members, t.assigned_to);
                  const overdue =
                    t.due_date && t.status !== "done"
                      ? isBefore(parseISO(t.due_date), today)
                      : false;
                  return (
                    <div
                      key={t.id}
                      onClick={() => onOpen(t.id)}
                      className="grid cursor-pointer grid-cols-1 gap-2 px-3 py-2 text-sm transition hover:bg-muted/40 md:grid-cols-[minmax(240px,2fr)_140px_100px_180px_140px_150px] md:items-center"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium">{t.title}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          {t.related_post_id && postMap[t.related_post_id] && (
                            <Link
                              to={`/app/calendario?post=${t.related_post_id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex max-w-[220px] items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-2 py-0.5 text-[10px] font-medium text-primary hover:bg-primary/10"
                            >
                              <FileImage className="h-3 w-3 shrink-0" />
                              <span className="truncate">
                                {postMap[t.related_post_id].title || "Post"}
                              </span>
                            </Link>
                          )}
                          {t.tags.slice(0, 3).map((tag) => (
                            <Badge key={tag} variant="outline" className="text-[10px]">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <div>
                        {assigned ? (
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              {assigned.avatar && (
                                <AvatarImage src={assigned.avatar} alt={assigned.name} />
                              )}
                              <AvatarFallback className="text-[10px]">
                                {assigned.initials}
                              </AvatarFallback>
                            </Avatar>
                            <span className="truncate text-xs">{assigned.name}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Sin asignar</span>
                        )}
                      </div>

                      <div>
                        <Badge className={cn("rounded", PRIORITY_CLASS[t.priority])}>
                          {PRIORITY_LABEL[t.priority]}
                        </Badge>
                      </div>

                      <div className="truncate text-xs text-muted-foreground">
                        {t.project_id
                          ? projectMap[t.project_id] ?? "Proyecto"
                          : "—"}
                      </div>

                      <div>
                        {t.due_date ? (
                          <span
                            className={cn(
                              "text-xs",
                              overdue && "font-semibold text-destructive",
                            )}
                          >
                            {format(parseISO(t.due_date), "dd MMM yyyy", { locale: es })}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>

                      <div onClick={(e) => e.stopPropagation()}>
                        <Select
                          value={t.status}
                          onValueChange={(v) => onStatusChange(t.id, v as TaskStatus)}
                        >
                          <SelectTrigger
                            className={cn(
                              "h-8 w-full border text-xs font-medium",
                              STATUS_PILL[t.status],
                            )}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_ORDER.map((s) => (
                              <SelectItem key={s} value={s}>
                                {STATUS_LABEL[s]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  );
                })}

                {onCreate && (
                  <button
                    type="button"
                    onClick={() =>
                      onCreate(groupBy === "status" ? { status: group.key as TaskStatus } : {})
                    }
                    className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground transition hover:bg-muted/40 hover:text-foreground"
                  >
                    <Plus className="h-3.5 w-3.5" /> Agregar tarea
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
