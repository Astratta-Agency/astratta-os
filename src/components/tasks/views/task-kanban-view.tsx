import { AssigneeAvatars } from "../assignee-avatars";
import { useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { format, isBefore, parseISO, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarDays, Check, ChevronDown, ChevronRight, Flag, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useSubtaskCountsMap, useSubtasks } from "@/hooks/useTasks";
import type { Task, TaskPriority, TaskStatus } from "@/hooks/useTasks";
import type { WorkspaceMember } from "@/hooks/useProjects";
import { PRIORITY_LABEL, STATUS_LABEL } from "@/lib/task-labels";
import { STATUS_HEX, STATUS_ORDER } from "@/lib/task-view-colors";
import { TaskQuickAdd } from "../task-quick-add";
import { fmtTimeOfDay } from "../task-properties";
import { EmptyState } from "@/components/empty-state";

interface Props {
  tasks: Task[];
  members: WorkspaceMember[];
  onOpen: (id: string) => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onCreate?: (defaults: { status?: TaskStatus }) => void;
}

const PRIORITY_FLAG: Record<TaskPriority, string> = {
  p0: "text-destructive",
  p1: "text-orange-500",
  p2: "text-blue-500",
  p3: "text-muted-foreground",
};

function MetaRow({ task, members }: { task: Task; members: WorkspaceMember[] }) {
  const done = task.status === "done";
  const overdue = !!task.due_date && !done && isBefore(parseISO(task.due_date), startOfDay(new Date()));
  const fmt = (d: string, t?: string | null) =>
    format(parseISO(d), "d MMM", { locale: es }) + (t ? ` ${fmtTimeOfDay(t.slice(0, 5))}` : "");
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-muted-foreground">
      {task.assignee_ids.length > 0 && <AssigneeAvatars ids={task.assignee_ids} members={members} />}
      {(task.start_date || task.due_date) && (
        <span className={cn("inline-flex items-center gap-1", overdue && "font-semibold text-destructive")}>
          <CalendarDays className="h-3 w-3" />
          {task.start_date && task.due_date
            ? `${fmt(task.start_date, task.start_time)} → ${fmt(task.due_date, task.due_time)}`
            : task.due_date
              ? fmt(task.due_date, task.due_time)
              : fmt(task.start_date!, task.start_time)}
        </span>
      )}
      <span className="inline-flex items-center gap-1" title={PRIORITY_LABEL[task.priority]}>
        <Flag className={cn("h-3 w-3", PRIORITY_FLAG[task.priority])} />
        {PRIORITY_LABEL[task.priority]}
      </span>
    </div>
  );
}

/** Smaller, non-draggable card for a subtask, nested under its parent card. */
function SubtaskCard({
  task,
  members,
  onOpen,
  onStatusChange,
}: {
  task: Task;
  members: WorkspaceMember[];
  onOpen: (id: string) => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
}) {
  const done = task.status === "done";
  return (
    <div
      onClick={() => onOpen(task.id)}
      className="cursor-pointer rounded-lg border bg-card/70 p-2.5 transition hover:border-primary/40"
    >
      <div className="mb-1.5 flex items-start gap-2">
        <button
          type="button"
          aria-label={done ? "Reabrir" : "Marcar como hecha"}
          onClick={(e) => {
            e.stopPropagation();
            onStatusChange(task.id, done ? "todo" : "done");
          }}
          className={cn(
            "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition",
            done ? "border-emerald-500 bg-emerald-500 text-white" : "border-muted-foreground/50 hover:border-primary",
          )}
        >
          {done && <Check className="h-3 w-3" />}
        </button>
        <span className={cn("line-clamp-2 text-xs font-medium", done && "text-muted-foreground line-through")}>
          {task.title}
        </span>
      </div>
      <MetaRow task={task} members={members} />
    </div>
  );
}

function KanbanCard({
  task,
  members,
  onOpen,
  onStatusChange,
  subtaskCount,
}: {
  task: Task;
  members: WorkspaceMember[];
  onOpen: (id: string) => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
  subtaskCount?: { total: number; done: number };
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
  });
  const [expanded, setExpanded] = useState(false);
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;
  const done = task.status === "done";
  const total = subtaskCount?.total ?? 0;

  return (
    <div ref={setNodeRef} style={style} className={cn("space-y-1.5", isDragging && "opacity-60")}>
      <div
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        onClick={() => !isDragging && onOpen(task.id)}
        className="cursor-grab select-none rounded-lg border bg-card p-3 shadow-sm transition hover:border-primary/40 hover:shadow-md active:cursor-grabbing"
      >
        <div className={cn("mb-2 line-clamp-3 text-sm font-medium leading-snug", done && "text-muted-foreground line-through")}>
          {task.title}
        </div>

        {task.tags.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1">
            {task.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary" className="px-1.5 text-[10px] font-normal">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        <MetaRow task={task} members={members} />

        {total > 0 && (
          <button
            type="button"
            aria-expanded={expanded}
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((v) => !v);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="mt-2 inline-flex items-center gap-1.5 rounded px-1 py-0.5 text-[11px] text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            <ListChecks className="h-3 w-3" />
            {subtaskCount!.done}/{total} {total === 1 ? "subtarea" : "subtareas"}
          </button>
        )}
      </div>

      {expanded && (
        <SubtaskList parentId={task.id} members={members} onOpen={onOpen} onStatusChange={onStatusChange} />
      )}
    </div>
  );
}

function SubtaskList(props: {
  parentId: string;
  members: WorkspaceMember[];
  onOpen: (id: string) => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
}) {
  const { parentId, ...rest } = props;
  const { data: subs = [], isLoading } = useSubtasks(parentId);
  return (
    <div className="ml-4 space-y-1.5">
      {isLoading && <div className="px-2 py-1 text-[11px] text-muted-foreground">Cargando…</div>}
      {subs.map((st) => (
        <SubtaskCard key={st.id} task={st} {...rest} />
      ))}
    </div>
  );
}

function KanbanColumn({
  status,
  tasks,
  members,
  onOpen,
  onStatusChange,
  workspaceId,
  subtaskCounts,
}: {
  status: TaskStatus;
  tasks: Task[];
  members: WorkspaceMember[];
  onOpen: (id: string) => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
  workspaceId: string;
  subtaskCounts: Record<string, { total: number; done: number }>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-xl bg-muted/30 transition",
        isOver && "ring-2 ring-primary/40",
      )}
    >
      <div className="flex items-center gap-2 px-3 py-2.5">
        <span
          className="inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white"
          style={{ backgroundColor: STATUS_HEX[status] }}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-white/80" />
          {STATUS_LABEL[status]}
        </span>
        <span className="text-xs text-muted-foreground">{tasks.length}</span>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto px-2 pb-1">
        {tasks.map((t) => (
          <KanbanCard
            key={t.id}
            task={t}
            members={members}
            onOpen={onOpen}
            onStatusChange={onStatusChange}
            subtaskCount={subtaskCounts[t.id]}
          />
        ))}
      </div>
      <TaskQuickAdd workspaceId={workspaceId} defaults={{ status }} />
    </div>
  );
}

export function TaskKanbanView({
  tasks,
  members,
  onOpen,
  onStatusChange,
  onCreate,
}: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const { data: subtaskCounts = {} } = useSubtaskCountsMap(tasks[0]?.workspace_id);
  const grouped = useMemo(() => {
    const g: Record<TaskStatus, Task[]> = { todo: [], doing: [], review: [], done: [] };
    for (const t of tasks) g[t.status].push(t);
    return g;
  }, [tasks]);

  const handleDragEnd = (e: DragEndEvent) => {
    if (!e.over) return;
    const newStatus = e.over.id as TaskStatus;
    const task = tasks.find((t) => t.id === e.active.id);
    if (task && task.status !== newStatus) onStatusChange(task.id, newStatus);
  };

  if (tasks.length === 0) {
    return (
      <EmptyState
        title="Aún no hay tareas en el tablero"
        description="Crea una tarea para verla aquí distribuida por estado."
      />
    );
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {STATUS_ORDER.map((s) => (
          <KanbanColumn
            key={s}
            status={s}
            tasks={grouped[s]}
            members={members}
            onOpen={onOpen}
            onStatusChange={onStatusChange}
            workspaceId={tasks[0].workspace_id}
            subtaskCounts={subtaskCounts}
          />
        ))}
      </div>
    </DndContext>
  );
}
