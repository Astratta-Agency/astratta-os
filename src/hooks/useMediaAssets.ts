import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  deleteAssetFromStorage,
  uploadAsset,
  type UploadResult,
} from "@/lib/storage";

export type MediaAssetRow = {
  id: string;
  workspace_id: string;
  client_id: string;
  uploaded_by: string | null;
  file_name: string;
  storage_path: string;
  public_url: string;
  mime_type: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  tags: string[];
  orientation: "landscape" | "portrait" | "square" | null;
  consent_required: boolean;
  consent_signed: boolean;
  consent_form_url: string | null;
  patient_ref: string | null;
  treatment: string | null;
  before_after_pair_id: string | null;
  created_at: string;
};

export type MediaFilters = {
  search?: string;
  tags?: string[];
  pendingConsentOnly?: boolean;
};

export function useMediaAssets(clientId: string | undefined, filters: MediaFilters = {}) {
  const { search = "", tags = [], pendingConsentOnly = false } = filters;
  return useQuery<MediaAssetRow[]>({
    queryKey: ["media-assets", clientId, search, tags.sort().join(","), pendingConsentOnly],
    enabled: !!clientId,
    staleTime: 10_000,
    queryFn: async () => {
      if (!clientId) return [];
      let q = (supabase as any)
        .from("media_assets")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (search.trim()) q = q.ilike("file_name", `%${search.trim()}%`);
      if (tags.length) q = q.contains("tags", tags);
      if (pendingConsentOnly) {
        q = q.eq("consent_required", true).eq("consent_signed", false);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        ...r,
        tags: Array.isArray(r.tags) ? r.tags : [],
      })) as MediaAssetRow[];
    },
  });
}

export function useAssetsByUrls(publicUrls: string[]) {
  const key = publicUrls.slice().sort().join("|");
  return useQuery<MediaAssetRow[]>({
    queryKey: ["media-assets-by-urls", key],
    enabled: publicUrls.length > 0,
    staleTime: 10_000,
    queryFn: async () => {
      if (!publicUrls.length) return [];
      const { data, error } = await (supabase as any)
        .from("media_assets")
        .select("*")
        .in("public_url", publicUrls);
      if (error) throw error;
      return (data ?? []) as MediaAssetRow[];
    },
  });
}

export type UseUploadInput = {
  file: File;
  workspaceId: string;
  clientId: string;
  consentRequired?: boolean;
  subfolder?: string;
};

export function useUploadAsset() {
  const qc = useQueryClient();
  return useMutation<MediaAssetRow, Error, UseUploadInput>({
    mutationFn: async (input) => {
      const result: UploadResult = await uploadAsset({
        file: input.file,
        workspaceId: input.workspaceId,
        clientId: input.clientId,
        subfolder: input.subfolder,
      });
      if (!result.ok) {
        throw new Error(
          result.error === "file_too_large"
            ? "El archivo supera 50MB"
            : result.error === "invalid_type"
              ? "Tipo de archivo no permitido"
              : result.message || "Error al subir el archivo",
        );
      }

      const { data: userData } = await supabase.auth.getUser();
      const row = {
        workspace_id: input.workspaceId,
        client_id: input.clientId,
        uploaded_by: userData.user?.id ?? null,
        file_name: result.fileName,
        storage_path: result.storagePath,
        public_url: result.publicUrl,
        mime_type: result.mimeType,
        size_bytes: result.sizeBytes,
        width: result.width ?? null,
        height: result.height ?? null,
        duration_seconds: result.durationSeconds ?? null,
        consent_required: !!input.consentRequired,
      };

      const { data, error } = await (supabase as any)
        .from("media_assets")
        .insert(row)
        .select("*")
        .single();

      if (error) {
        // Rollback the storage upload to avoid orphans.
        try {
          await deleteAssetFromStorage(result.storagePath);
        } catch {
          /* swallow */
        }
        throw error;
      }
      return { ...data, tags: data.tags ?? [] } as MediaAssetRow;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["media-assets", vars.clientId] });
    },
  });
}

export function useDeleteAsset() {
  const qc = useQueryClient();
  return useMutation<void, Error, MediaAssetRow>({
    mutationFn: async (asset) => {
      // Delete the row first; if it succeeds, delete the storage object.
      const { error } = await (supabase as any)
        .from("media_assets")
        .delete()
        .eq("id", asset.id);
      if (error) throw error;
      try {
        await deleteAssetFromStorage(asset.storage_path);
      } catch (e) {
        // Storage deletion failed — best-effort orphan. Don't rollback the
        // table delete (the asset is logically gone for the app).
        console.warn("Storage delete failed for", asset.storage_path, e);
      }
    },
    onSuccess: (_, asset) => {
      qc.invalidateQueries({ queryKey: ["media-assets", asset.client_id] });
    },
  });
}

export function useUpdateAsset() {
  const qc = useQueryClient();
  return useMutation<
    MediaAssetRow,
    Error,
    { id: string; clientId: string; patch: Partial<MediaAssetRow> }
  >({
    mutationFn: async ({ id, patch }) => {
      const { data, error } = await (supabase as any)
        .from("media_assets")
        .update(patch)
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;
      return { ...data, tags: data.tags ?? [] } as MediaAssetRow;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["media-assets", vars.clientId] });
    },
  });
}
