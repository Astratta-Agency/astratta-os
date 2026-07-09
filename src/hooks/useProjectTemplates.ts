import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ProjectType } from "@/integrations/supabase/database.types";
import type { TaskPriority, TaskType } from "@/hooks/useTasks";

export type ProjectTemplate = {
  id: string;
  workspace_id: string;
  project_type: ProjectType;
  name: string;
  description: string | null;
  is_default: boolean;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ProjectTemplateTask = {
  id: string;
  template_id: string;
  title: string;
  description: string | null;
  type: TaskType;
  priority: TaskPriority;
  offset_days: number;
  estimated_hours: number | null;
  checklist_items: string[];
  position: number;
  parent_id: string | null;
  created_at: string;
};

export function useProjectTemplates(workspaceId: string | undefined) {
  return useQuery<ProjectTemplate[]>({
    queryKey: ["project-templates", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("project_templates")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("is_default", true)
        .order("project_type", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ProjectTemplate[];
    },
  });
}

export function useProjectTemplateTasks(templateId: string | null | undefined) {
  return useQuery<ProjectTemplateTask[]>({
    queryKey: ["project-template-tasks", templateId],
    enabled: !!templateId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("project_template_tasks")
        .select("*")
        .eq("template_id", templateId)
        .order("position", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({
        ...r,
        checklist_items: Array.isArray(r.checklist_items) ? r.checklist_items : [],
      })) as ProjectTemplateTask[];
    },
  });
}

export function useUpdateProjectTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      name?: string;
      description?: string | null;
      is_active?: boolean;
    }) => {
      const patch: Record<string, unknown> = {};
      if (input.name !== undefined) patch.name = input.name;
      if (input.description !== undefined) patch.description = input.description;
      if (input.is_active !== undefined) patch.is_active = input.is_active;
      const { data, error } = await (supabase as any)
        .from("project_templates")
        .update(patch)
        .eq("id", input.id)
        .select("*")
        .single();
      if (error) throw error;
      return data as ProjectTemplate;
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["project-templates", row.workspace_id] });
    },
  });
}

export type TemplateTaskInput = {
  title: string;
  description?: string | null;
  type: TaskType;
  priority: TaskPriority;
  offset_days: number;
  estimated_hours?: number | null;
  checklist_items?: string[];
  parent_id?: string | null;
};

export function useCreateTemplateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { template_id: string } & TemplateTaskInput) => {
      const { data: existing, error: e1 } = await (supabase as any)
        .from("project_template_tasks")
        .select("position")
        .eq("template_id", input.template_id)
        .order("position", { ascending: false })
        .limit(1);
      if (e1) throw e1;
      const nextPos = ((existing?.[0]?.position as number | undefined) ?? -1) + 1;

      const { data, error } = await (supabase as any)
        .from("project_template_tasks")
        .insert({
          template_id: input.template_id,
          title: input.title,
          description: input.description ?? null,
          type: input.type,
          priority: input.priority,
          offset_days: input.offset_days,
          estimated_hours: input.estimated_hours ?? null,
          checklist_items: input.checklist_items ?? [],
          parent_id: input.parent_id ?? null,
          position: nextPos,
        })
        .select("*")
        .single();
      if (error) throw error;
      return data as ProjectTemplateTask;
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["project-template-tasks", row.template_id] });
    },
  });
}

export function useUpdateTemplateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; template_id: string } & Partial<TemplateTaskInput>) => {
      const { id, template_id, ...patch } = input;
      const { data, error } = await (supabase as any)
        .from("project_template_tasks")
        .update(patch)
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;
      return data as ProjectTemplateTask;
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["project-template-tasks", row.template_id] });
    },
  });
}

export function useDeleteTemplateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; template_id: string }) => {
      const { error } = await (supabase as any)
        .from("project_template_tasks")
        .delete()
        .eq("id", input.id);
      if (error) throw error;
      return input;
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["project-template-tasks", row.template_id] });
    },
  });
}

export function useReorderTemplateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      template_id: string;
      a: { id: string; position: number };
      b: { id: string; position: number };
    }) => {
      // Swap positions via a temporary sentinel to avoid unique conflicts (if any).
      const tmp = -1 - Math.floor(Math.random() * 1_000_000);
      const s1 = await (supabase as any)
        .from("project_template_tasks")
        .update({ position: tmp })
        .eq("id", input.a.id);
      if (s1.error) throw s1.error;
      const s2 = await (supabase as any)
        .from("project_template_tasks")
        .update({ position: input.a.position })
        .eq("id", input.b.id);
      if (s2.error) throw s2.error;
      const s3 = await (supabase as any)
        .from("project_template_tasks")
        .update({ position: input.b.position })
        .eq("id", input.a.id);
      if (s3.error) throw s3.error;
      return input;
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["project-template-tasks", row.template_id] });
    },
  });
}
