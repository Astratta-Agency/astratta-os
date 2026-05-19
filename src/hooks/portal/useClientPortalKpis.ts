import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PortalKpis = {
  publishedThisMonth: number;
  pendingApprovals: number;
  scheduledNext7Days: number;
  nextProjectDeadline: { project_id: string; name: string; end_date: string } | null;
  nextScheduledPost: { id: string; scheduled_for: string; caption: string | null } | null;
};

export function useClientPortalKpis(clientId: string | undefined) {
  return useQuery<PortalKpis>({
    queryKey: ["portal-kpis", clientId],
    enabled: !!clientId,
    staleTime: 30_000,
    queryFn: async () => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const in7 = new Date(now.getTime() + 7 * 24 * 3600 * 1000).toISOString();
      const in14 = new Date(now.getTime() + 14 * 24 * 3600 * 1000).toISOString().slice(0, 10);

      const [published, pending, scheduled, nextPost, projects] = await Promise.all([
        (supabase as any)
          .from("social_posts")
          .select("id", { count: "exact", head: true })
          .eq("client_id", clientId)
          .eq("status", "published")
          .gte("scheduled_for", monthStart),
        (supabase as any)
          .from("social_posts")
          .select("id", { count: "exact", head: true })
          .eq("client_id", clientId)
          .eq("status", "pending_approval"),
        (supabase as any)
          .from("social_posts")
          .select("id", { count: "exact", head: true })
          .eq("client_id", clientId)
          .in("status", ["scheduled", "approved"])
          .gte("scheduled_for", now.toISOString())
          .lte("scheduled_for", in7),
        (supabase as any)
          .from("social_posts")
          .select("id, scheduled_for, caption")
          .eq("client_id", clientId)
          .in("status", ["scheduled", "approved"])
          .gte("scheduled_for", now.toISOString())
          .order("scheduled_for", { ascending: true })
          .limit(1)
          .maybeSingle(),
        (supabase as any)
          .from("projects")
          .select("id, name, end_date")
          .eq("client_id", clientId)
          .gte("end_date", now.toISOString().slice(0, 10))
          .lte("end_date", in14)
          .order("end_date", { ascending: true })
          .limit(1)
          .maybeSingle(),
      ]);

      return {
        publishedThisMonth: published.count ?? 0,
        pendingApprovals: pending.count ?? 0,
        scheduledNext7Days: scheduled.count ?? 0,
        nextScheduledPost: nextPost.data
          ? {
              id: nextPost.data.id,
              scheduled_for: nextPost.data.scheduled_for,
              caption: nextPost.data.caption,
            }
          : null,
        nextProjectDeadline: projects.data
          ? {
              project_id: projects.data.id,
              name: projects.data.name,
              end_date: projects.data.end_date,
            }
          : null,
      };
    },
  });
}
