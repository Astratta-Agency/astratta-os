import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ProjectType, ProjectStatus } from "@/integrations/supabase/database.types";

export type ProjectRow = {
  id: string;
  workspace_id: string;
  client_id: string;
  name: string;
  type: ProjectType;
  status: ProjectStatus;
  start_date: string | null;
  end_date: string | null;
  budget_amount: number | null;
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

export type ProjectsFilters = {
  search?: string;
  clientIds?: string[];
  types?: ProjectType[];
  statuses?: ProjectStatus[];
  assignedToMe?: boolean;
  currentUserId?: string | null;
};

export function useProjects(workspaceId: string | undefined, filters: ProjectsFilters) {
  return useQuery<ProjectRow[]>({
    queryKey: ["projects", workspaceId, filters],
    enabled: !!workspaceId,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      let q = (supabase as any)
        .from("projects")
        .select(
          "id, workspace_id, client_id, name, type, status, start_date, end_date, budget_amount, retainer_monthly, description, assigned_team_ids, created_at, client:clients!inner(id, name, slug, logo_url, brand_primary_color)",
        )
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });

      if (filters.search?.trim()) q = q.ilike("name", `%${filters.search.trim()}%`);
      if (filters.clientIds?.length) q = q.in("client_id", filters.clientIds);
      if (filters.types?.length) q = q.in("type", filters.types);
      if (filters.statuses?.length) q = q.in("status", filters.statuses);
      if (filters.assignedToMe && filters.currentUserId) {
        q = q.contains("assigned_team_ids", JSON.stringify([filters.currentUserId]));
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        ...r,
        assigned_team_ids: Array.isArray(r.assigned_team_ids) ? r.assigned_team_ids : [],
      })) as ProjectRow[];
    },
  });
}

export type ProjectsStats = {
  totalActive: number;
  inProgress: number;
  paused: number;
  deliveredThisMonth: number;
  overdue: number;
};

export function useProjectsStats(workspaceId: string | undefined) {
  return useQuery<ProjectsStats>({
    queryKey: ["projects-stats", workspaceId],
    enabled: !!workspaceId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("projects")
        .select("status, end_date")
        .eq("workspace_id", workspaceId);
      if (error) throw error;
      const rows = (data ?? []) as { status: ProjectStatus; end_date: string | null }[];
      const today = new Date();
      const startMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const endMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      let totalActive = 0,
        inProgress = 0,
        paused = 0,
        deliveredThisMonth = 0,
        overdue = 0;
      for (const r of rows) {
        if (r.status === "planning" || r.status === "in_progress") totalActive++;
        if (r.status === "in_progress") inProgress++;
        if (r.status === "paused") paused++;
        if (r.status === "delivered" && r.end_date) {
          const d = new Date(r.end_date);
          if (d >= startMonth && d < endMonth) deliveredThisMonth++;
        }
        if (
          (r.status === "planning" || r.status === "in_progress") &&
          r.end_date &&
          new Date(r.end_date) < today
        ) {
          overdue++;
        }
      }
      return { totalActive, inProgress, paused, deliveredThisMonth, overdue };
    },
  });
}

export function useUpdateProjectStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      projectId: string;
      fromStatus: ProjectStatus;
      toStatus: ProjectStatus;
      workspaceId: string;
      clientId: string;
      projectName: string;
    }) => {
      const { error } = await (supabase as any)
        .from("projects")
        .update({ status: input.toStatus, updated_at: new Date().toISOString() })
        .eq("id", input.projectId);
      if (error) throw error;

      const { data: userRes } = await supabase.auth.getUser();
      await (supabase as any).from("client_timeline_events").insert({
        client_id: input.clientId,
        workspace_id: input.workspaceId,
        event_type: "project_status_changed",
        title: `${input.projectName}: ${input.fromStatus} → ${input.toStatus}`,
        metadata: { from_status: input.fromStatus, to_status: input.toStatus, project_id: input.projectId },
        actor_id: userRes.user?.id ?? null,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["projects-stats"] });
      qc.invalidateQueries({ queryKey: ["client-timeline"] });
    },
  });
}

export type UpdateProjectPatch = {
  name?: string;
  type?: ProjectType;
  status?: ProjectStatus;
  client_id?: string;
  start_date?: string | null;
  end_date?: string | null;
  budget_amount?: number | null;
  progress?: number | null;
};

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      projectId: string;
      patch: UpdateProjectPatch;
      statusChange?: {
        fromStatus: ProjectStatus;
        toStatus: ProjectStatus;
        workspaceId: string;
        clientId: string;
        projectName: string;
      };
    }) => {
      const { error } = await (supabase as any)
        .from("projects")
        .update({ ...input.patch, updated_at: new Date().toISOString() })
        .eq("id", input.projectId);
      if (error) throw error;

      if (input.statusChange && input.statusChange.fromStatus !== input.statusChange.toStatus) {
        const { data: userRes } = await supabase.auth.getUser();
        await (supabase as any).from("client_timeline_events").insert({
          client_id: input.statusChange.clientId,
          workspace_id: input.statusChange.workspaceId,
          event_type: "project_status_changed",
          title: `${input.statusChange.projectName}: ${input.statusChange.fromStatus} → ${input.statusChange.toStatus}`,
          metadata: {
            from_status: input.statusChange.fromStatus,
            to_status: input.statusChange.toStatus,
            project_id: input.projectId,
          },
          actor_id: userRes.user?.id ?? null,
        });
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["projects-stats"] });
      qc.invalidateQueries({ queryKey: ["project", vars.projectId] });
      qc.invalidateQueries({ queryKey: ["client-timeline"] });
    },
  });
}

export type WorkspaceMember = {
  user_id: string;
  role: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
};

export function useWorkspaceMembers(workspaceId: string | undefined) {
  return useQuery<WorkspaceMember[]>({
    queryKey: ["workspace-members", workspaceId],
    enabled: !!workspaceId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("workspace_members")
        .select("user_id, role, profiles:profiles!inner(full_name, email, avatar_url)")
        .eq("workspace_id", workspaceId)
        .eq("status", "active");
      if (error) {
        // Fallback if profiles relation isn't joinable
        const { data: d2 } = await (supabase as any)
          .from("workspace_members")
          .select("user_id, role")
          .eq("workspace_id", workspaceId)
          .eq("status", "active");
        return (d2 ?? []).map((m: any) => ({
          user_id: m.user_id,
          role: m.role,
          full_name: null,
          email: null,
          avatar_url: null,
        }));
      }
      return (data ?? []).map((m: any) => ({
        user_id: m.user_id,
        role: m.role,
        full_name: m.profiles?.full_name ?? null,
        email: m.profiles?.email ?? null,
        avatar_url: m.profiles?.avatar_url ?? null,
      }));
    },
  });
}
