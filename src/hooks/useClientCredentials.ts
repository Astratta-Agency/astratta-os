import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CredentialCategory =
  | "social_media"
  | "analytics"
  | "hosting_domain_cms"
  | "tool_other";

export type ClientCredential = {
  id: string;
  label: string;
  category: CredentialCategory;
  username: string | null;
  login_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

export type CredentialAccessLogEntry = {
  id: string;
  credential_id: string;
  accessed_at: string;
  actor_id: string | null;
  actor_name: string | null;
  credential_label: string;
};

export function useClientCredentials(clientId: string | undefined) {
  return useQuery<ClientCredential[]>({
    queryKey: ["client-credentials", clientId],
    enabled: !!clientId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("client_credentials")
        .select(
          "id, label, category, username, login_url, notes, created_at, updated_at, created_by",
        )
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ClientCredential[];
    },
  });
}

export function useCanManageCredentials(workspaceId: string | undefined) {
  return useQuery<boolean>({
    queryKey: ["can-manage-credentials", workspaceId],
    enabled: !!workspaceId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes.user?.id;
      if (!userId) return false;
      const { data, error } = await (supabase as any)
        .from("workspace_members")
        .select("role")
        .eq("workspace_id", workspaceId)
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle();
      if (error) return false;
      const role = data?.role;
      return role === "owner" || role === "team_member";
    },
  });
}

export function useCreateCredential(
  clientId: string | undefined,
  _workspaceId: string | undefined,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      label: string;
      category: CredentialCategory;
      secret: string;
      username?: string | null;
      login_url?: string | null;
      notes?: string | null;
    }) => {
      const { data, error } = await (supabase as any).rpc("create_client_credential", {
        _client_id: clientId,
        _label: input.label,
        _category: input.category,
        _secret: input.secret,
        _username: input.username ?? null,
        _login_url: input.login_url ?? null,
        _notes: input.notes ?? null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-credentials", clientId] });
    },
  });
}

export function useUpdateCredentialMeta(clientId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      label: string;
      category: CredentialCategory;
      username?: string | null;
      login_url?: string | null;
      notes?: string | null;
    }) => {
      const { error } = await (supabase as any)
        .from("client_credentials")
        .update({
          label: input.label,
          category: input.category,
          username: input.username ?? null,
          login_url: input.login_url ?? null,
          notes: input.notes ?? null,
        })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-credentials", clientId] });
    },
  });
}

export function useUpdateCredentialSecret(clientId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; secret: string }) => {
      const { error } = await (supabase as any).rpc("update_client_credential_secret", {
        _credential_id: input.id,
        _secret: input.secret,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-credentials", clientId] });
    },
  });
}

export function useRevealCredential() {
  return useMutation({
    mutationFn: async (credentialId: string) => {
      const { data, error } = await (supabase as any).rpc("reveal_client_credential", {
        _credential_id: credentialId,
      });
      if (error) throw error;
      return data as string;
    },
  });
}

export function useDeleteCredential(clientId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("client_credentials")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-credentials", clientId] });
    },
  });
}

export function useCredentialAccessLog(
  clientId: string | undefined,
  workspaceId: string | undefined,
) {
  return useQuery<CredentialAccessLogEntry[]>({
    queryKey: ["credential-access-log", clientId, workspaceId],
    enabled: !!clientId && !!workspaceId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("client_credential_access_log")
        .select(
          "id, credential_id, accessed_at, actor_id, credential:client_credentials!inner(label, client_id)",
        )
        .eq("workspace_id", workspaceId)
        .eq("credential.client_id", clientId)
        .order("accessed_at", { ascending: false })
        .limit(30);
      if (error) throw error;

      const rows = (data ?? []) as any[];
      const actorIds = Array.from(new Set(rows.map((r) => r.actor_id).filter(Boolean)));
      const profileMap = new Map<string, { full_name: string | null; email: string | null }>();
      if (actorIds.length > 0) {
        const { data: profs } = await (supabase as any)
          .from("profiles")
          .select("id, full_name, email")
          .in("id", actorIds);
        for (const p of (profs ?? []) as any[]) {
          profileMap.set(p.id, { full_name: p.full_name ?? null, email: p.email ?? null });
        }
      }

      return rows.map((r) => {
        const p = r.actor_id ? profileMap.get(r.actor_id) : undefined;
        return {
          id: r.id,
          credential_id: r.credential_id,
          accessed_at: r.accessed_at,
          actor_id: r.actor_id,
          actor_name: p?.full_name ?? p?.email ?? null,
          credential_label: r.credential?.label ?? "—",
        };
      });
    },
  });
}

/**
 * Latest access timestamp per credential, restricted to accesses performed by
 * client-portal users of the given client (i.e. excludes agency team accesses).
 * Returns a map: credential_id → ISO timestamp (or absent if never accessed by the client).
 */
export function useClientCredentialClientAccess(
  clientId: string | undefined,
  workspaceId: string | undefined,
) {
  return useQuery<Record<string, string>>({
    queryKey: ["credential-client-access", clientId, workspaceId],
    enabled: !!clientId && !!workspaceId,
    staleTime: 30_000,
    queryFn: async () => {
      // 1. Get user_ids of all client_users for this client.
      const { data: cu, error: cuErr } = await (supabase as any)
        .from("client_users")
        .select("user_id")
        .eq("client_id", clientId);
      if (cuErr) return {};
      const userIds = Array.from(
        new Set(((cu ?? []) as any[]).map((r) => r.user_id).filter(Boolean)),
      );
      if (userIds.length === 0) return {};

      // 2. Fetch access logs authored by those users, scoped to credentials
      // belonging to this client via the inner join.
      const { data, error } = await (supabase as any)
        .from("client_credential_access_log")
        .select(
          "credential_id, accessed_at, actor_id, credential:client_credentials!inner(client_id)",
        )
        .eq("workspace_id", workspaceId)
        .eq("credential.client_id", clientId)
        .in("actor_id", userIds)
        .order("accessed_at", { ascending: false });
      if (error) return {};

      const map: Record<string, string> = {};
      for (const row of (data ?? []) as any[]) {
        if (!map[row.credential_id]) map[row.credential_id] = row.accessed_at;
      }
      return map;
    },
  });
}

