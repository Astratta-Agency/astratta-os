import { useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import {
  POST_STATE_META,
  POST_STATE_ORDER,
  POST_STATE_TRANSITIONS,
  skipsClientApproval,
  type PostStatus,
} from "@/lib/post-states";
import { POST_STATUS_DOT, POST_STATUS_HEX } from "@/lib/post-view-colors";
import type { SocialPostRow, ContentPillar } from "@/hooks/useSocialPosts";
import { PostCard } from "./post-card";

interface Props {
  posts: SocialPostRow[];
  pillarMap: Map<string, ContentPillar>;
  onPostClick: (p: SocialPostRow) => void;
  onStatusChange: (
    postId: string,
    from: PostStatus,
    to: PostStatus,
    clientId: string,
  ) => Promise<void> | void;
}

function KanbanColumn({
  status,
  posts,
  pillarMap,
  onPostClick,
}: {
  status: PostStatus;
  posts: SocialPostRow[];
  pillarMap: Map<string, ContentPillar>;
  onPostClick: (p: SocialPostRow) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `status:${status}`,
    data: { status },
  });
  const meta = POST_STATE_META[status];

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-lg border bg-muted/30 transition",
        isOver && "ring-2 ring-primary/40 bg-muted/50",
      )}
      style={{ borderTopWidth: 3, borderTopColor: POST_STATUS_HEX[status] }}
    >
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <span className={cn("h-2 w-2 rounded-full", POST_STATUS_DOT[status])} />
        <span
          className="truncate text-sm font-semibold"
          style={{ color: POST_STATUS_HEX[status] }}
        >
          {meta.label}
        </span>
        <Badge variant="outline" className="ml-auto rounded-full text-[10px]">
          {posts.length}
        </Badge>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-2 min-h-[120px]">
        {posts.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">Sin publicaciones</p>
        ) : (
          posts.map((p) => (
            <PostCard
              key={p.id}
              post={p}
              pillarMap={pillarMap}
              onClick={() => onPostClick(p)}
              compact={false}
              draggable
            />
          ))
        )}
      </div>
    </div>
  );
}

export function CalendarKanbanView({
  posts,
  pillarMap,
  onPostClick,
  onStatusChange,
}: Props) {
  // Soltar en Programado/Publicado sin aprobación del cliente pide confirmación.
  const [pendingSkip, setPendingSkip] = useState<{ post: SocialPostRow; to: PostStatus } | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const grouped = useMemo(() => {
    const g = {} as Record<PostStatus, SocialPostRow[]>;
    for (const s of POST_STATE_ORDER) g[s] = [];
    for (const p of posts) {
      if (g[p.status]) g[p.status].push(p);
    }
    // sort each column by scheduled_for asc (nulls last)
    for (const s of POST_STATE_ORDER) {
      g[s].sort((a, b) => {
        const ta = a.scheduled_for ? new Date(a.scheduled_for).getTime() : Number.POSITIVE_INFINITY;
        const tb = b.scheduled_for ? new Date(b.scheduled_for).getTime() : Number.POSITIVE_INFINITY;
        return ta - tb;
      });
    }
    return g;
  }, [posts]);

  const handleDragEnd = async (e: DragEndEvent) => {
    if (!e.over) return;
    const overId = String(e.over.id);
    if (!overId.startsWith("status:")) return;
    const to = overId.slice("status:".length) as PostStatus;
    const post = (e.active.data.current as { post?: SocialPostRow } | undefined)?.post;
    if (!post) return;
    if (post.status === to) return;
    const allowed = POST_STATE_TRANSITIONS[post.status] ?? [];
    if (!allowed.includes(to)) {
      toast.error("Transición no permitida", {
        description: `No se puede pasar de "${POST_STATE_META[post.status].label}" a "${POST_STATE_META[to].label}".`,
      });
      return;
    }
    if (skipsClientApproval(post.status, to)) {
      setPendingSkip({ post, to });
      return;
    }
    await applyChange(post, to);
  };

  const applyChange = async (post: SocialPostRow, to: PostStatus) => {
    try {
      await onStatusChange(post.id, post.status, to, post.client_id);
    } catch {
      /* toast already handled upstream */
    }
  };

  if (posts.length === 0) {
    return (
      <EmptyState
        title="Aún no hay publicaciones en el tablero"
        description="Crea una publicación para verla distribuida por estado."
      />
    );
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {POST_STATE_ORDER.map((s) => (
          <KanbanColumn
            key={s}
            status={s}
            posts={grouped[s]}
            pillarMap={pillarMap}
            onPostClick={onPostClick}
          />
        ))}
      </div>
      <AlertDialog open={!!pendingSkip} onOpenChange={(o) => !o && setPendingSkip(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Mover a "{pendingSkip ? POST_STATE_META[pendingSkip.to].label : ""}"?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta publicación no tiene aprobación del cliente. Se marcará igualmente y quedará anotado en el
              historial; al cliente no se le envía nada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const p = pendingSkip;
                setPendingSkip(null);
                if (p) void applyChange(p.post, p.to);
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DndContext>
  );
}
