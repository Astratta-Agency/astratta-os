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

/**
 * Colores del calendario por red. No son los colores de marca: TikTok, X y
 * Threads comparten el negro, así que cada red tiene un tono propio y
 * distinguible que se lee en modo claro y oscuro.
 */
export const CHANNEL_CALENDAR_COLOR: Record<Channel, string> = {
  instagram: "#DB2777", // pink-600
  facebook: "#2563EB",  // blue-600
  linkedin: "#0891B2",  // cyan-600
  tiktok: "#64748B",    // slate-500
  x: "#D97706",         // amber-600
  threads: "#7C3AED",   // violet-600
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
