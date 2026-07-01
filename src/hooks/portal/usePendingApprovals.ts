import { useEffect, useId } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Channel, PostStatus } from "@/lib/post-states";

export type ApprovalVariant = {
  id: string;
  channel: Channel;
  caption: string;
  hashtags: string | null;
  first_comment: string | null;
  is_enabled: boolean;
};

export type ApprovalPost = {
  id: string;
  workspace_id: string;
  client_id: string;
  title: string;
  type: string;
  caption: string | null;
  scheduled_for: string | null;
  status: PostStatus;
  channels: Channel[];
  content_pillar: string | null;
  media_urls: string[];
  hashtags: string | null;
  rejection_reason: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  created_at: string;
  updated_at: string;
  post_variants: ApprovalVariant[];
};

export function useApprovalsByStatus(clientId: string | undefined, statuses: PostStatus[]) {
  const qc = useQueryClient();
  const key = ["portal-approvals", clientId, statuses.slice().sort().join(",")];

  const query = useQuery<ApprovalPost[]>({
    queryKey: key,
    enabled: !!clientId && statuses.length > 0,
    staleTime: 15_000,
    queryFn: async () => {
      const asc = statuses.includes("pending_approval");
      const { data, error } = await (supabase as any)
        .from("social_posts")
        .select(
          "id, workspace_id, client_id, title, type, caption, scheduled_for, status, channels, content_pillar, media_urls, hashtags, rejection_reason, approved_at, rejected_at, created_at, updated_at, post_variants(id, channel, caption, hashtags, first_comment, is_enabled)",
        )
        .eq("client_id", clientId)
        .in("status", statuses)
        .order("scheduled_for", { ascending: asc, nullsFirst: false });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        ...r,
        channels: Array.isArray(r.channels) ? r.channels : [],
        media_urls: Array.isArray(r.media_urls) ? r.media_urls : [],
        post_variants: Array.isArray(r.post_variants) ? r.post_variants : [],
      })) as ApprovalPost[];
    },
  });

  useEffect(() => {
    if (!clientId) return;
    const channel = supabase
      .channel(`portal-posts:${clientId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "social_posts", filter: `client_id=eq.${clientId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["portal-approvals", clientId] });
          qc.invalidateQueries({ queryKey: ["portal-kpis", clientId] });
          qc.invalidateQueries({ queryKey: ["portal-upcoming", clientId] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [clientId, qc]);

  return query;
}

export function usePendingApprovals(clientId: string | undefined) {
  return useApprovalsByStatus(clientId, ["pending_approval"]);
}
