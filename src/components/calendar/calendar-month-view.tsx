import { useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  startOfMonth,
  startOfWeek,
  parseISO,
  setHours,
  setMinutes,
  setSeconds,
  getHours,
  getMinutes,
} from "date-fns";

import { DayCell } from "./day-cell";
import type { SocialPostRow, ContentPillar } from "@/hooks/useSocialPosts";

interface Props {
  monthAnchor: Date;
  posts: SocialPostRow[];
  pillarMap: Map<string, ContentPillar>;
  onPostClick: (p: SocialPostRow) => void;
  onCreate: (d: Date) => void;
  onReschedule: (postId: string, newDate: Date) => void;
  readonly?: boolean;
}

export function CalendarMonthView({
  monthAnchor,
  posts,
  pillarMap,
  onPostClick,
  onCreate,
  onReschedule,
  readonly = false,
}: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const [overId, setOverId] = useState<string | null>(null);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(monthAnchor), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(monthAnchor), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [monthAnchor]);

  const byDay = useMemo(() => {
    const map = new Map<string, SocialPostRow[]>();
    for (const p of posts) {
      if (!p.scheduled_for) continue;
      const key = format(new Date(p.scheduled_for), "yyyy-MM-dd");
      const arr = map.get(key) ?? [];
      arr.push(p);
      map.set(key, arr);
    }
    return map;
  }, [posts]);

  const handleEnd = (e: DragEndEvent) => {
    setOverId(null);
    const overIdStr = e.over?.id;
    if (typeof overIdStr !== "string" || !overIdStr.startsWith("day:")) return;
    const targetDateStr = overIdStr.slice(4);
    const post = (e.active.data.current as any)?.post as SocialPostRow | undefined;
    if (!post || !post.scheduled_for) return;
    const targetDay = parseISO(targetDateStr);
    if (isSameDay(targetDay, new Date(post.scheduled_for))) return;
    const prev = new Date(post.scheduled_for);
    let next = setHours(targetDay, getHours(prev));
    next = setMinutes(next, getMinutes(prev));
    next = setSeconds(next, 0);
    onReschedule(post.id, next);
  };

  return (
    <DndContext
      sensors={sensors}
      onDragOver={(e) => setOverId(typeof e.over?.id === "string" ? (e.over.id as string) : null)}
      onDragEnd={handleEnd}
      onDragCancel={() => setOverId(null)}
    >
      <div className="grid grid-cols-7 gap-1">
        {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map((d) => (
          <div key={d} className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {d}
          </div>
        ))}
        {days.map((d) => {
          const key = format(d, "yyyy-MM-dd");
          return (
            <DayCell
              key={key}
              date={d}
              monthAnchor={monthAnchor}
              posts={byDay.get(key) ?? []}
              pillarMap={pillarMap}
              onPostClick={onPostClick}
              onCreate={onCreate}
              isOver={overId === `day:${key}`}
            />
          );
        })}
      </div>
    </DndContext>
  );
}
