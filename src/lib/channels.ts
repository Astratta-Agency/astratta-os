import type { Channel } from "@/lib/post-states";

export type ChannelMeta = {
  label: string;
  limit: number;
  hashtagLimit: number;
  firstComment: boolean;
  color: string;
};

export const CHANNEL_META: Record<Channel, ChannelMeta> = {
  instagram: { label: "Instagram", limit: 2200, hashtagLimit: 30, firstComment: true, color: "#E4405F" },
  facebook: { label: "Facebook", limit: 63206, hashtagLimit: 30, firstComment: false, color: "#1877F2" },
  linkedin: { label: "LinkedIn", limit: 3000, hashtagLimit: 5, firstComment: false, color: "#0A66C2" },
  tiktok: { label: "TikTok", limit: 2200, hashtagLimit: 30, firstComment: false, color: "#000000" },
  x: { label: "X", limit: 280, hashtagLimit: 5, firstComment: false, color: "#000000" },
  threads: { label: "Threads", limit: 500, hashtagLimit: 10, firstComment: false, color: "#000000" },
};

export function countHashtags(s: string | null | undefined): number {
  if (!s) return 0;
  return (s.match(/#\w+/g) ?? []).length;
}

export function counterTone(count: number, limit: number): "ok" | "warn" | "over" {
  const ratio = count / limit;
  if (ratio >= 1) return "over";
  if (ratio >= 0.8) return "warn";
  return "ok";
}
