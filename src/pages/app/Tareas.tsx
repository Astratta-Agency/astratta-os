import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { useAuth } from "@/hooks/useAuth";
import { useClients } from "@/hooks/useClients";
import { useProjects, useWorkspaceMembers } from "@/hooks/useProjects";
import {
  useTasks,
  useUpdateTask,
  useWorkspaceLeadsMinimal,
  type TaskPriority,
  type TaskStatus,
  type TaskType,
} from "@/hooks/useTasks";

import { TasksFiltersBar } from "@/components/tasks/tasks-filters-bar";
import { TasksCalendarView } from "@/components/tasks/tasks-calendar-view";
import { NewTaskDialog } from "@/components/tasks/new-task-dialog";
import { TaskDetailSheet } from "@/components/tasks/task-detail-sheet";
import { RecurringRulesTab } from "@/components/tasks/recurring-rules-tab";
import { TaskViewsSwitcher } from "@/components/tasks/views/task-views-switcher";
import { Checkbox } from "@/components/ui/checkbox";

type ViewKey = "mias" | "proyecto" | "cliente" | "calendario" | "vencidas" | "recurrentes";

const VIEW_LABEL: Record<ViewKey, string> = {
  mias: "Mis tareas",
  proyecto: "Por proyecto",
  cliente: "Por cliente",
  calendario: "Calendario",
  vencidas: "Vencidas / en riesgo",
  recurrentes: "Recurrentes",
};

const parseList = (v: string | null): string[] => (v ? v.split(",").filter(Boolean) : []);

export default function Tareas() {
  const { workspace } = useActiveWorkspace();
  const { user } = useAuth();
  const workspaceId = workspace?.id;

  const [params, setParams] = useSearchParams();
  const view = (params.get("view") as ViewKey) || "mias";
  const search = params.get("q") ?? "";
  const types = parseList(params.get("types")) as TaskType[];
  const priorities = parseList(params.get("priorities")) as TaskPriority[];
  const tags = parseList(params.get("tags"));
  const showDone = params.get("done") === "1";
  const selectedClient = params.get("client_id") ?? "all";
  const selectedProject = params.get("project_id") ?? "all";
  const taskParam = params.get("task");

  const update = (next: Record<string, string | string[] | null | undefined>) => {
    const p = new URLSearchParams(params);
    Object.entries(next).forEach(([k, v]) => {
      if (v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0))
        p.delete(k);
      else if (Array.isArray(v)) p.set(k, v.join(","));
      else p.set(k, v);
    });
    setParams(p, { replace: true });
  };

  const setView = (v: ViewKey) => update({ view: v });

  // Data
  const { data: members = [] } = useWorkspaceMembers(workspaceId);
  const { data: clients = [] } = useClients(workspaceId, {
    search: "",
    status: "all",
    industry: "all",
    location: "all",
  });
  const { data: projects = [] } = useProjects(workspaceId, {
    search: "",
    statuses: [],
    types: [],
    clientIds: [],
  });
  const { data: leads = [] } = useWorkspaceLeadsMinimal(workspaceId);

  const clientOptions = useMemo(() => clients.map((c) => ({ id: c.id, name: c.name })), [clients]);
  const projectOptions = useMemo(
    () => projects.map((p) => ({ id: p.id, name: p.name })),
    [projects],
  );

  const filters = useMemo(
    () => ({
      search,
      types,
      priorities,
      tags,
      statuses:
        view === "mias" && !showDone
          ? (["todo", "doing", "review"] as TaskStatus[])
          : undefined,
      assignedTo: view === "mias" ? ("me" as const) : ("all" as const),
      currentUserId: user?.id,
      clientId: selectedClient !== "all" ? selectedClient : null,
      projectId: selectedProject !== "all" ? selectedProject : null,
    }),
    [search, types, priorities, tags, view, showDone, user?.id, selectedClient, selectedProject],
  );

  const { data: tasks = [], isLoading } = useTasks(workspaceId, filters);

  const availableTags = useMemo(() => {
    const s = new Set<string>();
    tasks.forEach((t) => t.tags.forEach((x) => s.add(x)));
    return Array.from(s).sort();
  }, [tasks]);

  const updateTask = useUpdateTask();
  const handleStatusChange = async (id: string, status: TaskStatus) => {
    try {
      await updateTask.mutateAsync({ id, patch: { status } });
    } catch (e: any) {
      toast.error("No se pudo actualizar", { description: e?.message });
    }
  };

  const [createOpen, setCreateOpen] = useState(false);
  const openTask = (id: string) => update({ task: id });
  const closeTask = () => update({ task: null });

  // If ?task= exists but URL had it on load, keep it. Nothing extra required.
  useEffect(() => {
    // noop, taskParam already drives the sheet
  }, [taskParam]);

  if (!workspaceId) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tareas</h1>
          <p className="text-sm text-muted-foreground">
            Todo el trabajo del workspace en un solo lugar.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Nueva tarea
        </Button>
      </div>

      <Tabs value={view} onValueChange={(v) => setView(v as ViewKey)}>
        <TabsList>
          {(Object.keys(VIEW_LABEL) as ViewKey[]).map((v) => (
            <TabsTrigger key={v} value={v}>
              {VIEW_LABEL[v]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {view !== "recurrentes" && (
        <div className="flex flex-wrap items-center gap-2">
          <TasksFiltersBar
            search={search}
            onSearch={(v) => update({ q: v })}
            types={types}
            onTypes={(v) => update({ types: v })}
            priorities={priorities}
            onPriorities={(v) => update({ priorities: v })}
            tags={tags}
            onTags={(v) => update({ tags: v })}
            availableTags={availableTags}
          />

          {(view === "proyecto" || view === "cliente") && (
            <>
              <Select
                value={selectedClient}
                onValueChange={(v) => update({ client_id: v === "all" ? null : v })}
              >
                <SelectTrigger className="h-9 w-48">
                  <SelectValue placeholder="Cliente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los clientes</SelectItem>
                  {clientOptions.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={selectedProject}
                onValueChange={(v) => update({ project_id: v === "all" ? null : v })}
              >
                <SelectTrigger className="h-9 w-48">
                  <SelectValue placeholder="Proyecto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los proyectos</SelectItem>
                  {projectOptions.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}

          {view === "mias" && (
            <label className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
              <Checkbox
                checked={showDone}
                onCheckedChange={(v) => update({ done: v ? "1" : null })}
              />
              Mostrar completadas
            </label>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : view === "calendario" ? (
        <TasksCalendarView tasks={tasks} onOpen={openTask} />
      ) : view === "recurrentes" ? (
        <RecurringRulesTab
          workspaceId={workspaceId}
          members={members}
          clients={clientOptions}
          projects={projectOptions}
        />
      ) : (
        <TaskViewsSwitcher
          tasks={tasks}
          members={members}
          projects={projectOptions}
          onOpen={openTask}
          onStatusChange={handleStatusChange}
          onCreate={() => setCreateOpen(true)}
        />
      )}

      <NewTaskDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        workspaceId={workspaceId}
        members={members}
        clients={clientOptions}
        projects={projectOptions}
        leads={leads}
      />

      <TaskDetailSheet
        taskId={taskParam}
        onClose={closeTask}
        workspaceId={workspaceId}
        members={members}
        clients={clientOptions}
        projects={projectOptions}
        leads={leads}
      />
    </div>
  );
}
