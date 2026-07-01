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

export function useDeletePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (postId: string) => {
      const { error } = await (supabase as any)
        .from("social_posts")
        .delete()
        .eq("id", postId);
      if (error) throw error;
    },
    onSuccess: (_d, postId) => {
      qc.invalidateQueries({ queryKey: ["social-posts"] });
      qc.removeQueries({ queryKey: ["post", postId] });
    },
  });
}

export function useDuplicatePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (postId: string): Promise<string> => {
      const { data: src, error: e1 } = await (supabase as any)
        .from("social_posts")
        .select(
          "workspace_id, client_id, project_id, title, type, caption, channels, content_pillar, media_urls, hashtags",
        )
        .eq("id", postId)
        .maybeSingle();
      if (e1) throw e1;
      if (!src) throw new Error("Publicación no encontrada");

      const dupTitle = src.title ? `${src.title} (copia)` : "Publicación sin título (copia)";
      const { data: inserted, error: e2 } = await (supabase as any)
        .from("social_posts")
        .insert({
          workspace_id: src.workspace_id,
          client_id: src.client_id,
          project_id: src.project_id,
          title: dupTitle,
          type: src.type,
          caption: src.caption,
          channels: src.channels ?? [],
          content_pillar: src.content_pillar,
          media_urls: src.media_urls ?? [],
          hashtags: src.hashtags,
          status: "draft",
          scheduled_for: null,
        })
        .select("id")
        .single();
      if (e2) throw e2;
      const newId = inserted.id as string;

      const { data: variants } = await (supabase as any)
        .from("post_variants")
        .select("channel, caption, hashtags, first_comment, mentions, location, is_enabled")
        .eq("post_id", postId);

      if (variants && variants.length > 0) {
        const rows = variants.map((v: any) => ({
          post_id: newId,
          channel: v.channel,
          caption: v.caption ?? "",
          hashtags: v.hashtags,
          first_comment: v.first_comment,
          mentions: Array.isArray(v.mentions) ? v.mentions : [],
          location: v.location,
          utm_url: null,
          is_enabled: v.is_enabled ?? true,
        }));
        const { error: e3 } = await (supabase as any).from("post_variants").insert(rows);
        if (e3) throw e3;
      }

      return newId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["social-posts"] });
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
