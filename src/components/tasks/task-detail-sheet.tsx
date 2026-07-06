import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { useDeleteTask, useTask, useUpdateTask } from "@/hooks/useTasks";
import type { WorkspaceMember } from "@/hooks/useProjects";
import { TaskFormFields, taskFormToDb, type TaskFormValue } from "./task-form-fields";
import { TaskChecklist } from "./task-checklist";
import { TaskComments } from "./task-comments";
import { TaskAttachments } from "./task-attachments";
import { TaskTimer } from "./task-timer";
import { TaskSubtasks } from "./task-subtasks";
import { TaskActivity } from "./task-activity";

interface Props {
  taskId: string | null;
  onClose: () => void;
  workspaceId: string;
  members: WorkspaceMember[];
  clients: { id: string; name: string }[];
  projects: { id: string; name: string }[];
  leads?: { id: string; company_name: string | null; contact_name: string | null }[];
  onOpenTask?: (id: string) => void;
}

export function TaskDetailSheet({
  taskId,
  onClose,
  workspaceId,
  members,
  clients,
  projects,
  leads,
  onOpenTask,
}: Props) {
  const { data: task, isLoading } = useTask(taskId);
  const update = useUpdateTask();
  const del = useDeleteTask();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [form, setForm] = useState<TaskFormValue | null>(null);

  useEffect(() => {
    if (task) {
      setForm({
        title: task.title,
        description: task.description ?? "",
        type: task.type,
        priority: task.priority,
        status: task.status,
        assigned_to: task.assigned_to ?? "none",
        due_date: task.due_date ? parseISO(task.due_date) : undefined,
        estimated_hours: task.estimated_hours != null ? String(task.estimated_hours) : "",
        tags: task.tags,
        project_id: task.project_id ?? "none",
        client_id: task.client_id ?? "none",
        lead_id: task.lead_id ?? "none",
      });
    } else {
      setForm(null);
    }
  }, [task?.id]);

  const patch = (p: Partial<TaskFormValue>) => setForm((f) => (f ? { ...f, ...p } : f));

  const hasChanges = useMemo(() => {
    if (!task || !form) return false;
    const db = taskFormToDb(form);
    return (
      db.title !== task.title ||
      db.description !== task.description ||
      db.type !== task.type ||
      db.priority !== task.priority ||
      db.status !== task.status ||
      db.assigned_to !== task.assigned_to ||
      db.due_date !== task.due_date ||
      db.estimated_hours !== task.estimated_hours ||
      JSON.stringify(db.tags) !== JSON.stringify(task.tags) ||
      db.project_id !== task.project_id ||
      db.client_id !== task.client_id ||
      db.lead_id !== task.lead_id
    );
  }, [form, task]);

  const save = async () => {
    if (!task || !form) return;
    try {
      await update.mutateAsync({ id: task.id, patch: taskFormToDb(form) as any });
      toast.success("Cambios guardados");
    } catch (e: any) {
      toast.error("No se pudo guardar", { description: e?.message });
    }
  };

  const handleDelete = async () => {
    if (!task) return;
    try {
      await del.mutateAsync(task.id);
      toast.success("Tarea eliminada");
      setConfirmDelete(false);
      onClose();
    } catch (e: any) {
      toast.error("No se pudo eliminar", { description: e?.message });
    }
  };

  return (
    <Sheet open={!!taskId} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader className="pb-4">
          <SheetTitle>Detalle de tarea</SheetTitle>
        </SheetHeader>

        {isLoading || !task || !form ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Cargando…</div>
        ) : (
          <div className="space-y-6">
            <TaskTimer task={task} />

            <TaskFormFields
              value={form}
              onChange={patch}
              members={members}
              clients={clients}
              projects={projects}
              leads={leads}
              showStatus
            />

            <div className="flex items-center justify-between gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" /> Eliminar tarea
              </Button>
              <div className="flex gap-2">
                <div className="text-xs text-muted-foreground self-center">
                  Creada {format(parseISO(task.created_at), "dd/MM/yyyy")}
                </div>
                <Button onClick={save} disabled={!hasChanges || update.isPending || !form.title.trim()}>
                  {update.isPending ? "Guardando…" : "Guardar cambios"}
                </Button>
              </div>
            </div>

            <Separator />
            <TaskSubtasks parent={task} members={members} onOpenSubtask={onOpenTask} />
            <Separator />
            <TaskChecklist taskId={task.id} />
            <Separator />
            <TaskAttachments taskId={task.id} workspaceId={workspaceId} />
            <Separator />
            <TaskComments taskId={task.id} members={members} />
            <Separator />
            <TaskActivity
              taskId={task.id}
              members={members}
              clients={clients}
              projects={projects}
              leads={leads}
            />
          </div>
        )}

        <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar tarea?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción no se puede deshacer. Se borrarán checklist, comentarios y adjuntos asociados.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  );
}
