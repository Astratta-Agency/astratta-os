import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TeamMember = {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  email: string | null;
  role: string;
};

/**
 * Returns up to 5 workspace_members from the workspace that owns this client.
 * We use workspace membership (not project assignments) because we don't have a
 * project_assignees table yet — this is a "your agency team" widget.
 */
export function useClientTeam(workspaceId: string | undefined) {
  return useQuery<TeamMember[]>({
    queryKey: ["portal-team", workspaceId],
    enabled: !!workspaceId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("workspace_members")
        .select("user_id, role, created_at, profile:profiles!inner(full_name, avatar_url, email)")
        .eq("workspace_id", workspaceId)
        .eq("status", "active")
        .order("created_at", { ascending: true })
        .limit(5);
      if (error) return [];
      return (data ?? []).map((r: any) => ({
        user_id: r.user_id,
        full_name: r.profile?.full_name ?? null,
        avatar_url: r.profile?.avatar_url ?? null,
        email: r.profile?.email ?? null,
        role: r.role,
      })) as TeamMember[];
    },
  });
}
