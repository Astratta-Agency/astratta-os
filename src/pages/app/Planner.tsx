import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { addDays, addWeeks, format, isValid, parseISO, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { useAuth } from "@/hooks/useAuth";
import { useClients } from "@/hooks/useClients";
import { useProjects, useWorkspaceMembers } from "@/hooks/useProjects";
import { useTasks, useWorkspaceLeadsMinimal } from "@/hooks/useTasks";
import { useTimeBlocks } from "@/hooks/usePlanner";
import { ALL_CLIENTS, useSocialPosts } from "@/hooks/useSocialPosts";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { PlannerBoard } from "@/components/planner/planner-board";
import { TaskDetailSheet } from "@/components/tasks/task-detail-sheet";
import { memberDisplay } from "@/components/tasks/assignee-avatars";

const weekOf = (d: Date) => startOfWeek(d, { weekStartsOn: 1 });
const SHOW_POSTS_KEY = "astratta:planner:show-posts";
const NO_POST_FILTERS = {};

function readShowPosts() {
  try {
    return localStorage.getItem(SHOW_POSTS_KEY) !== "0";
  } catch {
    return true;
  }
}

export default function Planner() {
  const { workspace } = useActiveWorkspace();
  const { user } = useAuth();
  const workspaceId = workspace?.id;
  const [params, setParams] = useSearchParams();

  const set = (next: Record<string, string | null>) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) (v ? p.set(k, v) : p.delete(k));
    setParams(p, { replace: true });
  };

  const weekParam = params.get("week");
  const parsed = weekParam ? parseISO(weekParam) : null;
  const weekStart = weekOf(parsed && isValid(parsed) ? parsed : new Date());
  const weekEnd = addDays(weekStart, 7);
  const viewUserId = params.get("user") || user?.id;
  const readOnly = !!user && viewUserId !== user.id;
  const taskParam = params.get("task");

  const { data: members = [] } = useWorkspaceMembers(workspaceId);
  const { data: clients = [] } = useClients(workspaceId, { search: "", status: "all", industry: "all", location: "all" });
  const { data: projects = [] } = useProjects(workspaceId, { search: "", statuses: [], types: [], clientIds: [] });
  const { data: leads = [] } = useWorkspaceLeadsMinimal(workspaceId);
  const clientOptions = useMemo(() => clients.map((c) => ({ id: c.id, name: c.name })), [clients]);
  const projectOptions = useMemo(() => projects.map((p) => ({ id: p.id, name: p.name })), [projects]);

  const filters = useMemo(
    () => ({ assignedTo: viewUserId, currentUserId: user?.id }),
    [viewUserId, user?.id],
  );
  const { data: tasks = [], isLoading: loadingTasks } = useTasks(workspaceId, filters);
  const { data: blocks = [], isLoading: loadingBlocks } = useTimeBlocks(workspaceId, viewUserId, weekStart, weekEnd);

  const [showPosts, setShowPostsState] = useState(readShowPosts);
  const setShowPosts = (v: boolean) => {
    setShowPostsState(v);
    try {
      localStorage.setItem(SHOW_POSTS_KEY, v ? "1" : "0");
    } catch {
      /* storage unavailable: the choice just won't persist */
    }
  };
  const postRange = useMemo(() => ({ from: weekStart, to: weekEnd }), [weekStart.getTime()]);
  const { data: allPosts = [] } = useSocialPosts({
    workspaceId,
    clientId: showPosts ? ALL_CLIENTS : undefined,
    range: postRange,
    filters: NO_POST_FILTERS,
  });
  const posts = useMemo(
    () => (showPosts ? allPosts.filter((p) => p.status !== "archived" && p.status !== "rejected") : []),
    [showPosts, allPosts],
  );
  const clientNames = useMemo(() => Object.fromEntries(clients.map((c) => [c.id, c.name])), [clients]);

  const goWeek = (d: Date) => set({ week: format(weekOf(d), "yyyy-MM-dd") });
  const openTask = (id: string) => set({ task: id });

  if (!workspaceId || !user) {
    return <Skeleton className="h-[70vh] w-full" />;
  }

  const sameMonth = weekStart.getMonth() === addDays(weekStart, 6).getMonth();
  const title = sameMonth
    ? format(weekStart, "MMMM yyyy", { locale: es })
    : `${format(weekStart, "MMM", { locale: es })} – ${format(addDays(weekStart, 6), "MMM yyyy", { locale: es })}`;

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div>
          <h1 className="text-2xl font-bold">Planner</h1>
          <p className="text-sm text-muted-foreground">Reserva tiempo en tu semana para tus tareas.</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="mr-2 flex items-center gap-2">
            <Switch id="planner-show-posts" checked={showPosts} onCheckedChange={setShowPosts} />
            <Label htmlFor="planner-show-posts" className="text-sm font-normal">
              Publicaciones
            </Label>
          </div>
          <Select value={viewUserId} onValueChange={(v) => set({ user: v === user.id ? null : v })}>
            <SelectTrigger className="h-9 w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={user.id}>Mi planner</SelectItem>
              {members
                .filter((m) => m.user_id !== user.id)
                .map((m) => (
                  <SelectItem key={m.user_id} value={m.user_id}>
                    {memberDisplay(members, m.user_id).name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-9" onClick={() => set({ week: null })}>
            Hoy
          </Button>
          <div className="flex items-center">
            <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Semana anterior" onClick={() => goWeek(addWeeks(weekStart, -1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Semana siguiente" onClick={() => goWeek(addWeeks(weekStart, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <span className="min-w-36 text-sm font-semibold capitalize">{title}</span>
        </div>
      </div>

      {readOnly && (
        <p className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Estás viendo el planner de {memberDisplay(members, viewUserId!).name}. Solo lectura.
        </p>
      )}

      {loadingTasks || loadingBlocks ? (
        <Skeleton className="flex-1" />
      ) : (
        <PlannerBoard
          workspaceId={workspaceId}
          weekStart={weekStart}
          tasks={tasks}
          blocks={blocks}
          posts={posts}
          clientNames={clientNames}
          readOnly={readOnly}
          onOpen={openTask}
        />
      )}

      <TaskDetailSheet
        taskId={taskParam}
        onClose={() => set({ task: null })}
        workspaceId={workspaceId}
        members={members}
        clients={clientOptions}
        projects={projectOptions}
        leads={leads}
        onOpenTask={openTask}
      />
    </div>
  );
}
