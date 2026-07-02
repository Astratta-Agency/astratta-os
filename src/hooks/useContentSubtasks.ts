import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Task, TaskType } from "@/hooks/useTasks";

// ---------------- Types ----------------

export type ContentSubtaskKey =
  | "copywriting"
  | "design"
  | "review"
  | "scheduling"
  | "publishing";

export type ContentRoleKey = "content_creator" | "designer";

export type ContentTaskPostType =
  | "feed_post"
  | "carousel"
  | "reel"
  | "story"
  | "video"
  | "other";

export type ContentTaskTemplate = {
  id: string;
  workspace_id: string;
  post_type: ContentTaskPostType | null;
  subtask_key: ContentSubtaskKey;
  title: string;
  task_type: TaskType;
  default_role: ContentRoleKey | null;
  offset_days: number;
  sort_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

export const SUBTASK_KEY_LABEL: Record<ContentSubtaskKey, string> = {
  copywriting: "Copywriting",
  design: "Diseño",
  review: "Revisión interna",
  scheduling: "Programación",
  publishing: "Publicación",
};

export const CONTENT_ROLE_LABEL: Record<ContentRoleKey, string> = {
  content_creator: "Content creator",
  designer: "Diseñador",
};

export const POST_TYPE_OPTIONS: { value: ContentTaskPostType; label: string }[] = [
  { value: "feed_post", label: "Feed post" },
  { value: "carousel", label: "Carrusel" },
  { value: "reel", label: "Reel" },
  { value: "story", label: "Story" },
  { value: "video", label: "Video" },
  { value: "other", label: "Otro" },
];

// ---------------- Templates CRUD ----------------

export function useContentTaskTemplates(workspaceId: string | undefined) {
  return useQuery<ContentTaskTemplate[]>({
    queryKey: ["content-task-templates", workspaceId],
    enabled: !!workspaceId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("content_task_templates")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ContentTaskTemplate[];
    },
  });
}

export type ContentTaskTemplateInput = Omit<
  ContentTaskTemplate,
  "id" | "created_at" | "updated_at"
>;

export function useUpsertContentTaskTemplate(workspaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      patch: Partial<ContentTaskTemplateInput>;
    }) => {
      if (input.id) {
        const { error } = await (supabase as any)
          .from("content_task_templates")
          .update(input.patch)
          .eq("id", input.id);
        if (error) throw error;
        return input.id;
      }
      const { data, error } = await (supabase as any)
        .from("content_task_templates")
        .insert({ ...input.patch, workspace_id: workspaceId })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["content-task-templates", workspaceId] });
    },
  });
}

export function useDeleteContentTaskTemplate(workspaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("content_task_templates")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["content-task-templates", workspaceId] });
    },
  });
}

// ---------------- Client content roles ----------------

export type ClientContentRoleRow = {
  client_id: string;
  role_key: ContentRoleKey;
  member_user_id: string;
};

export function useClientContentRoles(clientId: string | undefined) {
  return useQuery<ClientContentRoleRow[]>({
    queryKey: ["client-content-roles", clientId],
    enabled: !!clientId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("client_content_roles")
        .select("client_id, role_key, member_user_id")
        .eq("client_id", clientId);
      if (error) throw error;
      return (data ?? []) as ClientContentRoleRow[];
    },
  });
}

export function useUpsertClientContentRole(clientId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { role_key: ContentRoleKey; member_user_id: string | null }) => {
      if (!clientId) throw new Error("clientId requerido");
      if (input.member_user_id === null) {
        const { error } = await (supabase as any)
          .from("client_content_roles")
          .delete()
          .eq("client_id", clientId)
          .eq("role_key", input.role_key);
        if (error) throw error;
        return;
      }
      const { error } = await (supabase as any)
        .from("client_content_roles")
        .upsert(
          {
            client_id: clientId,
            role_key: input.role_key,
            member_user_id: input.member_user_id,
          },
          { onConflict: "client_id,role_key" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-content-roles", clientId] });
    },
  });
}

// ---------------- Post subtasks (read from tasks) ----------------

export type ContentSubtask = Task & {
  content_subtask_key: ContentSubtaskKey;
};

export function usePostSubtasks(postId: string | null | undefined) {
  return useQuery<ContentSubtask[]>({
    queryKey: ["post-subtasks", postId],
    enabled: !!postId,
    staleTime: 10_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("tasks")
        .select("*")
        .eq("related_post_id", postId)
        .not("content_subtask_key", "is", null)
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({
        ...r,
        tags: Array.isArray(r.tags) ? r.tags : [],
      })) as ContentSubtask[];
    },
  });
}

// ---------------- Posts by ids (for tasks table badge) ----------------

export function usePostsByIds(postIds: string[]) {
  const unique = Array.from(new Set(postIds.filter(Boolean)));
  const key = unique.slice().sort().join(",");
  return useQuery<Record<string, { id: string; title: string | null }>>({
    queryKey: ["posts-by-ids", key],
    enabled: unique.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("social_posts")
        .select("id, title")
        .in("id", unique);
      if (error) throw error;
      const map: Record<string, { id: string; title: string | null }> = {};
      for (const p of (data ?? []) as any[]) map[p.id] = { id: p.id, title: p.title };
      return map;
    },
  });
}
