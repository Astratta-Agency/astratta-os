import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Channel, PostStatus } from "@/lib/post-states";
import type { SocialPostRow } from "@/hooks/useSocialPosts";

export type PostVariantRow = {
  id: string;
  post_id: string;
  channel: Channel;
  caption: string;
  hashtags: string | null;
  first_comment: string | null;
  mentions: string[];
  location: string | null;
  utm_url: string | null;
  is_enabled: boolean;
  updated_at: string;
  updated_by: string | null;
};

export type PostWithVariants = SocialPostRow & {
  variants: PostVariantRow[];
};

export function usePost(postId: string | null) {
  return useQuery<PostWithVariants | null>({
    queryKey: ["post", postId],
    enabled: !!postId,
    staleTime: 10_000,
    queryFn: async () => {
      if (!postId) return null;
      const { data: post, error } = await (supabase as any)
        .from("social_posts")
        .select(
          "id, workspace_id, client_id, project_id, title, type, preview_url, caption, scheduled_for, status, channels, content_pillar, media_urls, hashtags, approved_at, rejected_at, rejection_reason, created_at, updated_at",
        )
        .eq("id", postId)
        .maybeSingle();
      if (error) throw error;
      if (!post) return null;

      const { data: variants } = await (supabase as any)
        .from("post_variants")
        .select("*")
        .eq("post_id", postId);

      return {
        ...post,
        channels: Array.isArray(post.channels) ? post.channels : [],
        media_urls: Array.isArray(post.media_urls) ? post.media_urls : [],
        variants: (variants ?? []).map((v: any) => ({
          ...v,
          mentions: Array.isArray(v.mentions) ? v.mentions : [],
        })) as PostVariantRow[],
      } as PostWithVariants;
    },
  });
}

export type PostPatch = Partial<{
  title: string;
  caption: string;
  type: string;
  scheduled_for: string | null;
  status: PostStatus;
  channels: Channel[];
  content_pillar: string | null;
  media_urls: string[];
  hashtags: string | null;
}>;

export function useUpdatePost(postId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: PostPatch) => {
      if (!postId) throw new Error("No postId");
      const { error } = await (supabase as any)
        .from("social_posts")
        .update(patch)
        .eq("id", postId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["post", postId] });
      qc.invalidateQueries({ queryKey: ["social-posts"] });
    },
  });
}

export type VariantPatch = Partial<Omit<PostVariantRow, "id" | "post_id" | "updated_at" | "updated_by">>;

export function useUpsertVariant(postId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { channel: Channel; patch: VariantPatch }) => {
      if (!postId) throw new Error("No postId");
      const row = {
        post_id: postId,
        channel: input.channel,
        ...input.patch,
      };
      const { error } = await (supabase as any)
        .from("post_variants")
        .upsert(row, { onConflict: "post_id,channel" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["post", postId] });
    },
  });
}

export function useDeleteVariant(postId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (channel: Channel) => {
      if (!postId) throw new Error("No postId");
      const { error } = await (supabase as any)
        .from("post_variants")
        .update({ is_enabled: false })
        .eq("post_id", postId)
        .eq("channel", channel);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["post", postId] });
    },
  });
}

export type AutosaveStatus = "idle" | "saving" | "saved" | "error";

export function useAutosave<T>(
  value: T,
  saveFn: (v: T) => Promise<void>,
  opts: { delay?: number; enabled?: boolean } = {},
) {
  const { delay = 1500, enabled = true } = opts;
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastValueRef = useRef<string>(JSON.stringify(value));
  const saveFnRef = useRef(saveFn);
  saveFnRef.current = saveFn;

  const flush = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    setStatus("saving");
    try {
      await saveFnRef.current(value);
      lastValueRef.current = JSON.stringify(value);
      setStatus("saved");
      setLastSavedAt(new Date());
    } catch {
      setStatus("error");
    }
  }, [value]);

  useEffect(() => {
    if (!enabled) return;
    const serialized = JSON.stringify(value);
    if (serialized === lastValueRef.current) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void flush();
    }, delay);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [value, enabled, delay, flush]);

  const dirty = useMemo(
    () => JSON.stringify(value) !== lastValueRef.current,
    [value],
  );

  return { status, lastSavedAt, dirty, flush };
}

export function useBeforeUnloadGuard(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const onBefore = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBefore);
    return () => window.removeEventListener("beforeunload", onBefore);
  }, [active]);
}
