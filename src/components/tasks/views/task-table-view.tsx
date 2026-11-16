import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, ChevronDown, ChevronRight, FileImage, Flag, ListChecks } from "lucide-react";
import { format, isBefore, parseISO, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { TaskBulkBar } from "../task-bulk-bar";
import { fmtTimeOfDay } from "../task-properties";
import { AssigneeAvatars } from "../assignee-avatars";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/empty-state";
import type { Task, TaskPriority, TaskStatus } from "@/hooks/useTasks";
import type { WorkspaceMember } from "@/hooks/useProjects";
import { PRIORITY_LABEL, STATUS_LABEL } from "@/lib/task-labels";
import { STATUS_HEX, STATUS_ORDER, STATUS_PILL } from "@/lib/task-view-colors";
import { usePostsByIds } from "@/hooks/useContentSubtasks";
import { TaskQuickAdd } from "../task-quick-add";
import { useSubtaskCountsMap, useSubtasks } from "@/hooks/useTasks";

export type GroupBy = "status" | "priority" | "assignee" | "project" | "none";

const ROW_GRID = "md:grid-cols-[minmax(240px,2fr)_120px_190px_90px_140px]";

const PRIORITY_FLAG: Record<TaskPriority, string> = {
  p0: "text-destructive",
  p1: "text-orange-500",
  p2: "text-blue-500",
  p3: "text-muted-foreground",
};

interface Props {
  tasks: Task[];
  members: WorkspaceMember[];
  projects?: { id: string; name: string }[];
  onOpen: (id: string) => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onCreate?: (defaults: { status?: TaskStatus }) => void;
  groupBy: GroupBy;
}

function memberName(members: WorkspaceMember[], id: string) {
  const m = members.find((x) => x.user_id === id);
  return m ? m.full_name || m.email || "Miembro" : "Miembro";
}

function DateRange({ task, overdue }: { task: Task; overdue: boolean }) {
  const fmt = (d: string, t: string | null) =>
    format(parseISO(d), "d MMM", { locale: es }) + (t ? ` ${fmtTimeOfDay(t.slice(0, 5))}` : "");
  if (!task.start_date && !task.due_date) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span className={cn("flex items-center gap-1 text-xs", overdue && "font-semibold text-destructive")}>
      {task.start_date ? fmt(task.start_date, task.start_time) : <span className="text-muted-foreground">Inicio</span>}
      <ArrowRight className="h-3 w-3 text-muted-foreground" />
      {task.due_date ? fmt(task.due_date, task.due_time) : <span className="text-muted-foreground">Fin</span>}
    </span>
  );
}

function StatusSelect({
  task,
  onStatusChange,
}: {
  task: Task;
  onStatusChange: (id: string, status: TaskStatus) => void;
}) {
  return (
    <div onClick={(e) => e.stopPropagation()}>
      <Select value={task.status} onValueChange={(v) => onStatusChange(task.id, v as TaskStatus)}>
        <SelectTrigger
          className={cn("h-7 w-full border text-[11px] font-semibold uppercase", STATUS_PILL[task.status])}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUS_ORDER.map((st) => (
            <SelectItem key={st} value={st}>
              {STATUS_LABEL[st]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function TaskRow({
  task,
  members,
  projectMap,
  postTitle,
  subtaskCount,
  depth = 0,
  selected = false,
  anySelected = false,
  onToggleSelect,
  onOpen,
  onStatusChange,
}: {
  task: Task;
  members: WorkspaceMember[];
  projectMap: Record<string, string>;
  postTitle?: string;
  subtaskCount?: { done: number; total: number };
  depth?: number;
  selected?: boolean;
  anySelected?: boolean;
  onToggleSelect?: (id: string) => void;
  onOpen: (id: string) => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const today = startOfDay(new Date());
  const done = task.status === "done";
  const overdue = !!task.due_date && !done && isBefore(parseISO(task.due_date), today);
  const hasSubtasks = depth === 0 && !!subtaskCount && subtaskCount.total > 0;

  return (
    <>
      <div
        onClick={() => onOpen(task.id)}
        className={cn(
          "group grid cursor-pointer grid-cols-1 items-center gap-2 border-b border-border/60 px-2 py-1.5 text-sm transition hover:bg-muted/50 md:min-h-10",
          selected && "bg-primary/10 hover:bg-primary/10",
          ROW_GRID,
        )}
        style={{ paddingLeft: 8 + depth * 24 }}
      >
        <div className="flex min-w-0 items-center gap-1.5">
          {depth === 0 && onToggleSelect ? (
            <div
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "flex w-4 shrink-0 items-center",
                !selected && !anySelected && "opacity-0 group-hover:opacity-100 focus-within:opacity-100",
              )}
            >
              <Checkbox
                checked={selected}
                onCheckedChange={() => onToggleSelect(task.id)}
                aria-label={`Seleccionar ${task.title}`}
              />
            </div>
          ) : (
            <span className="w-4 shrink-0" />
          )}
          <button
            type="button"
            aria-label={expanded ? "Contraer subtareas" : "Ver subtareas"}
            onClick={(e) => {
              e.stopPropagation();
              if (hasSubtasks) setExpanded((v) => !v);
            }}
            className={cn("flex h-5 w-4 shrink-0 items-center justify-center text-muted-foreground", !hasSubtasks && "invisible")}
          >
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            aria-label={done ? "Reabrir" : "Marcar como hecha"}
            onClick={(e) => {
              e.stopPropagation();
              onStatusChange(task.id, done ? "todo" : "done");
            }}
            className={cn(
              "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition",
              done ? "border-emerald-500 bg-emerald-500 text-white" : "border-muted-foreground/50 hover:border-primary",
            )}
          >
            {done && <Check className="h-3 w-3" />}
          </button>
          <span className={cn("truncate font-medium", done && "text-muted-foreground line-through")}>{task.title}</span>
          {hasSubtasks && (
            <span
              className="inline-flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground"
              title="Subtareas"
            >
              <ListChecks className="h-3 w-3" />
              {subtaskCount!.done}/{subtaskCount!.total}
            </span>
          )}
          {postTitle !== undefined && task.related_post_id && (
            <Link
              to={`/app/calendario?post=${task.related_post_id}`}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex max-w-[160px] shrink-0 items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-2 py-0.5 text-[10px] font-medium text-primary hover:bg-primary/10"
            >
              <FileImage className="h-3 w-3 shrink-0" />
              <span className="truncate">{postTitle || "Post"}</span>
            </Link>
          )}
          {task.project_id && depth === 0 && (
            <span className="hidden shrink-0 truncate text-[11px] text-muted-foreground lg:inline lg:max-w-[140px]">
              {projectMap[task.project_id] ?? ""}
            </span>
          )}
          {task.tags.slice(0, 2).map((tag) => (
            <Badge key={tag} variant="outline" className="hidden shrink-0 text-[10px] xl:inline-flex">
              {tag}
            </Badge>
          ))}
        </div>

        <div>
          <AssigneeAvatars ids={task.assignee_ids} members={members} />
        </div>

        <div>
          <DateRange task={task} overdue={overdue} />
        </div>

        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Flag className={cn("h-3.5 w-3.5", PRIORITY_FLAG[task.priority])} />
          {PRIORITY_LABEL[task.priority]}
        </div>

        <StatusSelect task={task} onStatusChange={onStatusChange} />
      </div>
      {expanded && (
        <SubtaskRows
          parentId={task.id}
          members={members}
          projectMap={projectMap}
          depth={depth + 1}
          onOpen={onOpen}
          onStatusChange={onStatusChange}
        />
      )}
    </>
  );
}

function SubtaskRows(props: {
  parentId: string;
  members: WorkspaceMember[];
  projectMap: Record<string, string>;
  depth: number;
  onOpen: (id: string) => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
}) {
  const { parentId, ...rest } = props;
  const { data: subs = [] } = useSubtasks(parentId);
  return (
    <>
      {subs.map((st) => (
        <TaskRow key={st.id} task={st} {...rest} />
      ))}
    </>
  );
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
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Drop selections for tasks that disappeared (deleted, filtered out) and
  // let Escape clear the selection.
  useEffect(() => {
    setSelected((prev) => {
      const ids = new Set(tasks.map((t) => t.id));
      const next = new Set([...prev].filter((id) => ids.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [tasks]);
  useEffect(() => {
    if (selected.size === 0) return;
    const onKey = (e: KeyboardEvent) => {
      // Escape closing an open popover/dialog must not also drop the selection.
      if (e.key !== "Escape" || document.querySelector('[role="dialog"],[role="alertdialog"],[data-radix-popper-content-wrapper]')) return;
      setSelected(new Set());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected.size]);
  const postIds = tasks.map((t) => t.related_post_id).filter((x): x is string => !!x);
  const { data: postMap = {} } = usePostsByIds(postIds);
  const { data: subtaskCounts = {} } = useSubtaskCountsMap(tasks[0]?.workspace_id);
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
        // A task with several assignees shows up in each of their groups.
        if (t.assignee_ids.length === 0) push("unassigned", "Sin asignar", t);
        else for (const id of t.assignee_ids) push(id, memberName(members, id), t);
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

  const workspaceId = tasks[0].workspace_id;
  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  const toggleGroup = (ids: string[]) =>
    setSelected((prev) => {
      const next = new Set(prev);
      const all = ids.every((id) => next.has(id));
      for (const id of ids) all ? next.delete(id) : next.add(id);
      return next;
    });
  const selectedTasks = tasks.filter((t) => selected.has(t.id));

  return (
    <div className="space-y-6">
      {groups.map((group) => {
        const isCollapsed = collapsed[group.key];
        const quickDefaults =
          groupBy === "status"
            ? { status: group.key as TaskStatus }
            : groupBy === "priority"
              ? { priority: group.key as TaskPriority }
              : groupBy === "project"
                ? { project_id: group.key === "none" ? null : group.key }
                : groupBy === "assignee"
                  ? { assignee_ids: group.key === "unassigned" ? [] : [group.key] }
                  : {};
        return (
          <section key={group.key}>
            <div className="mb-1 flex items-center gap-2 px-1">
              <button
                type="button"
                aria-label={isCollapsed ? "Expandir grupo" : "Contraer grupo"}
                onClick={() => setCollapsed((c) => ({ ...c, [group.key]: !c[group.key] }))}
                className="text-muted-foreground hover:text-foreground"
              >
                {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              <Checkbox
                checked={
                  group.tasks.every((t) => selected.has(t.id))
                    ? true
                    : group.tasks.some((t) => selected.has(t.id))
                      ? "indeterminate"
                      : false
                }
                onCheckedChange={() => toggleGroup(group.tasks.map((t) => t.id))}
                aria-label={`Seleccionar todas las tareas de ${group.label}`}
              />
              {groupBy === "status" ? (
                <span
                  className="inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white"
                  style={{ backgroundColor: STATUS_HEX[group.key as TaskStatus] }}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-white/80" />
                  {group.label}
                </span>
              ) : (
                <span className="text-sm font-semibold">{group.label}</span>
              )}
              <span className="text-xs text-muted-foreground">{group.tasks.length}</span>
            </div>

            {!isCollapsed && (
              <div>
                <div
                  className={cn(
                    "hidden gap-2 border-b border-border/60 px-2 pb-1 pl-[74px] text-[11px] font-medium uppercase tracking-wide text-muted-foreground md:grid",
                    ROW_GRID,
                  )}
                >
                  <div>Nombre</div>
                  <div>Asignados</div>
                  <div>Fechas</div>
                  <div>Prioridad</div>
                  <div>Estado</div>
                </div>
                {group.tasks.map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    members={members}
                    projectMap={projectMap}
                    postTitle={t.related_post_id ? postMap[t.related_post_id]?.title ?? "" : undefined}
                    subtaskCount={subtaskCounts[t.id]}
                    selected={selected.has(t.id)}
                    anySelected={selected.size > 0}
                    onToggleSelect={toggleOne}
                    onOpen={onOpen}
                    onStatusChange={onStatusChange}
                  />
                ))}
                <TaskQuickAdd workspaceId={workspaceId} defaults={quickDefaults} />
              </div>
            )}
          </section>
        );
      })}
      {selectedTasks.length > 0 && (
        <TaskBulkBar tasks={selectedTasks} members={members} onClear={() => setSelected(new Set())} />
      )}
    </div>
  );
}
