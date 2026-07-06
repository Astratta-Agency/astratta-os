import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ChannelIcon } from "@/components/calendar/channel-icon";
import { ApprovalActions } from "./approval-actions";
import { ApprovalHistorySection } from "@/components/shared/approval-history-section";
import type { ApprovalPost } from "@/hooks/portal/usePendingApprovals";
import { CHANNEL_LABEL } from "@/lib/post-states";
import { cn } from "@/lib/utils";

interface Props {
  post: ApprovalPost;
  clientId: string;
  role: "client_admin" | "client_viewer";
  readonly?: boolean;
}

export function ApprovalCard({ post, clientId, role, readonly }: Props) {
  const [mediaIdx, setMediaIdx] = useState(0);
  const enabledVariants = post.post_variants.filter((v) => v.is_enabled && post.channels.includes(v.channel));
  const tabsList = enabledVariants.length > 0 ? enabledVariants : null;
  const [activeChannel, setActiveChannel] = useState(tabsList?.[0]?.channel ?? post.channels[0]);

  return (
    <Card
      id={`approval-${post.id}`}
      className="overflow-hidden ring-offset-background transition-shadow"
    >
      <CardContent className="p-0">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
          <span className="text-sm font-semibold">
            {post.scheduled_for
              ? format(new Date(post.scheduled_for), "dd MMM yyyy · HH:mm", { locale: es })
              : "Sin fecha"}
          </span>
          <div className="flex items-center gap-1">
            {post.channels.map((c) => (
              <ChannelIcon key={c} channel={c} size="sm" className="h-3.5 w-3.5 text-muted-foreground" />
            ))}
          </div>
          <span className="rounded bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
            {post.type.replace("_", " ")}
          </span>
        </div>

        <div className="grid gap-0 md:grid-cols-2">
          {/* Media */}
          <div className="bg-muted">
            {post.media_urls.length === 0 ? (
              <div className="flex h-64 items-center justify-center text-xs text-muted-foreground">
                Sin medios
              </div>
            ) : (
              <div className="flex flex-col">
                <img
                  src={post.media_urls[mediaIdx]}
                  alt=""
                  className="max-h-[400px] w-full object-contain"
                />
                {post.media_urls.length > 1 && (
                  <div className="flex gap-1 overflow-x-auto p-2">
                    {post.media_urls.map((u, i) => (
                      <button
                        key={u + i}
                        type="button"
                        onClick={() => setMediaIdx(i)}
                        className={cn(
                          "h-12 w-12 shrink-0 overflow-hidden rounded border",
                          i === mediaIdx ? "ring-2 ring-primary" : "border-border",
                        )}
                      >
                        <img src={u} alt="" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Variants */}
          <div className="p-4">
            {tabsList && tabsList.length > 1 ? (
              <Tabs value={activeChannel} onValueChange={(v) => setActiveChannel(v as any)}>
                <TabsList className="mb-3">
                  {tabsList.map((v) => (
                    <TabsTrigger key={v.channel} value={v.channel} className="text-xs">
                      {CHANNEL_LABEL[v.channel]}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {tabsList.map((v) => (
                  <TabsContent key={v.channel} value={v.channel}>
                    <VariantView variant={v} />
                  </TabsContent>
                ))}
              </Tabs>
            ) : tabsList && tabsList.length === 1 ? (
              <VariantView variant={tabsList[0]} />
            ) : (
              <p className="whitespace-pre-wrap text-sm">{post.caption || "Sin caption"}</p>
            )}

            {readonly && (post.status === "rejected" || post.status === "changes_requested") && post.rejection_reason && (
              <blockquote className="mt-4 border-l-2 border-border pl-3 text-xs italic text-muted-foreground">
                {post.rejection_reason}
              </blockquote>
            )}
          </div>
        </div>

        {/* Comments / approval timeline */}
        <div className="border-t border-border p-4">
          <ApprovalHistorySection
            postId={post.id}
            title="Comentarios"
            emptyText="Aún no hay comentarios en este post."
            className="border-0 bg-transparent p-0"
          />
        </div>

        {/* Footer */}
        {!readonly && (
          <div className="sticky bottom-0 border-t border-border bg-card p-3 pb-[env(safe-area-inset-bottom,12px)]">
            {role === "client_admin" ? (
              <ApprovalActions post={post} clientId={clientId} />
            ) : (
              <p className="text-center text-xs text-muted-foreground">
                Solo lectura — pídele a tu administrador que apruebe.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function VariantView({ variant }: { variant: ApprovalPost["post_variants"][number] }) {
  return (
    <div className="space-y-3 text-sm">
      <p className="whitespace-pre-wrap">{variant.caption || "Sin caption"}</p>
      {variant.hashtags && (
        <p className="text-xs text-primary">{variant.hashtags}</p>
      )}
      {variant.first_comment && (
        <div className="rounded bg-muted p-2 text-xs">
          <p className="mb-1 font-semibold text-muted-foreground">Primer comentario</p>
          {variant.first_comment}
        </div>
      )}
    </div>
  );
}
