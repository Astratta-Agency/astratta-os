import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Channel, PostStatus } from "@/lib/post-states";

export type SocialPostRow = {
  id: string;
  workspace_id: string;
  client_id: string;
  project_id: string | null;
  title: string;
  type: string;
  preview_url: string | null;
  caption: string | null;
  scheduled_for: string | null;
  status: PostStatus;
  channels: Channel[];
  content_pillar: string | null;
  media_urls: string[];
  hashtags: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type SocialPostFilters = {
  channels?: Channel[];
  statuses?: PostStatus[];
  pillars?: string[]; // includes "__none__" to filter posts with no pillar
  search?: string;
};

export type DateRange = { from: Date; to: Date };

export function useSocialPosts(opts: {
  workspaceId: string | undefined;
  clientId: string | undefined;
  range: DateRange | null;
  filters: SocialPostFilters;
}) {
  const { workspaceId, clientId, range, filters } = opts;
  return useQuery<SocialPostRow[]>({
    queryKey: [
      "social-posts",
      workspaceId,
      clientId,
      range?.from?.toISOString(),
      range?.to?.toISOString(),
      filters,
    ],
    enabled: !!workspaceId && !!clientId && !!range,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      let q = (supabase as any)
        .from("social_posts")
        .select(
          "id, workspace_id, client_id, project_id, title, type, preview_url, caption, scheduled_for, status, channels, content_pillar, media_urls, hashtags, approved_at, rejected_at, rejection_reason, created_at, updated_at",
        )
        .eq("workspace_id", workspaceId)
        .eq("client_id", clientId)
        .order("scheduled_for", { ascending: true, nullsFirst: false });

      if (range) {
        q = q.gte("scheduled_for", range.from.toISOString()).lte("scheduled_for", range.to.toISOString());
      }

      if (filters.statuses?.length) q = q.in("status", filters.statuses);
      if (filters.channels?.length) q = q.overlaps("channels", filters.channels);
      if (filters.search?.trim()) q = q.ilike("caption", `%${filters.search.trim()}%`);

      if (filters.pillars?.length) {
        const withoutNone = filters.pillars.filter((p) => p !== "__none__");
        const includeNone = filters.pillars.includes("__none__");
        if (includeNone && withoutNone.length === 0) {
          q = q.is("content_pillar", null);
        } else if (includeNone && withoutNone.length > 0) {
          // OR: pillar in (...) or pillar is null
          const orExpr = `content_pillar.in.(${withoutNone.map((s) => `"${s}"`).join(",")}),content_pillar.is.null`;
          q = q.or(orExpr);
        } else {
          q = q.in("content_pillar", withoutNone);
        }
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        ...r,
        channels: Array.isArray(r.channels) ? r.channels : [],
        media_urls: Array.isArray(r.media_urls) ? r.media_urls : [],
      })) as SocialPostRow[];
    },
  });
}

export type ContentPillar = {
  id: string | null;
  name: string;
  color: string;
};

export function useContentPillars(clientId: string | undefined) {
  return useQuery<ContentPillar[]>({
    queryKey: ["content-pillars", clientId],
    enabled: !!clientId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("content_pillars")
        .select("id, name, color, sort_order")
        .eq("client_id", clientId)
        .order("sort_order", { ascending: true });
      if (error) {
        // If table missing or RLS denies, fall back to empty list + "Sin pilar".
        return [{ id: null, name: "Sin pilar", color: "hsl(var(--muted-foreground))" }];
      }
      const rows = (data ?? []).map((r: any) => ({
        id: r.id as string,
        name: r.name as string,
        color: (r.color as string) || "#5140f2",
      }));
      return [...rows, { id: null, name: "Sin pilar", color: "hsl(var(--muted-foreground))" }];
    },
  });
}

export function useUpdatePostSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; scheduled_for: string }) => {
      const { error } = await (supabase as any)
        .from("social_posts")
        .update({ scheduled_for: input.scheduled_for })
        .eq("id", input.id);
      if (error) throw error;
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: ["social-posts"] });
      const snapshots: { key: any; data: any }[] = [];
      qc.getQueriesData({ queryKey: ["social-posts"] }).forEach(([key, data]) => {
        snapshots.push({ key, data });
        if (!Array.isArray(data)) return;
        qc.setQueryData(
          key,
          (data as SocialPostRow[]).map((p) =>
            p.id === input.id ? { ...p, scheduled_for: input.scheduled_for } : p,
          ),
        );
      });
      return { snapshots };
    },
    onError: (_e, _v, ctx: any) => {
      ctx?.snapshots?.forEach((s: any) => qc.setQueryData(s.key, s.data));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["social-posts"] });
    },
  });
}

export type CreatePostInput = {
  workspaceId: string;
  clientId: string;
  caption: string;
  scheduled_for: string;
  channels: Channel[];
  content_pillar: string | null;
  status: PostStatus;
};

export function useCreatePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreatePostInput) => {
      const title =
        (input.caption || "").trim().split("\n")[0]?.slice(0, 80) || "Publicación sin título";
      const { data, error } = await (supabase as any)
        .from("social_posts")
        .insert({
          workspace_id: input.workspaceId,
          client_id: input.clientId,
          title,
          type: "feed_post",
          caption: input.caption,
          scheduled_for: input.scheduled_for,
          channels: input.channels,
          content_pillar: input.content_pillar,
          status: input.status,
        })
        .select()
        .single();
      if (error) throw error;
      return data as SocialPostRow;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["social-posts"] });
    },
  });
}

export function useUpdatePostStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      clientId: string;
      from: PostStatus;
      to: PostStatus;
    }) => {
      const { error } = await (supabase as any)
        .from("social_posts")
        .update({ status: input.to })
        .eq("id", input.id);
      if (error) throw error;

      // Audit history when crossing approval boundary
      const approvalActions: Record<string, string> = {
        pending_approval: "sent_for_approval",
        approved: "approved",
        rejected: "rejected",
      };
      const action = approvalActions[input.to];
      if (action) {
        const { data: userRes } = await supabase.auth.getUser();
        await (supabase as any).from("content_approval_history").insert({
          post_id: input.id,
          client_id: input.clientId,
          action,
          actor_user_id: userRes.user?.id ?? null,
          metadata: { from: input.from, to: input.to },
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["social-posts"] });
      qc.invalidateQueries({ queryKey: ["post-approval-history"] });
    },
  });
}

export function usePostApprovalHistory(postId: string | null) {
  return useQuery({
    queryKey: ["post-approval-history", postId],
    enabled: !!postId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("content_approval_history")
        .select("id, action, comment, metadata, created_at, actor_user_id")
        .eq("post_id", postId)
        .order("created_at", { ascending: false });
      if (error) return [];
      return data ?? [];
    },
  });
}
