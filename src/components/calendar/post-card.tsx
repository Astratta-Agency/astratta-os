import { useDraggable } from "@dnd-kit/core";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { ChannelIcon } from "./channel-icon";
import { StateBadgePost } from "./state-badge-post";
import type { SocialPostRow, ContentPillar } from "@/hooks/useSocialPosts";

interface Props {
  post: SocialPostRow;
  pillarMap: Map<string, ContentPillar>;
  onClick: () => void;
  compact?: boolean;
  draggable?: boolean;
}

export function PostCard({ post, pillarMap, onClick, compact = true, draggable = true }: Props) {
  const drag = useDraggable({
    id: `post:${post.id}`,
    data: { post },
    disabled: !draggable,
  });

  const pillar = post.content_pillar ? pillarMap.get(post.content_pillar) : null;
  const overdue =
    post.scheduled_for &&
    new Date(post.scheduled_for) < new Date() &&
    post.status !== "published" &&
    post.status !== "archived";

  const style: React.CSSProperties = drag.transform
    ? { transform: `translate3d(${drag.transform.x}px, ${drag.transform.y}px, 0)` }
    : {};

  const time = post.scheduled_for ? format(new Date(post.scheduled_for), "HH:mm") : "";

  return (
    <div ref={drag.setNodeRef} style={style} {...drag.listeners} {...drag.attributes}>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "group flex w-full cursor-grab flex-col gap-1 rounded-md border bg-card p-1.5 text-left transition hover:border-primary/60 active:cursor-grabbing",
          drag.isDragging && "opacity-50",
          overdue && "ring-1 ring-destructive/50",
        )}
      >
        <div className="flex items-center gap-1">
          <div className="flex items-center gap-0.5">
            {post.channels.slice(0, 3).map((c) => (
              <ChannelIcon key={c} channel={c} size="sm" className="h-3 w-3 text-muted-foreground" />
            ))}
            {post.channels.length > 3 && (
              <span className="text-[10px] text-muted-foreground">+{post.channels.length - 3}</span>
            )}
          </div>
          {pillar && (
            <span
              className="ml-auto h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: pillar.color }}
              title={pillar.name}
            />
          )}
        </div>
        <div className="flex items-start gap-1.5">
          {post.media_urls[0] && (
            <img
              src={post.media_urls[0]}
              alt=""
              className="h-8 w-8 shrink-0 rounded object-cover"
              loading="lazy"
            />
          )}
          <p className="line-clamp-1 flex-1 text-[11px] font-medium leading-tight">
            {time && <span className="text-muted-foreground">{time} · </span>}
            {post.caption || post.title || "Sin caption"}
          </p>
        </div>
        {!compact && <StateBadgePost status={post.status} size="sm" />}
      </button>
    </div>
  );
}
