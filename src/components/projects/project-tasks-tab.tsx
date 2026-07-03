import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useTasks, useUpdateTask, type TaskStatus } from "@/hooks/useTasks";
import type { WorkspaceMember } from "@/hooks/useProjects";
import { TaskViewsSwitcher } from "@/components/tasks/views/task-views-switcher";
import { TaskDetailSheet } from "@/components/tasks/task-detail-sheet";
import { NewTaskDialog } from "@/components/tasks/new-task-dialog";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";

interface Props {
  projectId: string;
  workspaceId: string;
  clientId: string;
  members: WorkspaceMember[];
  createOpen: boolean;
  onCreateOpenChange: (v: boolean) => void;
}

export function ProjectTasksTab({
  projectId,
  workspaceId,
  clientId,
  members,
  createOpen,
  onCreateOpenChange,
}: Props) {
  const { data: tasks = [], isLoading } = useTasks(workspaceId, { projectId });
  const updateTask = useUpdateTask();

  const [params, setParams] = useSearchParams();
  const openTaskId = params.get("task");
  const openTask = (id: string) => {
    const p = new URLSearchParams(params);
    p.set("task", id);
    setParams(p, { replace: true });
  };
  const closeTask = () => {
    const p = new URLSearchParams(params);
    p.delete("task");
    setParams(p, { replace: true });
  };

  const handleStatusChange = async (id: string, status: TaskStatus) => {
    try {
      await updateTask.mutateAsync({ id, patch: { status } });
    } catch (e: any) {
      toast.error("No se pudo actualizar", { description: e?.message });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => onCreateOpenChange(true)}>
          <Plus className="mr-2 h-4 w-4" /> Nueva tarea
        </Button>
      </div>

      <TaskViewsSwitcher
        tasks={tasks}
        members={members}
        onOpen={openTask}
        onStatusChange={handleStatusChange}
        onCreate={() => onCreateOpenChange(true)}
        hideProjectGrouping
      />

      <NewTaskDialog
        open={createOpen}
        onOpenChange={onCreateOpenChange}
        workspaceId={workspaceId}
        members={members}
        clients={[]}
        projects={[{ id: projectId, name: "" }]}
        leads={[]}
        defaults={{ project_id: projectId, client_id: clientId }}
      />

      <TaskDetailSheet
        taskId={openTaskId}
        onClose={closeTask}
        workspaceId={workspaceId}
        members={members}
        clients={[]}
        projects={[{ id: projectId, name: "" }]}
        leads={[]}
      />
    </div>
  );
}
