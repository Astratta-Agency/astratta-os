import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { ChannelIcon } from "./channel-icon";
import { PillarBadge } from "./pillar-badge";
import { StateBadgePost } from "./state-badge-post";
import {
  CHANNEL_LABEL,
  POST_STATE_META,
  POST_STATE_TRANSITIONS,
  type PostStatus,
} from "@/lib/post-states";
import {
  usePostApprovalHistory,
  type ContentPillar,
  type SocialPostRow,
} from "@/hooks/useSocialPosts";

interface Props {
  post: SocialPostRow | null;
  pillarMap: Map<string, ContentPillar>;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onChangeStatus: (post: SocialPostRow, to: PostStatus) => void;
}

export function PostDetailPanel({ post, pillarMap, open, onOpenChange, onChangeStatus }: Props) {
  const { data: history = [] } = usePostApprovalHistory(post?.id ?? null);
  if (!post) return null;
  const pillar = post.content_pillar ? pillarMap.get(post.content_pillar) : null;
  const transitions = POST_STATE_TRANSITIONS[post.status] ?? [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Publicación</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-5">
          <div className="flex items-center justify-between">
            <StateBadgePost status={post.status} size="md" />
            {pillar && <PillarBadge name={pillar.name} color={pillar.color} size="md" />}
          </div>

          {post.scheduled_for && (
            <p className="text-sm text-muted-foreground">
              {format(new Date(post.scheduled_for), "dd MMM yyyy 'a las' HH:mm", { locale: es })}
            </p>
          )}

          {post.channels.length > 0 && (
            <div>
              <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Canales
              </h3>
              <div className="flex flex-wrap gap-2">
                {post.channels.map((c) => (
                  <span
                    key={c}
                    className="inline-flex items-center gap-1.5 rounded-full border bg-muted/30 px-2.5 py-1 text-xs"
                  >
                    <ChannelIcon channel={c} size="sm" />
                    {CHANNEL_LABEL[c]}
                  </span>
                ))}
              </div>
            </div>
          )}

          {post.media_urls.length > 0 && (
            <div>
              <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Media
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {post.media_urls.map((u, i) => (
                  <img key={i} src={u} alt="" className="aspect-square w-full rounded object-cover" />
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Caption
            </h3>
            <p className="whitespace-pre-wrap text-sm">{post.caption || "—"}</p>
          </div>

          {post.hashtags && (
            <div>
              <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Hashtags
              </h3>
              <p className="text-sm text-primary">{post.hashtags}</p>
            </div>
          )}

          {history.length > 0 && (
            <div>
              <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Historial
              </h3>
              <ul className="space-y-1.5 text-xs">
                {history.map((h: any) => (
                  <li key={h.id} className="flex items-center justify-between border-b pb-1.5">
                    <span className="font-medium">{h.action}</span>
                    <span className="text-muted-foreground">
                      {format(new Date(h.created_at), "dd MMM HH:mm", { locale: es })}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-col gap-2 border-t pt-4">
            <Button variant="outline" onClick={() => toast("Editor completo próximamente")}>
              Editar
            </Button>
            {transitions.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button>Cambiar estado</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {transitions.map((t) => (
                    <DropdownMenuItem
                      key={t}
                      onClick={() => {
                        if (t === "archived" || t === "rejected") {
                          if (!confirm(`¿Mover a "${POST_STATE_META[t].label}"?`)) return;
                        }
                        onChangeStatus(post, t);
                      }}
                    >
                      <span
                        className="mr-2 h-2 w-2 rounded-full"
                        style={{ backgroundColor: POST_STATE_META[t].color }}
                      />
                      {POST_STATE_META[t].label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
