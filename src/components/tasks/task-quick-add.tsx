import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useCreateTask } from "@/hooks/useTasks";
import type { Task } from "@/hooks/useTasks";

/** Inline "+ Agregar tarea" row at the bottom of each group. */
export function TaskQuickAdd({
  workspaceId,
  defaults,
}: {
  workspaceId: string;
  defaults: Partial<Pick<Task, "status" | "priority" | "project_id">> & { assignee_ids?: string[] };
}) {
  const create = useCreateTask();
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const submit = async () => {
    const t = title.trim();
    if (!t || create.isPending) return;
    try {
      await create.mutateAsync({
        workspace_id: workspaceId,
        title: t,
        // Unless the group fixes the assignee, the new task is yours, so it
        // also shows up under "Mis tareas".
        assignee_ids: user ? [user.id] : [],
        ...defaults,
      });
      setTitle("");
    } catch (e: any) {
      toast.error("No se pudo crear la tarea", { description: e?.message });
    }
  };
  return (
    <div className="flex items-center gap-2 px-2 py-1">
      <Plus className="h-3.5 w-3.5 text-muted-foreground" />
      <Input
        value={title}
        disabled={create.isPending}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="Agregar tarea"
        maxLength={200}
        className="h-8 border-0 bg-transparent px-1 text-xs shadow-none focus-visible:ring-0"
      />
    </div>
  );
}

