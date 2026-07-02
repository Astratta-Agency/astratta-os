import { useDroppable } from "@dnd-kit/core";
import { format, isSameMonth, isToday } from "date-fns";
import { es } from "date-fns/locale";
import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { PostCard } from "./post-card";
import type { SocialPostRow, ContentPillar } from "@/hooks/useSocialPosts";

interface Props {
  date: Date;
  monthAnchor: Date;
  posts: SocialPostRow[];
  pillarMap: Map<string, ContentPillar>;
  onPostClick: (p: SocialPostRow) => void;
  onCreate: (date: Date) => void;
  isOver: boolean;
  readonly?: boolean;
}

const MAX_VISIBLE = 3;

export function DayCell({
  date,
  monthAnchor,
  posts,
  pillarMap,
  onPostClick,
  onCreate,
  isOver,
  readonly = false,
}: Props) {
  const id = `day:${format(date, "yyyy-MM-dd")}`;
  const { setNodeRef } = useDroppable({ id, data: { date: date.toISOString() }, disabled: readonly });
  const outside = !isSameMonth(date, monthAnchor);
  const today = isToday(date);
  const [popOpen, setPopOpen] = useState(false);
  const visible = posts.slice(0, MAX_VISIBLE);
  const extra = posts.length - visible.length;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "group flex min-h-[120px] flex-col gap-1 rounded-md border bg-card p-1.5 transition md:min-h-[140px]",
        outside && "bg-muted/30",
        isOver && !readonly && "border-primary ring-2 ring-primary/30",
      )}
      onClick={(e) => {
        if (readonly) return;
        if (e.target === e.currentTarget) onCreate(date);
      }}
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
            outside && "text-muted-foreground/60",
            today && "bg-primary text-primary-foreground",
          )}
        >
          {format(date, "d")}
        </span>
        <button
          type="button"
          aria-label="Nueva publicación"
          onClick={() => onCreate(date)}
          className="rounded p-0.5 text-xs text-muted-foreground opacity-0 transition hover:bg-muted group-hover:opacity-100"
        >
          +
        </button>
      </div>
      <div className="flex flex-1 flex-col gap-1">
        {visible.map((p) => (
          <PostCard key={p.id} post={p} pillarMap={pillarMap} onClick={() => onPostClick(p)} />
        ))}
        {extra > 0 && (
          <Popover open={popOpen} onOpenChange={setPopOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="rounded text-[11px] font-medium text-primary hover:underline"
              >
                +{extra} más
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72 p-2">
              <p className="mb-2 px-1 text-xs font-medium text-muted-foreground">
                {format(date, "EEEE d 'de' LLLL", { locale: es })}
              </p>
              <div className="flex max-h-80 flex-col gap-1.5 overflow-y-auto">
                {posts.map((p) => (
                  <PostCard
                    key={p.id}
                    post={p}
                    pillarMap={pillarMap}
                    draggable={false}
                    onClick={() => {
                      setPopOpen(false);
                      onPostClick(p);
                    }}
                  />
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
}
