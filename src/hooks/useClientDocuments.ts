import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { deleteAssetFromStorage, uploadAsset } from "@/lib/storage";

export type ClientDocumentCategory = "brief" | "kickoff" | "brand_guidelines" | "other";

export const DOCUMENT_CATEGORY_LABEL: Record<ClientDocumentCategory, string> = {
  brief: "Brief",
  kickoff: "Kickoff",
  brand_guidelines: "Brand guidelines",
  other: "Otro",
};

export type ClientDocumentRow = {
  id: string;
  workspace_id: string;
  client_id: string;
  uploaded_by: string | null;
  title: string;
  category: ClientDocumentCategory;
  storage_path: string;
  public_url: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
};

export function useClientDocuments(clientId: string | undefined) {
  return useQuery<ClientDocumentRow[]>({
    queryKey: ["client-documents", clientId],
    enabled: !!clientId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("client_documents")
        .select(
          "id, workspace_id, client_id, uploaded_by, title, category, storage_path, public_url, file_name, mime_type, size_bytes, created_at",
        )
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) {
        // Table may not exist yet if the migration hasn't been applied — degrade gracefully.
        return [];
      }
      return (data ?? []) as ClientDocumentRow[];
    },
  });
}

export type UploadClientDocumentInput = {
  file: File;
  title: string;
  category: ClientDocumentCategory;
};

export function useUploadClientDocument(
  clientId: string | undefined,
  workspaceId: string | undefined,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UploadClientDocumentInput) => {
      if (!clientId || !workspaceId) throw new Error("Falta cliente o workspace");
      const res = await uploadAsset({
        file: input.file,
        workspaceId,
        clientId,
        subfolder: "documents",
      });
      if (!res.ok) {
        if (res.error === "file_too_large") throw new Error("El archivo supera el tamaño máximo.");
        if (res.error === "invalid_type") throw new Error("Tipo de archivo no permitido. Solo PDF.");
        throw new Error(res.message ?? "No se pudo subir el archivo.");
      }
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await (supabase as any)
        .from("client_documents")
        .insert({
          workspace_id: workspaceId,
          client_id: clientId,
          uploaded_by: userData.user?.id ?? null,
          title: input.title,
          category: input.category,
          storage_path: res.storagePath,
          public_url: res.publicUrl,
          file_name: res.fileName,
          mime_type: res.mimeType,
          size_bytes: res.sizeBytes,
        })
        .select()
        .single();
      if (error) {
        // Best-effort cleanup: remove the just-uploaded file if the row insert failed.
        try {
          await deleteAssetFromStorage(res.storagePath);
        } catch {
          /* ignore */
        }
        throw error;
      }
      return data as ClientDocumentRow;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-documents", clientId] });
    },
  });
}

export function useDeleteClientDocument(clientId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (doc: { id: string; storage_path: string }) => {
      try {
        await deleteAssetFromStorage(doc.storage_path);
      } catch {
        /* continue: still delete the row */
      }
      const { error } = await (supabase as any)
        .from("client_documents")
        .delete()
        .eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-documents", clientId] });
    },
  });
}

// ---------------- Related-documents queries ----------------

export type SignedContractSummary = {
  id: string;
  title: string;
  service_type: string;
  status: string;
  public_token: string;
  client_signed_at: string | null;
  countersigned_at: string | null;
};

const SIGNED_CONTRACT_STATUSES = [
  "sent",
  "signed_by_client",
  "countersigned",
  "active",
  "expired",
  "renewed",
];

export function useSignedContractsForClient(clientId: string | undefined) {
  return useQuery<SignedContractSummary[]>({
    queryKey: ["signed-contracts", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("contracts")
        .select("id, title, service_type, status, public_token, client_signed_at, countersigned_at")
        .eq("client_id", clientId)
        .in("status", SIGNED_CONTRACT_STATUSES)
        .order("created_at", { ascending: false });
      if (error) return [];
      return (data ?? []) as SignedContractSummary[];
    },
  });
}

export type SignedProposalSummary = {
  id: string;
  title: string;
  type: string;
  status: string;
  public_token: string;
  signed_at: string | null;
};

export function useSignedProposalsForClient(clientId: string | undefined) {
  return useQuery<SignedProposalSummary[]>({
    queryKey: ["signed-proposals", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      // proposals have no direct client_id; go via leads.converted_client_id.
      const { data: leads, error: lErr } = await (supabase as any)
        .from("leads")
        .select("id")
        .eq("converted_client_id", clientId);
      if (lErr) return [];
      const leadIds = (leads ?? []).map((l: any) => l.id);
      if (leadIds.length === 0) return [];
      const { data, error } = await (supabase as any)
        .from("proposals")
        .select("id, title, type, status, public_token, signed_at")
        .in("lead_id", leadIds)
        .eq("status", "signed")
        .order("signed_at", { ascending: false });
      if (error) return [];
      return (data ?? []) as SignedProposalSummary[];
    },
  });
}

export function formatFileSize(bytes: number): string {
  if (!bytes || bytes < 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
