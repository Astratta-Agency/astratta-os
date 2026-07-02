import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ---------------- Types ----------------

export type TeamMember = {
  user_id: string;
  role: "owner" | "team_member" | "collaborator" | string;
  status: string;
  title: string | null;
  weekly_capacity_hours: number | null;
  hourly_rate: number | null;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
};

export type TimeEntry = {
  id: string;
  workspace_id: string;
  user_id: string;
  client_id: string | null;
  project_id: string | null;
  entry_date: string;
  hours: number;
  billable: boolean;
  note: string | null;
  created_by: string | null;
  created_at: string;
  client?: { name: string } | null;
  project?: { name: string } | null;
};

export type MemberReview = {
  id: string;
  workspace_id: string;
  user_id: string;
  period: string;
  quality_rating: number;
  note: string | null;
  reviewed_by: string | null;
  created_at: string;
};

export type FreelancerPayment = {
  id: string;
  workspace_id: string;
  user_id: string;
  client_id: string | null;
  project_id: string | null;
  period_start: string;
  period_end: string;
  amount: number;
  status: "pending" | "paid";
  paid_at: string | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
};

export type WorkspaceTask = {
  id: string;
  workspace_id: string;
  project_id: string | null;
  client_id: string | null;
  title: string;
  description: string | null;
  assigned_to: string | null;
  status: "todo" | "doing" | "review" | "done";
  priority: "p0" | "p1" | "p2" | "p3" | null;
  due_date: string | null;
  related_post_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

// ---------------- Members ----------------

export function useTeamMembers(workspaceId: string | undefined) {
  return useQuery<TeamMember[]>({
    queryKey: ["team-members", workspaceId],
    enabled: !!workspaceId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data: members, error } = await (supabase as any)
        .from("workspace_members")
        .select("user_id, role, status, title, weekly_capacity_hours, hourly_rate")
        .eq("workspace_id", workspaceId)
        .eq("status", "active");
      if (error) throw error;

      const rows = (members ?? []) as any[];
      const userIds = Array.from(new Set(rows.map((m) => m.user_id).filter(Boolean)));
      let profileMap = new Map<string, { full_name: string | null; email: string | null; avatar_url: string | null }>();
      if (userIds.length > 0) {
        const { data: profs } = await (supabase as any)
          .from("profiles")
          .select("id, full_name, email, avatar_url")
          .in("id", userIds);
        for (const p of (profs ?? []) as any[]) {
          profileMap.set(p.id, {
            full_name: p.full_name ?? null,
            email: p.email ?? null,
            avatar_url: p.avatar_url ?? null,
          });
        }
      }

      return rows.map((m) => {
        const p = profileMap.get(m.user_id);
        return {
          user_id: m.user_id,
          role: m.role,
          status: m.status,
          title: m.title ?? null,
          weekly_capacity_hours: m.weekly_capacity_hours ?? null,
          hourly_rate: m.hourly_rate ?? null,
          full_name: p?.full_name ?? null,
          email: p?.email ?? null,
          avatar_url: p?.avatar_url ?? null,
        };
      });
    },
  });
}

export function useUpdateTeamMember(workspaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      user_id: string;
      patch: Partial<Pick<TeamMember, "title" | "role" | "weekly_capacity_hours" | "hourly_rate" | "status">>;
      full_name?: string | null;
    }) => {
      if (Object.keys(input.patch).length > 0) {
        const { error } = await (supabase as any)
          .from("workspace_members")
          .update(input.patch)
          .eq("workspace_id", workspaceId)
          .eq("user_id", input.user_id);
        if (error) throw error;
      }
      if (input.full_name !== undefined && workspaceId) {
        const { error: rpcErr } = await (supabase as any).rpc("update_member_full_name", {
          _workspace_id: workspaceId,
          _user_id: input.user_id,
          _full_name: input.full_name ?? "",
        });
        if (rpcErr) throw rpcErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team-members", workspaceId] });
    },
  });
}

export function useInviteTeamMember(workspaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      email: string;
      role: "team_member" | "collaborator";
      title?: string;
      weekly_capacity_hours?: number;
      hourly_rate?: number;
      full_name?: string;
    }): Promise<{ emailed: boolean; actionUrl?: string; isNewAccount?: boolean }> => {
      if (!workspaceId) throw new Error("workspaceId requerido");
      const { data, error } = await supabase.functions.invoke("send-team-invite", {
        body: { workspace_id: workspaceId, ...input },
      });
      if (error) throw error;
      const d = data as any;
      return {
        emailed: !!d?.emailed,
        actionUrl: d?.actionUrl,
        isNewAccount: !!d?.isNewAccount,
      };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team-members", workspaceId] });
    },
  });
}

// ---------------- Time entries ----------------

export function useTimeEntries(
  workspaceId: string | undefined,
  filters?: { userId?: string; from?: string; to?: string },
) {
  return useQuery<TimeEntry[]>({
    queryKey: ["time-entries", workspaceId, filters],
    enabled: !!workspaceId,
    staleTime: 30_000,
    queryFn: async () => {
      let q = (supabase as any)
        .from("time_entries")
        .select(
          "id, workspace_id, user_id, client_id, project_id, entry_date, hours, billable, note, created_by, created_at, client:clients(name), project:projects(name)",
        )
        .eq("workspace_id", workspaceId)
        .order("entry_date", { ascending: false });
      if (filters?.userId) q = q.eq("user_id", filters.userId);
      if (filters?.from) q = q.gte("entry_date", filters.from);
      if (filters?.to) q = q.lte("entry_date", filters.to);
      const { data, error } = await q;
      if (error) {
        // fallback without joins
        let q2 = (supabase as any)
          .from("time_entries")
          .select("*")
          .eq("workspace_id", workspaceId)
          .order("entry_date", { ascending: false });
        if (filters?.userId) q2 = q2.eq("user_id", filters.userId);
        if (filters?.from) q2 = q2.gte("entry_date", filters.from);
        if (filters?.to) q2 = q2.lte("entry_date", filters.to);
        const { data: d2 } = await q2;
        return (d2 ?? []) as TimeEntry[];
      }
      return (data ?? []) as TimeEntry[];
    },
  });
}

export function useCreateTimeEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      workspace_id: string;
      user_id: string;
      entry_date: string;
      hours: number;
      billable: boolean;
      client_id?: string | null;
      project_id?: string | null;
      note?: string | null;
    }) => {
      const { data: userRes } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("time_entries").insert({
        ...input,
        created_by: userRes.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["time-entries", vars.workspace_id] });
    },
  });
}

export function useUpdateTimeEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; workspace_id: string; patch: Partial<TimeEntry> }) => {
      const { error } = await (supabase as any)
        .from("time_entries")
        .update(input.patch)
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["time-entries", vars.workspace_id] });
    },
  });
}

export function useDeleteTimeEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; workspace_id: string }) => {
      const { error } = await (supabase as any).from("time_entries").delete().eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["time-entries", vars.workspace_id] });
    },
  });
}

// ---------------- Reviews ----------------

export function useMemberReviews(userId: string | undefined) {
  return useQuery<MemberReview[]>({
    queryKey: ["member-reviews", userId],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("member_performance_reviews")
        .select("*")
        .eq("user_id", userId)
        .order("period", { ascending: false });
      if (error) throw error;
      return (data ?? []) as MemberReview[];
    },
  });
}

export function useCreateReview(workspaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      user_id: string;
      period: string; // yyyy-mm-01
      quality_rating: number;
      note?: string | null;
    }) => {
      if (!workspaceId) throw new Error("workspaceId requerido");
      const { data: userRes } = await supabase.auth.getUser();
      const { error } = await (supabase as any)
        .from("member_performance_reviews")
        .upsert(
          {
            workspace_id: workspaceId,
            user_id: input.user_id,
            period: input.period,
            quality_rating: input.quality_rating,
            note: input.note ?? null,
            reviewed_by: userRes.user?.id ?? null,
          },
          { onConflict: "user_id,period" },
        );
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["member-reviews", vars.user_id] });
    },
  });
}

// ---------------- Freelancer payments ----------------

export function useFreelancerPayments(workspaceId: string | undefined, userId?: string) {
  return useQuery<FreelancerPayment[]>({
    queryKey: ["freelancer-payments", workspaceId, userId ?? "all"],
    enabled: !!workspaceId,
    staleTime: 30_000,
    queryFn: async () => {
      let q = (supabase as any)
        .from("freelancer_payments")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("period_end", { ascending: false });
      if (userId) q = q.eq("user_id", userId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as FreelancerPayment[];
    },
  });
}

export function useCreatePayment(workspaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      user_id: string;
      period_start: string;
      period_end: string;
      amount: number;
      note?: string | null;
      client_id?: string | null;
      project_id?: string | null;
    }) => {
      if (!workspaceId) throw new Error("workspaceId requerido");
      const { data: userRes } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("freelancer_payments").insert({
        workspace_id: workspaceId,
        status: "pending",
        created_by: userRes.user?.id ?? null,
        ...input,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["freelancer-payments", workspaceId] });
    },
  });
}

export function useMarkPaymentPaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; workspace_id: string }) => {
      const { error } = await (supabase as any)
        .from("freelancer_payments")
        .update({ status: "paid", paid_at: new Date().toISOString() })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["freelancer-payments", vars.workspace_id] });
    },
  });
}

// ---------------- Tasks ----------------

export function useWorkspaceTasks(workspaceId: string | undefined) {
  return useQuery<WorkspaceTask[]>({
    queryKey: ["workspace-tasks", workspaceId],
    enabled: !!workspaceId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("tasks")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as WorkspaceTask[];
    },
  });
}

export function useCreateTask(workspaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      title: string;
      description?: string | null;
      assigned_to?: string | null;
      status?: WorkspaceTask["status"];
      priority?: WorkspaceTask["priority"];
      due_date?: string | null;
      project_id?: string | null;
      client_id?: string | null;
    }) => {
      if (!workspaceId) throw new Error("workspaceId requerido");
      const { data: userRes } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("tasks").insert({
        workspace_id: workspaceId,
        status: "todo",
        ...input,
        created_by: userRes.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workspace-tasks", workspaceId] });
    },
  });
}
