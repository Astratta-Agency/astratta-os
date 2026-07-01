import { useEffect, useState } from "react";
import { Heart, MessageCircle, Send, Bookmark, Repeat2, ChevronLeft, ChevronRight } from "lucide-react";
import { ChannelIcon } from "../channel-icon";
import { CHANNEL_META } from "@/lib/channels";
import type { Channel } from "@/lib/post-states";
import type { VariantDraft } from "./variant-editor";
import type { PostFormat } from "./post-editor-meta";

interface Props {
  channel: Channel;
  clientName: string;
  clientLogo?: string | null;
  brandColor?: string | null;
  mediaUrls?: string[];
  postType?: PostFormat;
  draft: VariantDraft;
}

function truncate(s: string, n: number): { head: string; truncated: boolean } {
  if (s.length <= n) return { head: s, truncated: false };
  return { head: s.slice(0, n).trimEnd(), truncated: true };
}

function colorHashtags(text: string) {
  return text.split(/(\s+)/).map((part, i) => {
    if (/^#\w+/.test(part) || /^@\w+/.test(part)) {
      return (
        <span key={i} className="text-sky-600 dark:text-sky-400">
          {part}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export function PostPreview({
  channel,
  clientName,
  clientLogo,
  brandColor,
  mediaUrls,
  postType,
  draft,
}: Props) {
  const meta = CHANNEL_META[channel];
  const urls = mediaUrls ?? [];
  const [active, setActive] = useState(0);

  // Reset active slide when media set or channel changes
  useEffect(() => {
    setActive(0);
  }, [channel, urls.join("|")]);

  // Detect aspect ratio of first image
  const [firstRatio, setFirstRatio] = useState<number | null>(null);
  useEffect(() => {
    setFirstRatio(null);
    const first = urls[0];
    if (!first) return;
    const img = new Image();
    let cancelled = false;
    img.onload = () => {
      if (!cancelled && img.naturalHeight > 0) {
        setFirstRatio(img.naturalWidth / img.naturalHeight);
      }
    };
    img.src = first;
    return () => {
      cancelled = true;
    };
  }, [urls[0]]);

  const isVertical =
    channel === "tiktok" || postType === "reel" || postType === "story";
  let aspectClass = "aspect-square";
  if (isVertical) {
    aspectClass = "aspect-[9/16]";
  } else if (firstRatio !== null && firstRatio <= 0.9) {
    aspectClass = "aspect-[4/5]";
  }

  const fullCaption = [draft.caption, draft.hashtags].filter(Boolean).join("\n\n");
  const limit =
    channel === "instagram" ? 125 : channel === "facebook" ? 280 : channel === "x" ? 280 : 600;
  const { head, truncated } = truncate(fullCaption, limit);

  const isWide = channel === "linkedin" || channel === "x" || channel === "threads";
  const frameWidth = isWide ? "max-w-[500px]" : "max-w-[380px]";

  const hasMulti = urls.length > 1;
  const currentUrl = urls[active] ?? urls[0] ?? null;

  const goPrev = () => setActive((i) => Math.max(0, i - 1));
  const goNext = () => setActive((i) => Math.min(urls.length - 1, i + 1));

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
      <div className={`group relative w-full overflow-hidden bg-muted ${aspectClass}`}>
        {currentUrl ? (
          <img src={currentUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center text-xs text-muted-foreground"
            style={{ background: `linear-gradient(135deg, ${meta.color}20, transparent)` }}
          >
            Sin media
          </div>
        )}

        {hasMulti && (
          <>
            {/* Counter */}
            <div className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white">
              {active + 1}/{urls.length}
            </div>

            {/* Arrows */}
            {active > 0 && (
              <button
                type="button"
                onClick={goPrev}
                aria-label="Anterior"
                className="absolute left-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-black opacity-0 shadow transition group-hover:opacity-100"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            {active < urls.length - 1 && (
              <button
                type="button"
                onClick={goNext}
                aria-label="Siguiente"
                className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-black opacity-0 shadow transition group-hover:opacity-100"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            )}

            {/* Dots */}
            <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1">
              {urls.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 w-1.5 rounded-full transition ${
                    i === active ? "bg-white" : "bg-white/50"
                  }`}
                />
              ))}
            </div>
          </>
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
