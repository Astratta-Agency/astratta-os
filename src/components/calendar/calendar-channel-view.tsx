import { useMemo } from "react";
import { format, startOfDay, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { CHANNELS } from "@/lib/post-states";
import { CHANNEL_META } from "@/lib/channels";
import type { SocialPostRow, ContentPillar } from "@/hooks/useSocialPosts";
import { ChannelIcon } from "./channel-icon";
import { PostCard } from "./post-card";

interface Props {
  posts: SocialPostRow[];
  pillarMap: Map<string, ContentPillar>;
  onPostClick: (p: SocialPostRow) => void;
}

function capitalizeFirst(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function CalendarChannelView({ posts, pillarMap, onPostClick }: Props) {
  const byChannel = useMemo(() => {
    const map = new Map<string, SocialPostRow[]>();
    for (const c of CHANNELS) {
      const filtered = posts
        .filter((p) => p.channels.includes(c))
        .sort((a, b) => {
          const ta = a.scheduled_for ? new Date(a.scheduled_for).getTime() : 0;
          const tb = b.scheduled_for ? new Date(b.scheduled_for).getTime() : 0;
          return ta - tb;
        });
      map.set(c, filtered);
    }
    return map;
  }, [posts]);

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {CHANNELS.map((c) => {
        const channelPosts = byChannel.get(c) ?? [];
        const meta = CHANNEL_META[c];

        // Group by day
        const dayGroups: { date: Date; posts: SocialPostRow[] }[] = [];
        for (const p of channelPosts) {
          if (!p.scheduled_for) continue;
          const d = startOfDay(new Date(p.scheduled_for));
          const existing = dayGroups.find((g) => isSameDay(g.date, d));
          if (existing) {
            existing.posts.push(p);
          } else {
            dayGroups.push({ date: d, posts: [p] });
          }
        }

        return (
          <div
            key={c}
            className="flex min-w-[260px] shrink-0 flex-col rounded-lg border bg-card"
            style={{ borderTopWidth: 3, borderTopColor: meta.color }}
          >
            {/* Header */}
            <div className="flex items-center gap-2 border-b p-3">
              <ChannelIcon channel={c} size="md" />
              <span className="text-sm font-medium">{meta.label}</span>
              <Badge variant="secondary" className="ml-auto text-xs">
                {channelPosts.length}
              </Badge>
            </div>

            {/* Body */}
            <div className="flex flex-1 flex-col gap-3 p-2">
              {channelPosts.length === 0 ? (
                <p className="py-8 text-center text-xs text-muted-foreground">
                  Sin publicaciones
                </p>
              ) : (
                dayGroups.map(({ date, posts: dayPosts }) => (
                  <div key={date.toISOString()} className="flex flex-col gap-1.5">
                    <p className="px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      {capitalizeFirst(format(date, "EEE d MMM", { locale: es }))}
                    </p>
                    {dayPosts.map((p) => (
                      <PostCard
                        key={p.id}
                        post={p}
                        pillarMap={pillarMap}
                        onClick={() => onPostClick(p)}
                        compact={false}
                        draggable={false}
                      />
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
