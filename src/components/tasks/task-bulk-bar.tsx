import { useState, type ReactNode } from "react";
import { format } from "date-fns";
import { CalendarDays, Check, CircleDot, Flag, Tag, Trash2, Users, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Task, TaskPriority, TaskStatus } from "@/hooks/useTasks";
import { useDeleteTask, useUpdateTask } from "@/hooks/useTasks";
import type { WorkspaceMember } from "@/hooks/useProjects";
import { PRIORITY_LABEL, STATUS_LABEL } from "@/lib/task-labels";
import { STATUS_ORDER } from "@/lib/task-view-colors";
import { memberDisplay } from "./assignee-avatars";

const PRIORITY_FLAG: Record<TaskPriority, string> = {
  p0: "text-destructive",
  p1: "text-orange-500",
  p2: "text-blue-500",
  p3: "text-muted-foreground",
};

function BarAction({
  icon,
  label,
  children,
  width = "w-52",
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
  width?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2.5 text-xs [&_svg]:h-3.5 [&_svg]:w-3.5">
          {icon}
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="center" className={cn("p-1", width)}>
        {children}
      </PopoverContent>
    </Popover>
  );
}

const optionCls = "flex w-full items-center justify-between gap-3 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted";

interface Props {
  /** Selected top-level tasks. */
  tasks: Task[];
  members: WorkspaceMember[];
  onClear: () => void;
}

/** Floating bar with bulk actions for the selected tasks of the list view. */
export function TaskBulkBar({ tasks, members, onClear }: Props) {
  const update = useUpdateTask();
  const del = useDeleteTask();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [dateField, setDateField] = useState<"start_date" | "due_date">("due_date");
  const [tag, setTag] = useState("");
  const busy = update.isPending || del.isPending;

  /** Applies `patchFor(task)` to every selected task; reports partial failures. */
  const applyAll = async (patchFor: (t: Task) => Partial<Task> | null, ok: string) => {
    const results = await Promise.allSettled(
      tasks.map((t) => {
        const patch = patchFor(t);
        return patch ? update.mutateAsync({ id: t.id, patch }) : Promise.resolve(null);
      }),
    );
    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed) toast.error(`No se pudieron actualizar ${failed} de ${tasks.length} tareas`);
    else toast.success(ok);
  };

  const toggleAssignee = (userId: string) => {
    const everyone = tasks.every((t) => t.assignee_ids.includes(userId));
    return applyAll(
      (t) => ({
        assignee_ids: everyone
          ? t.assignee_ids.filter((x) => x !== userId)
          : Array.from(new Set([...t.assignee_ids, userId])),
      }),
      "Asignados actualizados",
    );
  };

  const setDate = (d: Date | undefined) =>
    applyAll(
      (t) => {
        const iso = d ? format(d, "yyyy-MM-dd") : null;
        const patch: Partial<Task> = { [dateField]: iso };
        // A time is only valid with its date.
        if (!iso) patch[dateField === "start_date" ? "start_time" : "due_time"] = null;
        // Keep start <= due: the other end follows the one just picked.
        if (iso && dateField === "start_date" && t.due_date && iso > t.due_date) patch.due_date = iso;
        if (iso && dateField === "due_date" && t.start_date && iso < t.start_date) patch.start_date = iso;
        return patch;
      },
      "Fechas actualizadas",
    );

  const addTag = () => {
    const v = tag.trim();
    setTag("");
    if (!v) return;
    applyAll((t) => (t.tags.includes(v) ? null : { tags: [...t.tags, v] }), "Etiqueta agregada");
  };

  const handleDelete = async () => {
    const results = await Promise.allSettled(tasks.map((t) => del.mutateAsync(t.id)));
    const failed = results.filter((r) => r.status === "rejected").length;
    setConfirmDelete(false);
    if (failed) toast.error(`No se pudieron eliminar ${failed} de ${tasks.length} tareas`);
    else toast.success(tasks.length === 1 ? "Tarea eliminada" : `${tasks.length} tareas eliminadas`);
    onClear();
  };

  const n = tasks.length;
  return (
    <>
      <div
        role="toolbar"
        aria-label="Acciones para las tareas seleccionadas"
        className={cn(
          "fixed bottom-6 left-1/2 z-40 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-wrap items-center gap-1 rounded-xl border bg-popover px-2 py-1.5 shadow-lg",
          busy && "pointer-events-none opacity-70",
        )}
      >
        <div className="mr-1 flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium">
          {n} {n === 1 ? "tarea seleccionada" : "tareas seleccionadas"}
          <button type="button" aria-label="Limpiar selección" onClick={onClear} className="ml-1 text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <BarAction icon={<CircleDot />} label="Estado">
          {STATUS_ORDER.map((s: TaskStatus) => (
            <button key={s} type="button" className={optionCls} onClick={() => applyAll(() => ({ status: s }), "Estado actualizado")}>
              {STATUS_LABEL[s]}
              {tasks.every((t) => t.status === s) && <Check className="h-4 w-4 text-primary" />}
            </button>
          ))}
        </BarAction>

        <BarAction icon={<Users />} label="Asignados" width="w-60">
          <div className="max-h-64 overflow-y-auto">
            {members.map((m) => {
              const d = memberDisplay(members, m.user_id);
              const all = tasks.every((t) => t.assignee_ids.includes(m.user_id));
              return (
                <button key={m.user_id} type="button" className={optionCls} onClick={() => toggleAssignee(m.user_id)}>
                  <span className="truncate">{d.name}</span>
                  {all && <Check className="h-4 w-4 text-primary" />}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            className={cn(optionCls, "mt-1 border-t text-muted-foreground")}
            onClick={() => applyAll(() => ({ assignee_ids: [] }), "Asignados quitados")}
          >
            Quitar todos los asignados
          </button>
        </BarAction>

        <BarAction icon={<CalendarDays />} label="Fechas" width="w-auto">
          <div className="flex gap-1 p-1">
            {(["start_date", "due_date"] as const).map((f) => (
              <Button
                key={f}
                size="sm"
                variant={dateField === f ? "secondary" : "ghost"}
                className="h-7 flex-1 text-xs"
                onClick={() => setDateField(f)}
              >
                {f === "start_date" ? "Inicio" : "Fin"}
              </Button>
            ))}
          </div>
          <Calendar mode="single" onSelect={setDate} className="pointer-events-auto p-3" />
          <button type="button" className={cn(optionCls, "border-t text-muted-foreground")} onClick={() => setDate(undefined)}>
            Quitar {dateField === "start_date" ? "fecha de inicio" : "fecha de fin"}
          </button>
        </BarAction>

        <BarAction icon={<Flag />} label="Prioridad">
          {(["p0", "p1", "p2", "p3"] as TaskPriority[]).map((p) => (
            <button key={p} type="button" className={optionCls} onClick={() => applyAll(() => ({ priority: p }), "Prioridad actualizada")}>
              <span className="flex items-center gap-2">
                <Flag className={cn("h-4 w-4", PRIORITY_FLAG[p])} />
                {PRIORITY_LABEL[p]}
              </span>
              {tasks.every((t) => t.priority === p) && <Check className="h-4 w-4 text-primary" />}
            </button>
          ))}
        </BarAction>

        <BarAction icon={<Tag />} label="Etiquetas" width="w-56">
          <Input
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTag()}
            placeholder="Agregar etiqueta y Enter"
            className="h-8 text-xs"
            maxLength={40}
          />
        </BarAction>

        <div className="mx-1 h-5 w-px bg-border" />
        <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2.5 text-xs text-destructive hover:text-destructive" onClick={() => setConfirmDelete(true)}>
          <Trash2 className="h-3.5 w-3.5" /> Eliminar
        </Button>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar {n === 1 ? "la tarea" : `${n} tareas`}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se borrarán también sus subtareas, checklist, comentarios y adjuntos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
