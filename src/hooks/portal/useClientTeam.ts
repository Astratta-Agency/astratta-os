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
      const { data: members, error } = await (supabase as any)
        .from("workspace_members")
        .select("user_id, role, created_at")
        .eq("workspace_id", workspaceId)
        .eq("status", "active")
        .order("created_at", { ascending: true })
        .limit(5);
      if (error) return [];
      const rows = (members ?? []) as any[];
      const userIds = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean)));
      const profileMap = new Map<string, { full_name: string | null; avatar_url: string | null; email: string | null }>();
      if (userIds.length > 0) {
        const { data: profs } = await (supabase as any)
          .from("profiles")
          .select("id, full_name, avatar_url, email")
          .in("id", userIds);
        for (const p of (profs ?? []) as any[]) {
          profileMap.set(p.id, {
            full_name: p.full_name ?? null,
            avatar_url: p.avatar_url ?? null,
            email: p.email ?? null,
          });
        }
      }
      return rows.map((r) => {
        const p = profileMap.get(r.user_id);
        return {
          user_id: r.user_id,
          full_name: p?.full_name ?? null,
          avatar_url: p?.avatar_url ?? null,
          email: p?.email ?? null,
          role: r.role,
        };
      }) as TeamMember[];
    },
  });
}
