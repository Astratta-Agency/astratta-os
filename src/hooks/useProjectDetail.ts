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
