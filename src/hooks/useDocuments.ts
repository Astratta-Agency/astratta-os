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
  /** Parent page when this doc is a subpage. */
  parent_id: string | null;
  /** Emoji shown before the title. */
  icon: string | null;
  /** Cover band color, "#rrggbb". */
  cover_color: string | null;
  archived_at: string | null;
  position: number;
};

export type DocumentsFilters = {
  search?: string;
  type?: DocumentType | "all";
  clientId?: string | "all";
  /** Archived docs only (default: only active ones). */
  archived?: boolean;
  /** Only docs created by this user. */
  createdBy?: string;
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
      q = filters.archived ? q.not("archived_at", "is", null) : q.is("archived_at", null);
      if (filters.createdBy) q = q.eq("created_by", filters.createdBy);

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
      parent_id?: string | null;
      icon?: string | null;
      content?: Record<string, unknown>;
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
          parent_id: input.parent_id ?? null,
          icon: input.icon ?? null,
          ...(input.content ? { content: input.content } : {}),
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

// ---------------------------------------------------------------- favorites --

/** Ids of the docs the current user starred in this workspace. */
export function useDocumentFavorites(workspaceId: string | undefined) {
  return useQuery<Set<string>>({
    queryKey: ["document-favorites", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("document_favorites")
        .select("document_id")
        .eq("workspace_id", workspaceId);
      if (error) throw error;
      return new Set(((data ?? []) as { document_id: string }[]).map((r) => r.document_id));
    },
  });
}

export function useToggleDocumentFavorite(workspaceId: string | undefined) {
  const qc = useQueryClient();
  const key = ["document-favorites", workspaceId];
  return useMutation({
    mutationFn: async ({ id, favorite }: { id: string; favorite: boolean }) => {
      const q = (supabase as any).from("document_favorites");
      const { error } = favorite
        ? await q.insert({ document_id: id, workspace_id: workspaceId })
        : await q.delete().eq("document_id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, favorite }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Set<string>>(key);
      const next = new Set(prev ?? []);
      favorite ? next.add(id) : next.delete(id);
      qc.setQueryData(key, next);
      return { prev };
    },
    onError: (_e, _v, ctx) => qc.setQueryData(key, ctx?.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}
