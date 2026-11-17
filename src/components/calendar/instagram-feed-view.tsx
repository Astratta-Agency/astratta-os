import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  Clapperboard,
  Copy,
  Grid3x3,
  Image as ImageIcon,
  ImageOff,
  Play,
} from "lucide-react";

import { ClientLogo } from "@/components/clients/client-logo";
import { MediaThumb } from "@/components/shared/media-thumb";
import type { SocialPostRow } from "@/hooks/useSocialPosts";
import {
  buildFeed,
  filterFeed,
  type FeedKind,
  type FeedTab,
} from "@/lib/instagram-feed";
import { POST_STATE_META } from "@/lib/post-states";
import { cn } from "@/lib/utils";

const TABS: { id: FeedTab; label: string; icon: typeof Grid3x3 }[] = [
  { id: "todo", label: "Todo", icon: Grid3x3 },
  { id: "post", label: "Feed", icon: ImageIcon },
  { id: "carousel", label: "Carruseles", icon: Copy },
  { id: "reel", label: "Reels", icon: Clapperboard },
];

const EMPTY_LABEL: Record<FeedTab, string> = {
  todo: "Aún no hay publicaciones de Instagram para este cliente",
  post: "Aún no hay posts de feed",
  carousel: "Aún no hay carruseles",
  reel: "Aún no hay reels",
};

interface Props {
  /** The client's Instagram posts; stories, archived and rejected are left out here. */
  posts: SocialPostRow[];
  client: {
    name: string;
    logo_url?: string | null;
    brand_primary_color?: string | null;
  };
  onPostClick: (post: SocialPostRow) => void;
  /** Color of the active tab (the portal uses the client's brand color). */
  accentColor?: string;
}

/**
 * Preview of a client's Instagram profile built from the posts planned in the
 * calendar: the full grid, or only feed posts, carousels or reels. Posts that
 * aren't published yet carry their state so the team sees what is still open.
 */
export function InstagramFeedView({
  posts,
  client,
  onPostClick,
  accentColor,
}: Props) {
  const [tab, setTab] = useState<FeedTab>("todo");
  const feed = useMemo(() => buildFeed(posts), [posts]);
  const visible = useMemo(() => filterFeed(feed, tab), [feed, tab]);

  const counts = useMemo(() => {
    const c: Record<FeedKind, number> = { post: 0, carousel: 0, reel: 0 };
    feed.forEach((p) => (c[p.kind] += 1));
    return c;
  }, [feed]);

  const published = feed.filter((p) => p.status === "published").length;

  const stats = [
    { value: feed.length, label: "total" },
    { value: counts.post, label: "feed" },
    { value: counts.carousel, label: "carruseles" },
    { value: counts.reel, label: "reels" },
  ];

  return (
    <div className="mx-auto w-full max-w-[640px] rounded-lg border bg-card">
      <header className="p-4 sm:p-6">
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="shrink-0 rounded-full bg-gradient-to-tr from-amber-400 via-pink-500 to-purple-600 p-[2px]">
            <div className="rounded-full bg-card p-[2px]">
              <ClientLogo
                name={client.name}
                logoUrl={client.logo_url}
                brandColor={client.brand_primary_color}
                size="lg"
                className="h-16 w-16 rounded-full sm:h-20 sm:w-20"
              />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold sm:text-lg">
              {client.name}
            </p>
            {/* From sm up the counts sit next to the avatar, on one line each. */}
            <dl className="mt-2 hidden flex-wrap gap-x-5 gap-y-1 sm:flex">
              {stats.map((s) => (
                <Stat key={s.label} {...s} />
              ))}
            </dl>
            <p className="mt-1 text-xs text-muted-foreground sm:mt-2">
              {published} publicada{published === 1 ? "" : "s"} ·{" "}
              {feed.length - published} por publicar
            </p>
          </div>
        </div>
        {/* On phones they get the card's full width, so the labels don't collide. */}
        <dl className="mt-4 grid grid-cols-4 gap-1 text-center sm:hidden">
          {stats.map((s) => (
            <Stat key={s.label} {...s} />
          ))}
        </dl>
      </header>

      <div
        role="tablist"
        aria-label="Tipo de contenido"
        className="grid grid-cols-4 border-t"
      >
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              className={cn(
                "-mt-px flex items-center justify-center gap-1.5 border-t-2 py-3.5 text-xs font-medium uppercase tracking-wide transition-colors",
                active
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
              style={
                active && accentColor
                  ? { borderColor: accentColor, color: accentColor }
                  : undefined
              }
            >
              <t.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{t.label}</span>
              <span className="sr-only sm:hidden">{t.label}</span>
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-4 py-16 text-center text-sm text-muted-foreground">
          <ImageOff className="mb-2 h-8 w-8" />
          {EMPTY_LABEL[tab]}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-0.5 overflow-hidden rounded-b-lg">
          {visible.map((p) => (
            <FeedTile
              key={p.id}
              post={p}
              kind={p.kind}
              tall={tab === "reel"}
              onClick={() => onPostClick(p)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <dt className="sr-only">{label}</dt>
      <dd className="text-sm sm:whitespace-nowrap">
        <span className="font-semibold">{value}</span>{" "}
        <span className="block text-[11px] text-muted-foreground sm:inline sm:text-sm">
          {label}
        </span>
      </dd>
    </div>
  );
}

function FeedTile({
  post,
  kind,
  tall,
  onClick,
}: {
  post: SocialPostRow;
  kind: FeedKind;
  /** Reels tab shows tiles in 9:16, like Instagram; the grid uses 3:4. */
  tall: boolean;
  onClick: () => void;
}) {
  const cover = post.media_urls[0] ?? post.preview_url;
  const isPublished = post.status === "published";
  const state = POST_STATE_META[post.status];
  const date = post.scheduled_for
    ? format(parseISO(post.scheduled_for), "d MMM yyyy · HH:mm", { locale: es })
    : "Sin fecha";

  return (
    <button
      type="button"
      onClick={onClick}
      title={`${post.title} · ${date}`}
      className={cn(
        "group relative block w-full overflow-hidden bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
        tall ? "aspect-[9/16]" : "aspect-[3/4]",
      )}
    >
      {cover ? (
        <MediaThumb
          url={cover}
          alt={post.title}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 border border-dashed border-muted-foreground/30 p-1.5 text-center text-[10px] leading-tight text-muted-foreground sm:gap-1.5 sm:p-2 sm:text-[11px]">
          <ImageOff className="h-4 w-4 opacity-60 sm:h-5 sm:w-5" />
          <span className="line-clamp-3">{post.title}</span>
          <span className="hidden text-[10px] opacity-70 sm:inline">
            Sin arte todavía
          </span>
        </div>
      )}

      {kind !== "post" && (
        <span
          className="absolute right-1.5 top-1.5 rounded-full bg-black/45 p-1 text-white"
          aria-label={kind === "reel" ? "Reel" : "Carrusel"}
        >
          {kind === "reel" ? (
            <Clapperboard className="h-3.5 w-3.5" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </span>
      )}

      {!isPublished && (
        <span
          className="absolute bottom-1.5 left-1.5 max-w-[calc(100%-0.75rem)] truncate rounded px-1.5 py-0.5 text-[10px] font-medium text-white"
          style={{ backgroundColor: state.color }}
        >
          {state.label}
        </span>
      )}

      {/* Only where hovering exists: on touch screens it would stay stuck after a tap. */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/55 p-2 text-center text-white opacity-0 transition-opacity group-focus-visible:opacity-100 [@media(hover:hover)]:group-hover:opacity-100">
        {kind === "reel" && <Play className="h-5 w-5" />}
        <span className="line-clamp-2 text-xs font-semibold">{post.title}</span>
        <span className="text-[11px] opacity-90">{date}</span>
      </div>
    </button>
  );
}
