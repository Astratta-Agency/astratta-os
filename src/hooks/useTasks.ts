import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TaskStatus = "todo" | "doing" | "review" | "done";
export type TaskPriority = "p0" | "p1" | "p2" | "p3";
export type TaskType = "produccion" | "revision" | "aprobacion" | "reunion" | "admin";

export type Task = {
  id: string;
  workspace_id: string;
  project_id: string | null;
  client_id: string | null;
  lead_id: string | null;
  related_post_id: string | null;
  title: string;
  description: string | null;
  assigned_to: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  type: TaskType;
  estimated_hours: number | null;
  tags: string[];
  due_date: string | null;
  timer_started_at: string | null;
  timer_started_by: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type TasksFilters = {
  search?: string;
  types?: TaskType[];
  priorities?: TaskPriority[];
  tags?: string[];
  statuses?: TaskStatus[];
  assignedTo?: string | "me" | "all";
  clientId?: string | null;
  projectId?: string | null;
  currentUserId?: string;
};

export function useTasks(workspaceId: string | undefined, filters: TasksFilters = {}) {
  return useQuery<Task[]>({
    queryKey: ["tasks", workspaceId, filters],
    enabled: !!workspaceId,
    staleTime: 15_000,
    queryFn: async () => {
      let q = (supabase as any)
        .from("tasks")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });

      if (filters.search?.trim()) q = q.ilike("title", `%${filters.search.trim()}%`);
      if (filters.types?.length) q = q.in("type", filters.types);
      if (filters.priorities?.length) q = q.in("priority", filters.priorities);
      if (filters.statuses?.length) q = q.in("status", filters.statuses);
      if (filters.tags?.length) q = q.overlaps("tags", filters.tags);
      if (filters.clientId) q = q.eq("client_id", filters.clientId);
      if (filters.projectId) q = q.eq("project_id", filters.projectId);
      if (filters.assignedTo === "me" && filters.currentUserId) {
        q = q.eq("assigned_to", filters.currentUserId);
      } else if (filters.assignedTo && filters.assignedTo !== "all" && filters.assignedTo !== "me") {
        q = q.eq("assigned_to", filters.assignedTo);
      }

      const { data, error } = await q;
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({
        ...r,
        tags: Array.isArray(r.tags) ? r.tags : [],
      })) as Task[];
    },
  });
}

export function useTask(taskId: string | null | undefined) {
  return useQuery<Task | null>({
    queryKey: ["task", taskId],
    enabled: !!taskId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("tasks")
        .select("*")
        .eq("id", taskId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return { ...data, tags: Array.isArray(data.tags) ? data.tags : [] } as Task;
    },
  });
}

export type NewTaskInput = {
  workspace_id: string;
  title: string;
  description?: string | null;
  type?: TaskType;
  priority?: TaskPriority;
  status?: TaskStatus;
  assigned_to?: string | null;
  due_date?: string | null;
  estimated_hours?: number | null;
  tags?: string[];
  project_id?: string | null;
  client_id?: string | null;
  lead_id?: string | null;
  related_post_id?: string | null;
};

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewTaskInput) => {
      const { data: userRes } = await supabase.auth.getUser();
      const { data, error } = await (supabase as any)
        .from("tasks")
        .insert({
          ...input,
          type: input.type ?? "produccion",
          priority: input.priority ?? "p2",
          status: input.status ?? "todo",
          tags: input.tags ?? [],
          created_by: userRes?.user?.id ?? null,
        })
        .select("*")
        .single();
      if (error) throw error;
      return data as Task;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Task> }) => {
      const { data, error } = await (supabase as any)
        .from("tasks")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;
      return data as Task;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["task", vars.id] });
    },
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("tasks").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

// ---------------- Timer ----------------

export function useStartTimer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (taskId: string) => {
      const { data: userRes } = await supabase.auth.getUser();
      const { error } = await (supabase as any)
        .from("tasks")
        .update({
          timer_started_at: new Date().toISOString(),
          timer_started_by: userRes?.user?.id ?? null,
        })
        .eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: (_d, taskId) => {
      qc.invalidateQueries({ queryKey: ["task", taskId] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

export function useStopTimer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, note }: { taskId: string; note?: string }) => {
      const { data, error } = await (supabase as any).rpc("stop_task_timer", {
        p_task_id: taskId,
        p_note: note ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["task", vars.taskId] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["task-time-entries", vars.taskId] });
    },
  });
}

export type TimeEntry = {
  id: string;
  task_id: string | null;
  user_id: string;
  entry_date: string;
  hours: number;
  billable: boolean;
  note: string | null;
  created_at: string;
};

export function useTaskTimeEntries(taskId: string | null | undefined) {
  return useQuery<TimeEntry[]>({
    queryKey: ["task-time-entries", taskId],
    enabled: !!taskId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("time_entries")
        .select("id, task_id, user_id, entry_date, hours, billable, note, created_at")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TimeEntry[];
    },
  });
}

// ---------------- Checklist ----------------

export type ChecklistItem = {
  id: string;
  task_id: string;
  title: string;
  is_done: boolean;
  position: number;
  created_at: string;
};

export function useChecklist(taskId: string | null | undefined) {
  return useQuery<ChecklistItem[]>({
    queryKey: ["task-checklist", taskId],
    enabled: !!taskId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("task_checklist_items")
        .select("*")
        .eq("task_id", taskId)
        .order("position", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ChecklistItem[];
    },
  });
}

export function useAddChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, title, position }: { taskId: string; title: string; position: number }) => {
      const { data, error } = await (supabase as any)
        .from("task_checklist_items")
        .insert({ task_id: taskId, title, position })
        .select("*")
        .single();
      if (error) throw error;
      return data as ChecklistItem;
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ["task-checklist", vars.taskId] }),
  });
}

export function useUpdateChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<ChecklistItem>; taskId: string }) => {
      const { error } = await (supabase as any)
        .from("task_checklist_items")
        .update(patch)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ["task-checklist", vars.taskId] }),
  });
}

export function useDeleteChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; taskId: string }) => {
      const { error } = await (supabase as any).from("task_checklist_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ["task-checklist", vars.taskId] }),
  });
}

// ---------------- Comments ----------------

export type TaskComment = {
  id: string;
  task_id: string;
  author_id: string;
  body: string;
  created_at: string;
};

export function useTaskComments(taskId: string | null | undefined) {
  return useQuery<TaskComment[]>({
    queryKey: ["task-comments", taskId],
    enabled: !!taskId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("task_comments")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TaskComment[];
    },
  });
}

export function useAddComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, body }: { taskId: string; body: string }) => {
      const { data: userRes } = await supabase.auth.getUser();
      const { data, error } = await (supabase as any)
        .from("task_comments")
        .insert({ task_id: taskId, body, author_id: userRes?.user?.id })
        .select("*")
        .single();
      if (error) throw error;
      return data as TaskComment;
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ["task-comments", vars.taskId] }),
  });
}

export function useDeleteComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; taskId: string }) => {
      const { error } = await (supabase as any).from("task_comments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ["task-comments", vars.taskId] }),
  });
}

// ---------------- Attachments ----------------

export type TaskAttachment = {
  id: string;
  task_id: string;
  uploaded_by: string | null;
  file_name: string;
  file_url: string; // storage path
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
};

export function useTaskAttachments(taskId: string | null | undefined) {
  return useQuery<TaskAttachment[]>({
    queryKey: ["task-attachments", taskId],
    enabled: !!taskId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("task_attachments")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TaskAttachment[];
    },
  });
}

export function useUploadAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      taskId,
      workspaceId,
      file,
    }: {
      taskId: string;
      workspaceId: string;
      file: File;
    }) => {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${workspaceId}/${taskId}/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage
        .from("task-attachments")
        .upload(path, file);
      if (upErr) throw upErr;
      const { data: userRes } = await supabase.auth.getUser();
      const { data, error } = await (supabase as any)
        .from("task_attachments")
        .insert({
          task_id: taskId,
          uploaded_by: userRes?.user?.id ?? null,
          file_name: file.name,
          file_url: path,
          file_size: file.size,
          mime_type: file.type || null,
        })
        .select("*")
        .single();
      if (error) throw error;
      return data as TaskAttachment;
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ["task-attachments", vars.taskId] }),
  });
}

export function useDeleteAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, path }: { id: string; path: string; taskId: string }) => {
      await supabase.storage.from("task-attachments").remove([path]);
      const { error } = await (supabase as any).from("task_attachments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ["task-attachments", vars.taskId] }),
  });
}

export async function getAttachmentSignedUrl(path: string) {
  const { data, error } = await supabase.storage
    .from("task-attachments")
    .createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

// ---------------- Recurrence rules ----------------

export type RecurrenceRule = {
  id: string;
  workspace_id: string;
  title: string;
  description: string | null;
  type: TaskType;
  priority: TaskPriority;
  assigned_to: string | null;
  client_id: string | null;
  project_id: string | null;
  tags: string[];
  estimated_hours: number | null;
  frequency: "daily" | "weekly" | "monthly";
  day_of_week: number | null;
  day_of_month: number | null;
  next_run_date: string;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export function useRecurrenceRules(workspaceId: string | undefined) {
  return useQuery<RecurrenceRule[]>({
    queryKey: ["recurrence-rules", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("task_recurrence_rules")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("next_run_date", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({
        ...r,
        tags: Array.isArray(r.tags) ? r.tags : [],
      })) as RecurrenceRule[];
    },
  });
}

export function useCreateRecurrenceRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<RecurrenceRule> & { workspace_id: string; title: string; frequency: string; next_run_date: string }) => {
      const { data: userRes } = await supabase.auth.getUser();
      const { data, error } = await (supabase as any)
        .from("task_recurrence_rules")
        .insert({
          ...input,
          type: input.type ?? "produccion",
          priority: input.priority ?? "p2",
          tags: input.tags ?? [],
          is_active: input.is_active ?? true,
          created_by: userRes?.user?.id ?? null,
        })
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recurrence-rules"] }),
  });
}

export function useUpdateRecurrenceRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<RecurrenceRule> }) => {
      const { error } = await (supabase as any)
        .from("task_recurrence_rules")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recurrence-rules"] }),
  });
}

export function useDeleteRecurrenceRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("task_recurrence_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recurrence-rules"] }),
  });
}

// ---------------- Leads / posts minimal fetch for selects ----------------

export function useWorkspaceLeadsMinimal(workspaceId: string | undefined) {
  return useQuery<{ id: string; company_name: string | null; contact_name: string | null }[]>({
    queryKey: ["leads-minimal", workspaceId],
    enabled: !!workspaceId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("leads")
        .select("id, company_name, contact_name")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });
      if (error) return [];
      return data ?? [];
    },
  });
}

export function useProfilesByIds(userIds: string[]) {
  return useQuery({
    queryKey: ["profiles-by-ids", userIds.slice().sort().join(",")],
    enabled: userIds.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("profiles")
        .select("id, full_name, email, avatar_url")
        .in("id", userIds);
      if (error) return [];
      return (data ?? []) as { id: string; full_name: string | null; email: string | null; avatar_url: string | null }[];
    },
  });
}
