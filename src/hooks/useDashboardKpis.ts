import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type DashboardPostToday = {
  id: string;
  scheduled_for: string;
  caption: string | null;
  channels: string[] | null;
  status: string;
  client_id: string;
  client_name: string | null;
};

export type DashboardData = {
  postsPendingApproval: number;
  postsToday: DashboardPostToday[];
  stalePostsCount: number; // pending_approval with last_approval_sent_at > 48h ago
};

export function useDashboardKpis(workspaceId: string | undefined) {
  return useQuery<DashboardData>({
    queryKey: ["dashboard-kpis", workspaceId],
    enabled: !!workspaceId,
    staleTime: 30_000,
    queryFn: async () => {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
      const staleCutoff = new Date(now.getTime() - 48 * 3600 * 1000).toISOString();

      const [pending, today, stale] = await Promise.all([
        (supabase as any)
          .from("social_posts")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", workspaceId)
          .eq("status", "pending_approval"),
        (supabase as any)
          .from("social_posts")
          .select("id, scheduled_for, caption, channels, status, client_id, client:clients!inner(id, name)")
          .eq("workspace_id", workspaceId)
          .in("status", ["scheduled", "approved"])
          .gte("scheduled_for", startOfDay)
          .lt("scheduled_for", endOfDay)
          .order("scheduled_for", { ascending: true }),
        (supabase as any)
          .from("social_posts")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", workspaceId)
          .eq("status", "pending_approval")
          .not("last_approval_sent_at", "is", null)
          .lt("last_approval_sent_at", staleCutoff),
      ]);

      const postsToday: DashboardPostToday[] = ((today.data ?? []) as any[]).map((r) => ({
        id: r.id,
        scheduled_for: r.scheduled_for,
        caption: r.caption ?? null,
        channels: Array.isArray(r.channels) ? r.channels : null,
        status: r.status,
        client_id: r.client_id,
        client_name: r.client?.name ?? null,
      }));

      return {
        postsPendingApproval: pending.count ?? 0,
        postsToday,
        stalePostsCount: stale.count ?? 0,
      };
    },
  });
}
