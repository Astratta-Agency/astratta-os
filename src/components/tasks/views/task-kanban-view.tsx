import { useMemo } from "react";
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Plus, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSubtaskCountsMap } from "@/hooks/useTasks";
import type { Task, TaskStatus } from "@/hooks/useTasks";
import type { WorkspaceMember } from "@/hooks/useProjects";
import { PRIORITY_CLASS, PRIORITY_LABEL, STATUS_LABEL } from "@/lib/task-labels";
import { STATUS_DOT, STATUS_HEX, STATUS_ORDER } from "@/lib/task-view-colors";
import { EmptyState } from "@/components/empty-state";

interface Props {
  tasks: Task[];
  members: WorkspaceMember[];
  onOpen: (id: string) => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onCreate?: (defaults: { status?: TaskStatus }) => void;
}

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function KanbanCard({
  task,
  members,
  onOpen,
  subtaskCount,
}: {
  task: Task;
  members: WorkspaceMember[];
  onOpen: (id: string) => void;
  subtaskCount?: { total: number; done: number };
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
  });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;
  const assigned = task.assigned_to ? members.find((m) => m.user_id === task.assigned_to) : null;
  const name = assigned?.full_name || assigned?.email || "";

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => !isDragging && onOpen(task.id)}
      className={cn(
        "cursor-grab select-none rounded-lg border bg-card p-3 shadow-sm transition hover:shadow-md active:cursor-grabbing",
        isDragging && "opacity-60",
      )}
    >
      <div className="mb-2 line-clamp-2 text-sm font-medium">{task.title}</div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge className={cn("rounded text-[10px]", PRIORITY_CLASS[task.priority])}>
          {PRIORITY_LABEL[task.priority]}
        </Badge>
        {task.due_date && (
          <span className="text-[11px] text-muted-foreground">
            {format(parseISO(task.due_date), "dd MMM", { locale: es })}
          </span>
        )}
        {subtaskCount && subtaskCount.total > 0 && (
          <span
            className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
            title="Subtareas"
          >
            <ListChecks className="h-3 w-3" />
            {subtaskCount.done}/{subtaskCount.total}
          </span>
        )}
      </div>
      {assigned && (
        <div className="mt-2 flex items-center gap-2">
          <Avatar className="h-5 w-5">
            {assigned.avatar_url && <AvatarImage src={assigned.avatar_url} />}
            <AvatarFallback className="text-[9px]">{initialsOf(name)}</AvatarFallback>
          </Avatar>
          <span className="truncate text-[11px] text-muted-foreground">{name}</span>
        </div>
      )}
    </div>
  );
}

function KanbanColumn({
  status,
  tasks,
  members,
  onOpen,
  onCreate,
  subtaskCounts,
}: {
  status: TaskStatus;
  tasks: Task[];
  members: WorkspaceMember[];
  onOpen: (id: string) => void;
  onCreate?: (defaults: { status?: TaskStatus }) => void;
  subtaskCounts: Record<string, { total: number; done: number }>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-lg border bg-muted/30 transition",
        isOver && "ring-2 ring-primary/40",
      )}
    >
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <span className={cn("h-2 w-2 rounded-full", STATUS_DOT[status])} />
        <span className="text-sm font-semibold" style={{ color: STATUS_HEX[status] }}>
          {STATUS_LABEL[status]}
        </span>
        <Badge variant="outline" className="ml-auto rounded-full text-[10px]">
          {tasks.length}
        </Badge>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-2">
        {tasks.map((t) => (
          <KanbanCard
            key={t.id}
            task={t}
            members={members}
            onOpen={onOpen}
            subtaskCount={subtaskCounts[t.id]}
          />
        ))}
      </div>
      {onCreate && (
        <button
          type="button"
          onClick={() => onCreate({ status })}
          className="flex items-center justify-center gap-1 border-t px-3 py-2 text-xs font-medium text-muted-foreground transition hover:bg-muted/50 hover:text-foreground"
        >
          <Plus className="h-3.5 w-3.5" /> Agregar tarea
        </button>
      )}
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
            onCreate={onCreate}
            subtaskCounts={subtaskCounts}
          />
        ))}
      </div>
    </DndContext>
  );
}
