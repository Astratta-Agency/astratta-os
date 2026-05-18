import { Heart, MessageCircle, Send, Bookmark, Repeat2 } from "lucide-react";
import { ChannelIcon } from "../channel-icon";
import { CHANNEL_META } from "@/lib/channels";
import type { Channel } from "@/lib/post-states";
import type { VariantDraft } from "./variant-editor";

interface Props {
  channel: Channel;
  clientName: string;
  clientLogo?: string | null;
  brandColor?: string | null;
  mediaUrl?: string | null;
  draft: VariantDraft;
}

function truncate(s: string, n: number): { head: string; truncated: boolean } {
  if (s.length <= n) return { head: s, truncated: false };
  return { head: s.slice(0, n).trimEnd(), truncated: true };
}

function colorHashtags(text: string) {
  return text.split(/(\s+)/).map((part, i) => {
    if (/^#\w+/.test(part)) {
      return (
        <span key={i} className="text-sky-600 dark:text-sky-400">
          {part}
        </span>
      );
    }
    if (/^@\w+/.test(part)) {
      return (
        <span key={i} className="text-sky-600 dark:text-sky-400">
          {part}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export function PostPreview({ channel, clientName, clientLogo, brandColor, mediaUrl, draft }: Props) {
  const meta = CHANNEL_META[channel];

  const fullCaption = [draft.caption, draft.hashtags].filter(Boolean).join("\n\n");
  const limit =
    channel === "instagram" ? 125 : channel === "facebook" ? 280 : channel === "x" ? 280 : 600;
  const { head, truncated } = truncate(fullCaption, limit);

  const isWide = channel === "linkedin" || channel === "x" || channel === "threads";
  const frameWidth = isWide ? "max-w-[500px]" : "max-w-[380px]";

  return (
    <div className={`mx-auto ${frameWidth} overflow-hidden rounded-xl border bg-card shadow-sm`}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2">
        <div
          className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full text-xs font-bold text-white"
          style={{ backgroundColor: brandColor ?? "#5140f2" }}
        >
          {clientLogo ? (
            <img src={clientLogo} alt={clientName} className="h-full w-full object-cover" />
          ) : (
            clientName.slice(0, 1).toUpperCase()
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold">{clientName}</p>
          {draft.location ? (
            <p className="truncate text-[10px] text-muted-foreground">{draft.location}</p>
          ) : (
            <p className="text-[10px] text-muted-foreground">ahora · Patrocinado</p>
          )}
        </div>
        <ChannelIcon channel={channel} size="sm" className="text-muted-foreground" />
      </div>

      {/* Media */}
      <div
        className={`relative w-full overflow-hidden bg-muted ${
          channel === "tiktok" ? "aspect-[9/16]" : "aspect-square"
        }`}
      >
        {mediaUrl ? (
          <img src={mediaUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center text-xs text-muted-foreground"
            style={{ background: `linear-gradient(135deg, ${meta.color}20, transparent)` }}
          >
            Sin media
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 px-3 py-2 text-foreground/70">
        <Heart className="h-4 w-4" />
        <MessageCircle className="h-4 w-4" />
        {channel === "x" || channel === "threads" ? (
          <Repeat2 className="h-4 w-4" />
        ) : (
          <Send className="h-4 w-4" />
        )}
        <Bookmark className="ml-auto h-4 w-4" />
      </div>

      {/* Caption */}
      <div className="space-y-1.5 px-3 pb-3 text-xs leading-relaxed">
        <p className="whitespace-pre-wrap break-words">
          <span className="font-semibold">{clientName.toLowerCase().replace(/\s+/g, "")}</span>{" "}
          {colorHashtags(head)}
          {truncated && <span className="text-muted-foreground"> ... más</span>}
        </p>
        {draft.mentions.length > 0 && (
          <p className="text-[11px] text-muted-foreground">
            Con: {draft.mentions.join(" ")}
          </p>
        )}
        {channel === "instagram" && draft.first_comment && (
          <p className="border-t pt-2 text-[11px]">
            <span className="font-semibold">{clientName.toLowerCase().replace(/\s+/g, "")}</span>{" "}
            <span className="text-muted-foreground">{draft.first_comment}</span>
          </p>
        )}
      </div>
    </div>
  );
}
