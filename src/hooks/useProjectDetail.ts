import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ProjectStatus, ProjectType } from "@/integrations/supabase/database.types";

export type ProjectDetail = {
  id: string;
  workspace_id: string;
  client_id: string;
  name: string;
  type: ProjectType;
  status: ProjectStatus;
  start_date: string | null;
  end_date: string | null;
  budget_amount: number | null;
  progress: number | null;
  retainer_monthly: boolean;
  description: string | null;
  assigned_team_ids: string[];
  created_at: string;
  client: {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    brand_primary_color: string | null;
  } | null;
};

export function useProject(projectId: string | undefined) {
  return useQuery<ProjectDetail | null>({
    queryKey: ["project", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("projects")
        .select(
          "id, workspace_id, client_id, name, type, status, start_date, end_date, budget_amount, progress, retainer_monthly, description, assigned_team_ids, created_at, client:clients(id, name, slug, logo_url, brand_primary_color)",
        )
        .eq("id", projectId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        ...data,
        assigned_team_ids: Array.isArray(data.assigned_team_ids) ? data.assigned_team_ids : [],
      } as ProjectDetail;
    },
  });
}

export type ProjectTimelineEvent = {
  id: string;
  event_type:
    | "project_created"
    | "project_status_changed"
    | "project_updated"
    | "manual"
    | "client_created"
    | "client_updated"
    | "contact_added"
    | "contact_updated"
    | "note_updated";
  title: string;
  description: string | null;
  metadata: Record<string, unknown>;
  actor_id: string | null;
  occurred_at: string;
};

export type ProjectTimelineFilter = "all" | "status" | "manual";

export function useProjectTimeline(
  clientId: string | undefined,
  projectId: string | undefined,
  filter: ProjectTimelineFilter = "all",
) {
  return useQuery<ProjectTimelineEvent[]>({
    queryKey: ["project-timeline", projectId, filter],
    enabled: !!clientId && !!projectId,
    queryFn: async () => {
      let q = (supabase as any)
        .from("client_timeline_events")
        .select("id, event_type, title, description, metadata, actor_id, occurred_at")
        .eq("client_id", clientId)
        .order("occurred_at", { ascending: false })
        .limit(200);

      if (filter === "status") q = q.eq("event_type", "project_status_changed");
      else if (filter === "manual") q = q.eq("event_type", "manual");

      const { data, error } = await q;
      if (error) throw error;
      // Filter client-side by project_id in metadata
      return ((data ?? []) as ProjectTimelineEvent[]).filter((ev) => {
        const meta = (ev.metadata ?? {}) as Record<string, unknown>;
        return meta.project_id === projectId;
      });
    },
  });
}

export function useCreateProjectNote(
  clientId: string | undefined,
  workspaceId: string | undefined,
  projectId: string | undefined,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { title: string; description?: string; occurred_at?: string }) => {
      if (!clientId || !workspaceId || !projectId) throw new Error("Faltan ids");
      const { data: userRes } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("client_timeline_events").insert({
        client_id: clientId,
        workspace_id: workspaceId,
        event_type: "manual",
        title: input.title,
        description: input.description || null,
        occurred_at: input.occurred_at || new Date().toISOString(),
        actor_id: userRes.user?.id ?? null,
        metadata: { project_id: projectId },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-timeline", projectId] });
    },
  });
}

export function useUpdateProjectDescription(projectId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (description: string) => {
      if (!projectId) throw new Error("projectId requerido");
      const { error } = await (supabase as any)
        .from("projects")
        .update({ description: description || null, updated_at: new Date().toISOString() })
        .eq("id", projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", projectId] });
    },
  });
}

export function useDuplicateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (project: ProjectDetail) => {
      const payload = {
        workspace_id: project.workspace_id,
        client_id: project.client_id,
        name: `${project.name} (copia)`,
        type: project.type,
        status: "planning",
        start_date: project.start_date,
        end_date: project.end_date,
        budget_amount: project.budget_amount,
        retainer_monthly: project.retainer_monthly,
        description: project.description,
        assigned_team_ids: project.assigned_team_ids,
      };
      const { data, error } = await (supabase as any)
        .from("projects")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;
      return data as { id: string };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["projects-stats"] });
    },
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (projectId: string) => {
      const { error } = await (supabase as any).from("projects").delete().eq("id", projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["projects-stats"] });
      qc.invalidateQueries({ queryKey: ["client"] });
    },
  });
}

export type ProjectTask = {
  id: string;
  title: string;
  description: string | null;
  assigned_to: string | null;
  status: "todo" | "doing" | "review" | "done";
  priority: "p0" | "p1" | "p2" | "p3";
  due_date: string | null;
  created_at: string;
};

export function useProjectTasks(projectId: string | undefined) {
  return useQuery<ProjectTask[]>({
    queryKey: ["project-tasks", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("tasks")
        .select("id, title, description, assigned_to, status, priority, due_date, created_at")
        .eq("project_id", projectId)
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ProjectTask[];
    },
  });
}

export function useCreateProjectTask(
  workspaceId: string | undefined,
  projectId: string | undefined,
  clientId: string | undefined,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      title: string;
      assigned_to?: string | null;
      priority: ProjectTask["priority"];
      due_date?: string | null;
    }) => {
      if (!workspaceId || !projectId) throw new Error("Faltan ids");
      const { data: userRes } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("tasks").insert({
        workspace_id: workspaceId,
        project_id: projectId,
        client_id: clientId ?? null,
        title: input.title,
        assigned_to: input.assigned_to || null,
        priority: input.priority,
        due_date: input.due_date || null,
        created_by: userRes.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-tasks", projectId] });
    },
  });
}

export function useUpdateProjectTaskStatus(projectId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { taskId: string; status: ProjectTask["status"] }) => {
      const { error } = await (supabase as any)
        .from("tasks")
        .update({ status: input.status, updated_at: new Date().toISOString() })
        .eq("id", input.taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-tasks", projectId] });
    },
  });
}
