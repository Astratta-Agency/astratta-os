import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  addDays,
  addMinutes,
  differenceInMinutes,
  format,
  isBefore,
  isSameDay,
  isToday,
  parseISO,
  startOfDay,
} from "date-fns";
import { es } from "date-fns/locale";
import { Clock, Flag, GripVertical, Search, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useUpdateTask, type Task, type TaskPriority } from "@/hooks/useTasks";
import {
  useCreateTimeBlock,
  useDeleteTimeBlock,
  useUpdateTimeBlock,
  type TimeBlock,
} from "@/hooks/usePlanner";
import { STATUS_HEX } from "@/lib/task-view-colors";
import { useNavigate } from "react-router-dom";
import { useUpdatePostSchedule, type SocialPostRow } from "@/hooks/useSocialPosts";
import { POST_STATE_META } from "@/lib/post-states";
import { ChannelIcon } from "@/components/calendar/channel-icon";
import { PRIORITY_LABEL } from "@/lib/task-labels";

const HOUR_PX = 48;
const SNAP_MIN = 15;
const MIN_PER_PX = 60 / HOUR_PX;
const DAY_MIN = 24 * 60;

const PRIORITY_FLAG: Record<TaskPriority, string> = {
  p0: "text-destructive",
  p1: "text-orange-500",
  p2: "text-blue-500",
  p3: "text-muted-foreground",
};

const snap = (min: number) => Math.round(min / SNAP_MIN) * SNAP_MIN;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const fmtTime = (d: Date) => format(d, "H:mm");

/** Default length of a block created from a task: its estimate, else 1 h. */
function defaultDuration(task: Task) {
  const est = task.estimated_hours ? task.estimated_hours * 60 : 60;
  return clamp(snap(est), SNAP_MIN, 8 * 60);
}

type Slot = { id: string; start: Date; end: Date };

/** Most side-by-side columns before the rest collapses into "+N". */
const MAX_LANES = 3;

/**
 * Lane layout for one day. Items that overlap form a cluster; each cluster
 * gets its own column count, so a busy hour doesn't narrow the whole day.
 */
function layoutDay(items: Slot[]) {
  const sorted = [...items].sort((a, b) => a.start.getTime() - b.start.getTime() || b.end.getTime() - a.end.getTime());
  const pos = new Map<string, { lane: number; cols: number }>();
  const clusters: { ids: string[]; cols: number }[] = [];
  let ids: string[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -Infinity;
  const close = () => {
    if (!ids.length) return;
    const cols = laneEnds.length;
    for (const id of ids) pos.set(id, { lane: pos.get(id)!.lane, cols });
    clusters.push({ ids, cols });
    ids = [];
    laneEnds = [];
  };
  for (const it of sorted) {
    const st = it.start.getTime();
    if (st >= clusterEnd) close();
    let lane = laneEnds.findIndex((end) => end <= st);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = it.end.getTime();
    pos.set(it.id, { lane, cols: 0 });
    ids.push(it.id);
    clusterEnd = Math.max(st >= clusterEnd ? -Infinity : clusterEnd, it.end.getTime());
  }
  close();
  return { pos, clusters };
}

/**
 * A task shown in the hour grid because it has a time of day:
 * - "range": start and due on the same day, both with time → start..due.
 * - "due":   due date with time → a 30-min marker at that time.
 * - "start": only the start has a time → start..start+estimate.
 */
type TimedKind = "range" | "due" | "start";
type TimedTask = { id: string; task: Task; kind: TimedKind; start: Date; end: Date };

const DUE_MARK_MIN = 30;

function atTime(date: string, time: string) {
  const [h, m] = time.split(":").map(Number);
  const d = parseISO(date);
  d.setHours(h, m, 0, 0);
  return d;
}

function timedTasks(tasks: Task[], from: Date, to: Date): TimedTask[] {
  const out: TimedTask[] = [];
  for (const t of tasks) {
    const s = t.start_date && t.start_time ? atTime(t.start_date, t.start_time) : null;
    const d = t.due_date && t.due_time ? atTime(t.due_date, t.due_time) : null;
    let item: TimedTask | null = null;
    if (s && d && isSameDay(s, d) && d > s) item = { id: `tt:${t.id}`, task: t, kind: "range", start: s, end: d };
    else if (d) item = { id: `tt:${t.id}`, task: t, kind: "due", start: d, end: addMinutes(d, DUE_MARK_MIN) };
    else if (s) item = { id: `tt:${t.id}`, task: t, kind: "start", start: s, end: addMinutes(s, defaultDuration(t)) };
    if (item && item.start < to && item.end > from) out.push(item);
  }
  return out;
}

const hhmm = (d: Date) => format(d, "HH:mm");
const ymd = (d: Date) => format(d, "yyyy-MM-dd");

/** Drag-to-resize from the bottom edge, snapped to 15 min. */
function beginResize(
  e: React.PointerEvent,
  start: Date,
  height: number,
  setPreview: (h: number | null) => void,
  onDone: (newEnd: Date) => void,
) {
  e.stopPropagation();
  e.preventDefault();
  const y0 = e.clientY;
  const maxH = (DAY_MIN - (start.getHours() * 60 + start.getMinutes())) / MIN_PER_PX;
  let latest = height;
  const move = (ev: PointerEvent) => {
    latest = clamp(snap((height + ev.clientY - y0) * MIN_PER_PX) / MIN_PER_PX, SNAP_MIN / MIN_PER_PX, maxH);
    setPreview(latest);
  };
  const up = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    if (latest !== height) onDone(addMinutes(start, Math.round(latest * MIN_PER_PX)));
    else setPreview(null);
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
}

/** Patch that moves a timed task so its slot starts at `startsAt`. */
function moveTaskPatch(item: TimedTask, startsAt: Date): Partial<Task> {
  const t = item.task;
  const day = ymd(startsAt);
  if (item.kind === "range") {
    const endsAt = addMinutes(startsAt, differenceInMinutes(item.end, item.start));
    return { start_date: day, start_time: hhmm(startsAt), due_date: day, due_time: hhmm(endsAt) };
  }
  if (item.kind === "due") {
    const patch: Partial<Task> = { due_date: day, due_time: hhmm(startsAt) };
    // Keep start <= due.
    if (t.start_date && t.start_date > day) Object.assign(patch, { start_date: day, start_time: null });
    return patch;
  }
  const patch: Partial<Task> = { start_date: day, start_time: hhmm(startsAt) };
  if (t.due_date && t.due_date < day) Object.assign(patch, { due_date: day, due_time: null });
  return patch;
}

/** A social post shown at its scheduled time (30-min marker). */
type PostItem = { id: string; post: SocialPostRow; clientName: string; start: Date; end: Date };
const POST_MARK_MIN = 30;

// ---------------------------------------------------------------- sidebar --

function BacklogItem({ task, disabled, onOpen }: { task: Task; disabled: boolean; onOpen: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `task:${task.id}`,
    data: { kind: "task", task },
    disabled,
  });
  const overdue = !!task.due_date && isBefore(parseISO(task.due_date), startOfDay(new Date()));
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(task.id)}
      className={cn(
        "group flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition hover:bg-muted",
        !disabled && "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-40",
      )}
    >
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: STATUS_HEX[task.status] }} />
      <span className="min-w-0 flex-1 truncate">{task.title}</span>
      {task.due_date && (
        <span className={cn("shrink-0 text-[11px] text-muted-foreground", overdue && "font-semibold text-destructive")}>
          {format(parseISO(task.due_date), "d MMM", { locale: es })}
        </span>
      )}
      {!disabled && <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100" />}
    </div>
  );
}

function SidebarSection({
  title,
  tasks,
  empty,
  readOnly,
  onOpen,
}: {
  title: string;
  tasks: Task[];
  empty: string;
  readOnly: boolean;
  onOpen: (id: string) => void;
}) {
  return (
    <section>
      <h3 className="mb-1 flex items-center justify-between px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
        <span className="font-normal">{tasks.length}</span>
      </h3>
      {tasks.length === 0 ? (
        <p className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">{empty}</p>
      ) : (
        <div className="space-y-0.5">
          {tasks.map((t) => (
            <BacklogItem key={t.id} task={t} disabled={readOnly} onOpen={onOpen} />
          ))}
        </div>
      )}
    </section>
  );
}

// ------------------------------------------------------------------- grid --

function BlockCard({
  block,
  top,
  height,
  left,
  width,
  readOnly,
  onOpen,
}: {
  block: TimeBlock;
  top: number;
  height: number;
  left: string;
  width: string;
  readOnly: boolean;
  onOpen: (id: string) => void;
}) {
  const update = useUpdateTimeBlock();
  const del = useDeleteTimeBlock();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `block:${block.id}`,
    data: { kind: "block", block },
    disabled: readOnly,
  });
  const [resizeH, setResizeH] = useState<number | null>(null);
  const start = parseISO(block.starts_at);
  const shownH = resizeH ?? height;
  const end = addMinutes(start, Math.round(shownH * MIN_PER_PX));
  const status = block.task?.status ?? "todo";
  const done = status === "done";

  const startResize = (e: React.PointerEvent) =>
    beginResize(e, start, height, setResizeH, (newEnd) =>
      update.mutate(
        { id: block.id, starts_at: block.starts_at, ends_at: newEnd.toISOString() },
        {
          onError: (err: any) => toast.error("No se pudo cambiar la duración", { description: err?.message }),
          onSettled: () => setResizeH(null),
        },
      ),
    );

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => !isDragging && block.task && onOpen(block.task.id)}
      style={{
        top,
        height: Math.max(shownH, 18),
        left,
        width,
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        borderLeftColor: STATUS_HEX[status],
      }}
      className={cn(
        "group absolute z-10 overflow-hidden rounded-md border border-l-4 bg-card px-1.5 py-0.5 text-[11px] shadow-sm transition-shadow hover:z-20 hover:shadow-md",
        !readOnly && "cursor-grab active:cursor-grabbing",
        isDragging && "z-30 opacity-80 shadow-lg",
      )}
    >
      <div className={cn("truncate font-medium leading-tight", done && "text-muted-foreground line-through")}>
        {block.task?.title ?? "Tarea"}
      </div>
      {shownH >= 30 && (
        <div className="truncate text-muted-foreground">
          {fmtTime(start)} – {fmtTime(end)}
        </div>
      )}
      {!readOnly && (
        <>
          <button
            type="button"
            aria-label="Quitar del planner"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              del.mutate(block.id, {
                onError: (err: any) => toast.error("No se pudo quitar el bloque", { description: err?.message }),
              });
            }}
            className="absolute right-0.5 top-0.5 rounded p-0.5 text-muted-foreground opacity-0 hover:bg-muted hover:text-foreground group-hover:opacity-100"
          >
            <X className="h-3 w-3" />
          </button>
          <div
            role="separator"
            aria-label="Cambiar duración"
            onPointerDown={startResize}
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-x-0 bottom-0 h-1.5 cursor-ns-resize opacity-0 group-hover:bg-primary/40 group-hover:opacity-100"
          />
        </>
      )}
    </div>
  );
}

/** A task placed in the grid by its own start/due time (not a planner block). */
function TaskTimeCard({
  item,
  top,
  height,
  left,
  width,
  readOnly,
  onOpen,
}: {
  item: TimedTask;
  top: number;
  height: number;
  left: string;
  width: string;
  readOnly: boolean;
  onOpen: (id: string) => void;
}) {
  const updateTask = useUpdateTask();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item.id,
    data: { kind: "tasktime", item },
    disabled: readOnly,
  });
  const [resizeH, setResizeH] = useState<number | null>(null);
  const shownH = resizeH ?? height;
  const end = addMinutes(item.start, Math.round(shownH * MIN_PER_PX));
  const done = item.task.status === "done";
  const canResize = !readOnly && item.kind !== "due";

  const startResize = (e: React.PointerEvent) =>
    beginResize(e, item.start, height, setResizeH, (newEnd) =>
      updateTask.mutate(
        // Resizing pins the end to the same day as the start, with a time.
        {
          id: item.task.id,
          patch: { start_date: ymd(item.start), start_time: hhmm(item.start), due_date: ymd(item.start), due_time: hhmm(newEnd) },
        },
        {
          onError: (err: any) => toast.error("No se pudo cambiar la hora", { description: err?.message }),
          onSettled: () => setResizeH(null),
        },
      ),
    );

  const label =
    item.kind === "due" ? `Vence ${fmtTime(item.start)}` : `${fmtTime(item.start)} – ${fmtTime(end)}`;

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => !isDragging && onOpen(item.task.id)}
      title={`${item.task.title} · ${label}`}
      style={{
        top,
        height: Math.max(shownH, 18),
        left,
        width,
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        borderColor: STATUS_HEX[item.task.status],
      }}
      className={cn(
        "group absolute z-10 overflow-hidden rounded-md border border-dashed bg-muted/70 px-1.5 py-0.5 text-[11px] transition-shadow hover:z-20 hover:shadow-md",
        !readOnly && "cursor-grab active:cursor-grabbing",
        isDragging && "z-30 opacity-80 shadow-lg",
      )}
    >
      <div className={cn("flex items-center gap-1 truncate font-medium leading-tight", done && "text-muted-foreground line-through")}>
        {item.kind === "due" ? <Flag className="h-3 w-3 shrink-0" /> : <Clock className="h-3 w-3 shrink-0" />}
        <span className="truncate">{item.task.title}</span>
      </div>
      {shownH >= 30 && <div className="truncate text-muted-foreground">{label}</div>}
      {canResize && (
        <div
          role="separator"
          aria-label="Cambiar hora de fin"
          onPointerDown={startResize}
          onClick={(e) => e.stopPropagation()}
          className="absolute inset-x-0 bottom-0 h-1.5 cursor-ns-resize opacity-0 group-hover:bg-primary/40 group-hover:opacity-100"
        />
      )}
    </div>
  );
}

function PostCard({
  item,
  top,
  height,
  left,
  width,
  readOnly,
}: {
  item: PostItem;
  top: number;
  height: number;
  left: string;
  width: string;
  readOnly: boolean;
}) {
  const navigate = useNavigate();
  // A published post already went out: it can't be moved.
  const locked = readOnly || item.post.status === "published";
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item.id,
    data: { kind: "post", item },
    disabled: locked,
  });
  const meta = POST_STATE_META[item.post.status];
  const channel = item.post.channels[0];

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => !isDragging && navigate(`/app/calendario?post=${item.post.id}`)}
      title={`${item.post.title} · ${item.clientName} · ${meta.label} · ${fmtTime(item.start)}`}
      style={{
        top,
        height: Math.max(height, 18),
        left,
        width,
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        borderLeftColor: meta.color,
        backgroundColor: `color-mix(in srgb, ${meta.color} 14%, hsl(var(--card)))`,
      }}
      className={cn(
        "group absolute z-10 overflow-hidden rounded-md border border-l-4 px-1.5 py-0.5 text-[11px] shadow-sm transition-shadow hover:z-20 hover:shadow-md",
        locked ? "cursor-pointer" : "cursor-grab active:cursor-grabbing",
        isDragging && "z-30 opacity-80 shadow-lg",
      )}
    >
      <div className="flex items-center gap-1 truncate font-medium leading-tight">
        {channel && <ChannelIcon channel={channel} className="h-3 w-3 shrink-0" />}
        <span className="truncate">{item.post.title || "Publicación"}</span>
      </div>
      {height >= 26 && (
        <div className="truncate text-muted-foreground">
          {fmtTime(item.start)} · {item.clientName}
        </div>
      )}
    </div>
  );
}

function DayColumn({
  day,
  blocks,
  timed,
  posts,
  readOnly,
  onOpen,
}: {
  day: Date;
  blocks: TimeBlock[];
  timed: TimedTask[];
  posts: PostItem[];
  readOnly: boolean;
  onOpen: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day:${format(day, "yyyy-MM-dd")}`, data: { day } });
  const navigate = useNavigate();
  const { pos, clusters } = useMemo(
    () =>
      layoutDay([
        ...blocks.map((b) => ({ id: b.id, start: parseISO(b.starts_at), end: parseISO(b.ends_at) })),
        ...timed,
        ...posts,
      ]),
    [blocks, timed, posts],
  );
  /** Horizontal placement; items past MAX_LANES go into the cluster's "+N". */
  const place = (id: string) => {
    const { lane, cols } = pos.get(id) ?? { lane: 0, cols: 1 };
    const visCols = Math.min(cols, MAX_LANES);
    const hidden = cols > MAX_LANES && lane >= MAX_LANES - 1;
    return {
      hidden,
      left: `calc(${(lane / visCols) * 100}% + 2px)`,
      width: `calc(${100 / visCols}% - 4px)`,
    };
  };

  // Everything that can end up in an overflow list, by id.
  const entries = useMemo(() => {
    const m = new Map<string, { title: string; start: Date; open: () => void }>();
    for (const b of blocks)
      m.set(b.id, { title: b.task?.title ?? "Tarea", start: parseISO(b.starts_at), open: () => b.task && onOpen(b.task.id) });
    for (const it of timed) m.set(it.id, { title: it.task.title, start: it.start, open: () => onOpen(it.task.id) });
    for (const it of posts)
      m.set(it.id, {
        title: `${it.post.title || "Publicación"} · ${it.clientName}`,
        start: it.start,
        open: () => navigate(`/app/calendario?post=${it.post.id}`),
      });
    return m;
  }, [blocks, timed, posts, onOpen, navigate]);
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    if (!isToday(day)) return;
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, [day]);

  const dayStart = startOfDay(day);
  return (
    <div
      ref={setNodeRef}
      className={cn("relative border-l", isToday(day) && "bg-primary/[0.03]", isOver && "bg-primary/10")}
      style={{ height: 24 * HOUR_PX }}
    >
      {Array.from({ length: 24 }, (_, h) => (
        <div key={h} className="border-b border-border/50" style={{ height: HOUR_PX }} />
      ))}
      {blocks.map((b) => {
        const s = parseISO(b.starts_at);
        const e = parseISO(b.ends_at);
        // Clip blocks that cross midnight to this day.
        const startMin = Math.max(0, differenceInMinutes(s, dayStart));
        const endMin = Math.min(DAY_MIN, differenceInMinutes(e, dayStart));
        const pl = place(b.id);
        if (pl.hidden) return null;
        return (
          <BlockCard
            key={b.id}
            block={b}
            top={startMin / MIN_PER_PX}
            height={(endMin - startMin) / MIN_PER_PX}
            left={pl.left}
            width={pl.width}
            readOnly={readOnly}
            onOpen={onOpen}
          />
        );
      })}
      {timed.map((it) => {
        const startMin = Math.max(0, differenceInMinutes(it.start, dayStart));
        const endMin = Math.min(DAY_MIN, differenceInMinutes(it.end, dayStart));
        const pl = place(it.id);
        if (pl.hidden) return null;
        return (
          <TaskTimeCard
            key={it.id}
            item={it}
            top={startMin / MIN_PER_PX}
            height={(endMin - startMin) / MIN_PER_PX}
            left={pl.left}
            width={pl.width}
            readOnly={readOnly}
            onOpen={onOpen}
          />
        );
      })}
      {posts.map((it) => {
        const startMin = Math.max(0, differenceInMinutes(it.start, dayStart));
        const endMin = Math.min(DAY_MIN, differenceInMinutes(it.end, dayStart));
        const pl = place(it.id);
        if (pl.hidden) return null;
        return (
          <PostCard
            key={it.id}
            item={it}
            top={startMin / MIN_PER_PX}
            height={(endMin - startMin) / MIN_PER_PX}
            left={pl.left}
            width={pl.width}
            readOnly={readOnly}
          />
        );
      })}
      {clusters
        .filter((c) => c.cols > MAX_LANES)
        .map((c) => {
          const hidden = c.ids
            .filter((id) => (pos.get(id)?.lane ?? 0) >= MAX_LANES - 1)
            .map((id) => entries.get(id)!)
            .sort((a, b) => a.start.getTime() - b.start.getTime());
          const first = hidden[0].start;
          const top = Math.max(0, differenceInMinutes(first, dayStart)) / MIN_PER_PX;
          return (
            <Popover key={c.ids[0]}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  className="absolute z-20 flex h-[18px] items-center justify-center rounded-md border bg-card text-[11px] font-semibold text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground"
                  style={{
                    top,
                    left: `calc(${((MAX_LANES - 1) / MAX_LANES) * 100}% + 2px)`,
                    width: `calc(${100 / MAX_LANES}% - 4px)`,
                  }}
                  title={`${hidden.length} más`}
                >
                  +{hidden.length}
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="max-h-72 w-64 overflow-y-auto p-1">
                {hidden.map((h, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={h.open}
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs hover:bg-muted"
                  >
                    <span className="shrink-0 text-muted-foreground">{fmtTime(h.start)}</span>
                    <span className="truncate">{h.title}</span>
                  </button>
                ))}
              </PopoverContent>
            </Popover>
          );
        })}
      {isToday(day) && (
        <div
          className="pointer-events-none absolute inset-x-0 z-20 h-0.5 bg-destructive"
          style={{ top: (now.getHours() * 60 + now.getMinutes()) / MIN_PER_PX }}
        >
          <span className="absolute -left-1 -top-1 h-2.5 w-2.5 rounded-full bg-destructive" />
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ board --

interface Props {
  workspaceId: string;
  weekStart: Date;
  tasks: Task[];
  blocks: TimeBlock[];
  /** Social posts of the week (already filtered); empty hides them. */
  posts: SocialPostRow[];
  clientNames: Record<string, string>;
  readOnly: boolean;
  onOpen: (taskId: string) => void;
}

export function PlannerBoard({ workspaceId, weekStart, tasks, blocks, posts, clientNames, readOnly, onOpen }: Props) {
  const create = useCreateTimeBlock();
  const update = useUpdateTimeBlock();
  const updateTask = useUpdateTask();
  const updatePost = useUpdatePostSchedule();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const [dragTask, setDragTask] = useState<Task | null>(null);
  const [search, setSearch] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  // Start the grid at 7:00 instead of midnight.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 7 * HOUR_PX;
  }, []);

  const weekEnd = useMemo(() => addDays(weekStart, 7), [weekStart]);
  const timed = useMemo(() => timedTasks(tasks, weekStart, weekEnd), [tasks, weekStart, weekEnd]);

  const today = startOfDay(new Date());
  const { dueSoon, backlog } = useMemo(() => {
    // A task with its own time this week is already on the calendar.
    const scheduled = new Set([...blocks.map((b) => b.task_id), ...timed.map((it) => it.task.id)]);
    const q = search.trim().toLowerCase();
    const open = tasks.filter((t) => t.status !== "done" && (!q || t.title.toLowerCase().includes(q)));
    const dueSoon = open.filter((t) => t.due_date && !isBefore(today, parseISO(t.due_date)));
    const dueIds = new Set(dueSoon.map((t) => t.id));
    const backlog = open.filter((t) => !dueIds.has(t.id) && !scheduled.has(t.id));
    return { dueSoon, backlog };
  }, [tasks, blocks, timed, search, today.getTime()]);

  const allDay = useMemo(
    // Tasks with a due time show up in the hour grid instead.
    () => days.map((d) => tasks.filter((t) => t.due_date && !t.due_time && isSameDay(parseISO(t.due_date), d))),
    [days, tasks],
  );

  const blocksByDay = useMemo(
    () =>
      days.map((d) => {
        const ds = startOfDay(d);
        const de = addDays(ds, 1);
        return blocks.filter((b) => parseISO(b.starts_at) < de && parseISO(b.ends_at) > ds);
      }),
    [days, blocks],
  );
  const postItems = useMemo<PostItem[]>(
    () =>
      posts
        .filter((p) => p.scheduled_for)
        .map((p) => {
          const start = parseISO(p.scheduled_for!);
          return { id: `post:${p.id}`, post: p, clientName: clientNames[p.client_id] ?? "", start, end: addMinutes(start, POST_MARK_MIN) };
        }),
    [posts, clientNames],
  );
  const postsByDay = useMemo(
    () => days.map((d) => postItems.filter((it) => isSameDay(it.start, d))),
    [days, postItems],
  );

  const timedByDay = useMemo(
    () =>
      days.map((d) => {
        const ds = startOfDay(d);
        const de = addDays(ds, 1);
        return timed.filter((it) => it.start < de && it.end > ds);
      }),
    [days, timed],
  );

  const onDragStart = (e: DragStartEvent) => {
    const data = e.active.data.current as { kind: string; task?: Task } | undefined;
    setDragTask(data?.kind === "task" ? data.task! : null);
  };

  const onDragEnd = (e: DragEndEvent) => {
    setDragTask(null);
    const over = e.over;
    const translated = e.active.rect.current.translated;
    if (!over || !translated) return;
    const day = (over.data.current as { day: Date }).day;
    const data = e.active.data.current as
      | { kind: "task"; task: Task }
      | { kind: "block"; block: TimeBlock }
      | { kind: "tasktime"; item: TimedTask }
      | { kind: "post"; item: PostItem };

    const duration =
      data.kind === "task"
        ? defaultDuration(data.task)
        : data.kind === "tasktime" || data.kind === "post"
          ? differenceInMinutes(data.item.end, data.item.start)
          : differenceInMinutes(parseISO(data.block.ends_at), parseISO(data.block.starts_at));
    const offset = snap((translated.top - over.rect.top) * MIN_PER_PX);
    const startMin = clamp(offset, 0, DAY_MIN - Math.min(duration, DAY_MIN));
    const startsAt = addMinutes(startOfDay(day), startMin);
    const endsAt = addMinutes(startsAt, duration);

    if (data.kind === "post") {
      if (startsAt.getTime() === data.item.start.getTime()) return;
      updatePost.mutate(
        { id: data.item.post.id, scheduled_for: startsAt.toISOString() },
        { onError: (err: any) => toast.error("No se pudo reprogramar la publicación", { description: err?.message }) },
      );
    } else if (data.kind === "tasktime") {
      if (startsAt.getTime() === data.item.start.getTime()) return;
      updateTask.mutate(
        { id: data.item.task.id, patch: moveTaskPatch(data.item, startsAt) },
        { onError: (err: any) => toast.error("No se pudo mover la tarea", { description: err?.message }) },
      );
    } else if (data.kind === "task") {
      create.mutate(
        { workspace_id: workspaceId, task_id: data.task.id, starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString() },
        { onError: (err: any) => toast.error("No se pudo programar la tarea", { description: err?.message }) },
      );
    } else if (startsAt.toISOString() !== parseISO(data.block.starts_at).toISOString()) {
      update.mutate(
        { id: data.block.id, starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString() },
        { onError: (err: any) => toast.error("No se pudo mover el bloque", { description: err?.message }) },
      );
    }
  };

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragTask(null)}>
      <div className="flex min-h-0 flex-1 overflow-hidden rounded-lg border bg-card">
        <aside className="hidden w-72 shrink-0 flex-col gap-4 overflow-y-auto border-r p-3 lg:flex">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar tareas…"
              className="h-8 pl-7 text-xs"
            />
          </div>
          <SidebarSection
            title="Hoy y vencidas"
            tasks={dueSoon}
            empty="Nada vence hoy."
            readOnly={readOnly}
            onOpen={onOpen}
          />
          <SidebarSection
            title="Sin programar"
            tasks={backlog}
            empty="Todas tus tareas abiertas están programadas esta semana."
            readOnly={readOnly}
            onOpen={onOpen}
          />
          {!readOnly && (
            <p className="px-2 text-[11px] text-muted-foreground">
              Arrastra una tarea al calendario para reservarle tiempo.
            </p>
          )}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Hour grid */}
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
            {/* Day headers + all-day row */}
            <div className="sticky top-0 z-30 grid grid-cols-[56px_repeat(7,minmax(0,1fr))] border-b bg-card">
              <div />
              {days.map((d, i) => (
                <div key={i} className="border-l px-2 py-2 text-center">
                  <div className="text-[11px] uppercase text-muted-foreground">{format(d, "EEE", { locale: es })}</div>
                  <div
                    className={cn(
                      "mx-auto mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold",
                      isToday(d) && "bg-destructive text-destructive-foreground",
                    )}
                  >
                    {format(d, "d")}
                  </div>
                </div>
              ))}
              <div className="flex items-start justify-end border-t pr-2 pt-1 text-[10px] text-muted-foreground">Vence</div>
              {allDay.map((list, i) => (
                <div key={i} className="min-h-7 space-y-0.5 border-l border-t p-1">
                  {list.slice(0, 3).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => onOpen(t.id)}
                      className={cn(
                        "flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[11px] hover:bg-muted",
                        t.status === "done" && "text-muted-foreground line-through",
                      )}
                      title={`${t.title} · ${PRIORITY_LABEL[t.priority]}`}
                    >
                      <Flag className={cn("h-3 w-3 shrink-0", PRIORITY_FLAG[t.priority])} />
                      <span className="truncate">{t.title}</span>
                    </button>
                  ))}
                  {list.length > 3 && <div className="px-1 text-[10px] text-muted-foreground">+{list.length - 3} más</div>}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))]">
              <div className="relative" style={{ height: 24 * HOUR_PX }}>
                {Array.from({ length: 24 }, (_, h) => (
                  <div
                    key={h}
                    className="absolute right-2 -translate-y-1/2 text-[10px] text-muted-foreground"
                    style={{ top: h * HOUR_PX }}
                  >
                    {h === 0 ? "" : format(new Date(2000, 0, 1, h), "h a")}
                  </div>
                ))}
              </div>
              {days.map((d, i) => (
                <DayColumn key={i} day={d} blocks={blocksByDay[i]} timed={timedByDay[i]} posts={postsByDay[i]} readOnly={readOnly} onOpen={onOpen} />
              ))}
            </div>
          </div>
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {dragTask && (
          <div
            className="w-44 rounded-md border border-l-4 bg-card px-2 py-1 text-xs font-medium shadow-lg"
            style={{ borderLeftColor: STATUS_HEX[dragTask.status], height: (defaultDuration(dragTask) / MIN_PER_PX) }}
          >
            <div className="truncate">{dragTask.title}</div>
            <div className="text-[10px] font-normal text-muted-foreground">
              {defaultDuration(dragTask) / 60} h
            </div>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
