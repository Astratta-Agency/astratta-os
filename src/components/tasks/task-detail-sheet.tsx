import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { Activity, FileText, MessageSquare, MoreHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { taskFormToDb, type TaskFormValue } from "./task-form-fields";
import { TaskProperties } from "./task-properties";
import { TaskChecklist } from "./task-checklist";
import { TaskComments } from "./task-comments";
import { TaskAttachments } from "./task-attachments";
import { TaskTimer } from "./task-timer";
import { TaskSubtasks } from "./task-subtasks";
import { TaskActivity } from "./task-activity";

type View = "details" | "comments" | "activity";
const RAIL = [
  { id: "details", label: "Detalles", Icon: FileText },
  { id: "comments", label: "Comentarios", Icon: MessageSquare },
  { id: "activity", label: "Actividad", Icon: Activity },
] as const;

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
  const [view, setView] = useState<View>("details");

  useEffect(() => {
    if (task) {
      setForm({
        title: task.title,
        description: task.description ?? "",
        type: task.type,
        priority: task.priority,
        status: task.status,
        assignee_ids: task.assignee_ids,
        start_date: task.start_date ? parseISO(task.start_date) : undefined,
        start_time: task.start_time ? task.start_time.slice(0, 5) : "",
        due_time: task.due_time ? task.due_time.slice(0, 5) : "",
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
    setView("details");
  }, [task?.id]);

  const patch = (p: Partial<TaskFormValue>) => setForm((f) => (f ? { ...f, ...p } : f));

  /** Applies a change locally and persists only the touched fields (auto-save). */
  const commit = (p: Partial<TaskFormValue>) => {
    if (!task || !form) return;
    const next = { ...form, ...p };
    if (!next.title.trim()) return;
    setForm(next);
    const db = taskFormToDb(next) as Record<string, unknown>;
    const fields: Record<string, unknown> = {};
    const keys = new Set(Object.keys(p));
    // A time is only valid with its date: always persist them as a pair.
    if (keys.has("start_date") || keys.has("start_time")) keys.add("start_date").add("start_time");
    if (keys.has("due_date") || keys.has("due_time")) keys.add("due_date").add("due_time");
    for (const k of keys) fields[k] = db[k];
    update.mutate(
      { id: task.id, patch: fields as any },
      { onError: (e: any) => toast.error("No se pudo guardar", { description: e?.message }) },
    );
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
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-3xl">
        <SheetHeader className="border-b px-6 py-3 pr-12">
          <div className="flex items-center justify-between gap-2">
            <SheetTitle className="truncate text-sm font-normal text-muted-foreground">
              {task ? (projects.find((p) => p.id === task.project_id)?.name ?? "Sin proyecto") : "Tarea"}
            </SheetTitle>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {update.isPending ? "Guardando…" : task ? `Creada ${format(parseISO(task.created_at), "dd/MM/yyyy")}` : null}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Más acciones">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem className="text-destructive" onClick={() => setConfirmDelete(true)}>
                    <Trash2 className="mr-2 h-4 w-4" /> Eliminar tarea
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </SheetHeader>

        {isLoading || !task || !form ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Cargando…</div>
        ) : (
          <div className="flex min-h-0 flex-1">
            <div className="min-w-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
              {view === "details" && (
                <>
                  <Input
                    value={form.title}
                    onChange={(e) => patch({ title: e.target.value })}
                    onBlur={() => form.title.trim() !== task.title && commit({ title: form.title })}
                    onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                    maxLength={200}
                    aria-label="Título"
                    className="h-auto border-0 bg-transparent px-0 text-2xl font-semibold shadow-none focus-visible:ring-0"
                  />

                  <TaskTimer task={task} />

                  <TaskProperties
                    value={form}
                    onCommit={commit}
                    members={members}
                    clients={clients}
                    projects={projects}
                    leads={leads}
                  />

                  <Textarea
                    value={form.description}
                    onChange={(e) => patch({ description: e.target.value })}
                    onBlur={() => form.description.trim() !== (task.description ?? "") && commit({ description: form.description })}
                    rows={4}
                    placeholder="Agrega una descripción: detalles, contexto, links…"
                    className="resize-none border-0 bg-muted/40 shadow-none"
                  />

                  <Separator />
                  <TaskSubtasks parent={task} members={members} onOpenSubtask={onOpenTask} />
                  <Separator />
                  <TaskChecklist taskId={task.id} />
                  <Separator />
                  <TaskAttachments taskId={task.id} workspaceId={workspaceId} />
                </>
              )}

              {view === "comments" && <TaskComments taskId={task.id} members={members} />}

              {view === "activity" && (
                <TaskActivity
                  taskId={task.id}
                  members={members}
                  clients={clients}
                  projects={projects}
                  leads={leads}
                />
              )}
            </div>

            <nav className="flex w-12 shrink-0 flex-col items-center gap-1 border-l py-3" aria-label="Secciones">
              {RAIL.map(({ id, label, Icon }) => (
                <Button
                  key={id}
                  variant="ghost"
                  size="icon"
                  title={label}
                  aria-label={label}
                  aria-pressed={view === id}
                  onClick={() => setView(id)}
                  className={cn("h-9 w-9", view === id && "bg-muted text-primary")}
                >
                  <Icon className="h-4 w-4" />
                </Button>
              ))}
            </nav>
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
