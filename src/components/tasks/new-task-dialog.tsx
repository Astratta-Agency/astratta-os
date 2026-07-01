import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useCreateTask } from "@/hooks/useTasks";
import type { WorkspaceMember } from "@/hooks/useProjects";
import {
  emptyTaskForm,
  TaskFormFields,
  taskFormToDb,
  type TaskFormValue,
} from "./task-form-fields";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  workspaceId: string;
  members: WorkspaceMember[];
  clients: { id: string; name: string }[];
  projects: { id: string; name: string }[];
  leads?: { id: string; company_name: string | null; contact_name: string | null }[];
  defaults?: Partial<TaskFormValue>;
}

export function NewTaskDialog({
  open,
  onOpenChange,
  workspaceId,
  members,
  clients,
  projects,
  leads,
  defaults,
}: Props) {
  const create = useCreateTask();
  const [form, setForm] = useState<TaskFormValue>({ ...emptyTaskForm(), ...defaults });

  const patch = (p: Partial<TaskFormValue>) => setForm((f) => ({ ...f, ...p }));

  const handleSubmit = async () => {
    if (!form.title.trim()) return;
    try {
      await create.mutateAsync({ workspace_id: workspaceId, ...taskFormToDb(form) });
      toast.success("Tarea creada");
      onOpenChange(false);
      setTimeout(() => setForm({ ...emptyTaskForm(), ...defaults }), 200);
    } catch (e: any) {
      toast.error("No se pudo crear", { description: e?.message });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nueva tarea</DialogTitle>
        </DialogHeader>
        <TaskFormFields
          value={form}
          onChange={patch}
          members={members}
          clients={clients}
          projects={projects}
          leads={leads}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={create.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!form.title.trim() || create.isPending}>
            {create.isPending ? "Creando…" : "Crear tarea"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
