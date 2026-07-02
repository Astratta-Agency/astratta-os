import { useMemo, useEffect, useRef } from "react";
import {
  DndContext,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  eachDayOfInterval,
  endOfWeek,
  format,
  getHours,
  startOfWeek,
  setHours,
  setMinutes,
  isToday,
} from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { PostCard } from "./post-card";
import type { SocialPostRow, ContentPillar } from "@/hooks/useSocialPosts";

interface Props {
  anchor: Date;
  posts: SocialPostRow[];
  pillarMap: Map<string, ContentPillar>;
  onPostClick: (p: SocialPostRow) => void;
  onCreate: (d: Date) => void;
  onReschedule: (postId: string, newDate: Date) => void;
  readonly?: boolean;
}

const HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 6 .. 23

function Slot({
  date,
  hour,
  posts,
  pillarMap,
  onPostClick,
  onCreate,
  readonly = false,
}: {
  date: Date;
  hour: number;
  posts: SocialPostRow[];
  pillarMap: Map<string, ContentPillar>;
  onPostClick: (p: SocialPostRow) => void;
  onCreate: (d: Date) => void;
  readonly?: boolean;
}) {
  const slotDate = setMinutes(setHours(date, hour), 0);
  const id = `slot:${format(slotDate, "yyyy-MM-dd'T'HH:mm")}`;
  const { setNodeRef, isOver } = useDroppable({ id, data: { iso: slotDate.toISOString() }, disabled: readonly });
  return (
    <div
      ref={setNodeRef}
      onClick={(e) => {
        if (readonly) return;
        if (e.target === e.currentTarget) onCreate(slotDate);
      }}
      className={cn(
        "min-h-[48px] border-b border-r p-0.5",
        isOver && !readonly && "bg-primary/10",
      )}
    >
      <div className="flex flex-col gap-1">
        {posts.map((p) => (
          <PostCard key={p.id} post={p} pillarMap={pillarMap} onClick={() => onPostClick(p)} draggable={!readonly} />
        ))}
      </div>
    </div>
  );
}

export function CalendarWeekView({
  anchor,
  posts,
  pillarMap,
  onPostClick,
  onCreate,
  onReschedule,
}: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const scrollRef = useRef<HTMLDivElement>(null);

  const days = useMemo(() => {
    const s = startOfWeek(anchor, { weekStartsOn: 0 });
    const e = endOfWeek(anchor, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: s, end: e });
  }, [anchor]);

  const byDayHour = useMemo(() => {
    const map = new Map<string, SocialPostRow[]>();
    for (const p of posts) {
      if (!p.scheduled_for) continue;
      const d = new Date(p.scheduled_for);
      const key = `${format(d, "yyyy-MM-dd")}_${getHours(d)}`;
      const arr = map.get(key) ?? [];
      arr.push(p);
      map.set(key, arr);
    }
    return map;
  }, [posts]);

  useEffect(() => {
    // scroll to 9am
    const el = scrollRef.current;
    if (el) el.scrollTop = (9 - 6) * 48;
  }, []);

  const handleEnd = (e: DragEndEvent) => {
    const overId = e.over?.id;
    if (typeof overId !== "string" || !overId.startsWith("slot:")) return;
    const iso = (e.over!.data.current as any)?.iso as string | undefined;
    if (!iso) return;
    const post = (e.active.data.current as any)?.post as SocialPostRow | undefined;
    if (!post) return;
    onReschedule(post.id, new Date(iso));
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleEnd}>
      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b bg-muted/30">
          <div className="border-r" />
          {days.map((d) => (
            <div
              key={d.toISOString()}
              className={cn(
                "border-r p-2 text-center text-xs font-medium",
                isToday(d) && "text-primary",
              )}
            >
              <div className="uppercase text-muted-foreground">{format(d, "EEE", { locale: es })}</div>
              <div className="text-base">{format(d, "d")}</div>
            </div>
          ))}
        </div>
        <div ref={scrollRef} className="max-h-[600px] overflow-y-auto">
          <div className="grid grid-cols-[60px_repeat(7,1fr)]">
            {HOURS.map((h) => (
              <div key={h} className="contents">
                <div className="border-b border-r p-1 text-right text-[10px] text-muted-foreground">
                  {h.toString().padStart(2, "0")}:00
                </div>
                {days.map((d) => {
                  const key = `${format(d, "yyyy-MM-dd")}_${h}`;
                  return (
                    <Slot
                      key={`${d.toISOString()}_${h}`}
                      date={d}
                      hour={h}
                      posts={byDayHour.get(key) ?? []}
                      pillarMap={pillarMap}
                      onPostClick={onPostClick}
                      onCreate={onCreate}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </DndContext>
  );
}
