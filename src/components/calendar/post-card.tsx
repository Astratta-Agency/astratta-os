import { useDraggable } from "@dnd-kit/core";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { CHANNEL_CALENDAR_COLOR } from "@/lib/channels";
import { POST_STATE_META } from "@/lib/post-states";
import { POST_STATUS_DOT } from "@/lib/post-view-colors";
import { ChannelIcon } from "./channel-icon";
import { StateBadgePost } from "./state-badge-post";
import { useCalendarClient } from "./calendar-clients-context";
import type { SocialPostRow, ContentPillar } from "@/hooks/useSocialPosts";
import { MediaThumb } from "@/components/shared/media-thumb";

interface Props {
  post: SocialPostRow;
  pillarMap: Map<string, ContentPillar>;
  onClick: () => void;
  compact?: boolean;
  draggable?: boolean;
}

// Tinte del fondo (~14% de opacidad sobre el color hex de la red).
const TINT = "24";

function channelBackground(colors: string[]): string | undefined {
  if (colors.length === 0) return undefined;
  if (colors.length === 1) return `${colors[0]}${TINT}`;
  return `linear-gradient(90deg, ${colors.map((c) => `${c}${TINT}`).join(", ")})`;
}

export function PostCard({ post, pillarMap, onClick, compact = true, draggable = true }: Props) {
  const drag = useDraggable({
    id: `post:${post.id}`,
    data: { post },
    disabled: !draggable,
  });
  const client = useCalendarClient(post.client_id);

  const pillar = post.content_pillar ? pillarMap.get(post.content_pillar) : null;
  const overdue =
    post.scheduled_for &&
    new Date(post.scheduled_for) < new Date() &&
    post.status !== "published" &&
    post.status !== "archived";
  const faded = post.status === "published" || post.status === "archived";

  const style: React.CSSProperties = drag.transform
    ? { transform: `translate3d(${drag.transform.x}px, ${drag.transform.y}px, 0)` }
    : {};

  const time = post.scheduled_for ? format(new Date(post.scheduled_for), "HH:mm") : "";
  const colors = post.channels.map((c) => CHANNEL_CALENDAR_COLOR[c]);
  const statusLabel = POST_STATE_META[post.status]?.label ?? post.status;

  return (
    <div ref={drag.setNodeRef} style={style} {...drag.listeners} {...drag.attributes}>
      <button
        type="button"
        onClick={onClick}
        style={{ background: channelBackground(colors) }}
        className={cn(
          "group relative flex w-full cursor-grab flex-col gap-1 overflow-hidden rounded-md border bg-card py-1.5 pl-2.5 pr-1.5 text-left transition hover:border-primary/60 active:cursor-grabbing",
          drag.isDragging && "opacity-50",
          faded && "opacity-60",
          overdue && "ring-1 ring-destructive/50",
        )}
      >
        {colors.length > 0 && (
          <span aria-hidden className="absolute inset-y-0 left-0 flex w-1 flex-col">
            {colors.map((c, i) => (
              <span key={i} className="flex-1" style={{ backgroundColor: c }} />
            ))}
          </span>
        )}
        {client && (
          <span className="truncate text-[10px] font-medium text-muted-foreground">{client.name}</span>
        )}
        <div className="flex items-center gap-1">
          <div className="flex items-center gap-0.5">
            {post.channels.slice(0, 3).map((c) => (
              <ChannelIcon
                key={c}
                channel={c}
                size="sm"
                className="h-3 w-3"
                style={{ color: CHANNEL_CALENDAR_COLOR[c] }}
              />
            ))}
            {post.channels.length > 3 && (
              <span className="text-[10px] text-muted-foreground">+{post.channels.length - 3}</span>
            )}
          </div>
          <span className="ml-auto flex items-center gap-1">
            {pillar && (
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: pillar.color }}
                title={pillar.name}
              />
            )}
            {compact && (
              <span
                className={cn("h-2 w-2 shrink-0 rounded-full ring-1 ring-background", POST_STATUS_DOT[post.status])}
                title={statusLabel}
                aria-label={`Estado: ${statusLabel}`}
              />
            )}
          </span>
        </div>
        <div className="flex items-start gap-1.5">
          {/* En la vista "Todos los clientes" se omite la miniatura para que la tarjeta sea compacta. */}
          {!client && post.media_urls[0] && (
            <MediaThumb
              url={post.media_urls[0]}
              className="h-8 w-8 shrink-0 rounded object-cover"
            />
          )}
          <p className="line-clamp-1 flex-1 text-[11px] font-medium leading-tight">
            {time && <span className="text-muted-foreground">{time} · </span>}
            {post.title || post.caption || "Sin título"}
          </p>
        </div>
        {!compact && <StateBadgePost status={post.status} size="sm" />}
      </button>
    </div>
  );
}
