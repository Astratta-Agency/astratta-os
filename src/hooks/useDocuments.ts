import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type DocumentType = "idea" | "script" | "kpi_plan" | "nota" | "otro";

export const DOCUMENT_TYPE_LABEL: Record<DocumentType, string> = {
  idea: "Idea",
  script: "Script",
  kpi_plan: "Plan de KPIs",
  nota: "Nota",
  otro: "Otro",
};

export type Doc = {
  id: string;
  workspace_id: string;
  title: string;
  content: Record<string, unknown>;
  type: DocumentType;
  client_id: string | null;
  post_id: string | null;
  period: string | null;
  visible_in_portal: boolean;
  converted_to_post_id: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type DocumentsFilters = {
  search?: string;
  type?: DocumentType | "all";
  clientId?: string | "all";
};

export function useDocuments(workspaceId: string | undefined, filters: DocumentsFilters = {}) {
  return useQuery<Doc[]>({
    queryKey: ["documents", workspaceId, filters],
    enabled: !!workspaceId,
    staleTime: 15_000,
    queryFn: async () => {
      let q = (supabase as any)
        .from("documents")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("updated_at", { ascending: false });

      if (filters.search?.trim()) q = q.ilike("title", `%${filters.search.trim()}%`);
      if (filters.type && filters.type !== "all") q = q.eq("type", filters.type);
      if (filters.clientId && filters.clientId !== "all") q = q.eq("client_id", filters.clientId);

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Doc[];
    },
  });
}

export function useDocument(id: string | undefined) {
  return useQuery<Doc | null>({
    queryKey: ["document", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("documents")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return (data as Doc) ?? null;
    },
  });
}

export function useCreateDocument(workspaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      title?: string;
      type?: DocumentType;
      client_id?: string | null;
      post_id?: string | null;
    }) => {
      const { data: auth } = await supabase.auth.getUser();
      const { data, error } = await (supabase as any)
        .from("documents")
        .insert({
          workspace_id: workspaceId,
          title: input.title ?? "Sin título",
          type: input.type ?? "nota",
          client_id: input.client_id ?? null,
          post_id: input.post_id ?? null,
          created_by: auth.user?.id,
        })
        .select("*")
        .single();
      if (error) throw error;
      return data as Doc;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documents", workspaceId] }),
  });
}

export function useUpdateDocument(workspaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string } & Partial<Omit<Doc, "id">>) => {
      const { id, ...patch } = input;
      const { data, error } = await (supabase as any)
        .from("documents")
        .update(patch)
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;
      return data as Doc;
    },
    onSuccess: (doc) => {
      qc.invalidateQueries({ queryKey: ["documents", workspaceId] });
      qc.setQueryData(["document", doc.id], doc);
    },
  });
}

export function useDeleteDocument(workspaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("documents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documents", workspaceId] }),
  });
}
