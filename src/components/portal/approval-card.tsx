import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ChannelIcon } from "@/components/calendar/channel-icon";
import { ApprovalActions } from "./approval-actions";
import { ApprovalHistorySection } from "@/components/shared/approval-history-section";
import type { ApprovalPost } from "@/hooks/portal/usePendingApprovals";
import { CHANNEL_LABEL } from "@/lib/post-states";
import { cn } from "@/lib/utils";
import { isVideoUrl } from "@/lib/storage";
import { SlideVideo } from "@/components/shared/slide-video";

/**
 * Frame each format is shown in, matching how the networks display it.
 * Formats not listed keep the media's own proportions.
 */
const FORMAT_ASPECT: Record<string, string> = {
  carousel: "aspect-[3/4]",
  reel: "aspect-[9/16]",
  story: "aspect-[9/16]",
};

interface Props {
  post: ApprovalPost;
  clientId: string;
  role: "client_admin" | "client_viewer";
  readonly?: boolean;
  /**
   * Play a video in the first slide as soon as the card shows. Only for a
   * card opened on its own (the post detail dialog); in the Aprobaciones list
   * several cards are visible, so videos there start when their slide is
   * picked or when the client presses play.
   */
  autoPlayFirst?: boolean;
}

export function ApprovalCard({ post, clientId, role, readonly, autoPlayFirst = false }: Props) {
  const [mediaIdx, setMediaIdx] = useState(0);
  // Becomes true once the client picks a slide, so that slide's video plays.
  const [pickedSlide, setPickedSlide] = useState(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const hasMulti = post.media_urls.length > 1;
  const currentUrl = post.media_urls[mediaIdx] ?? "";
  const frameAspect = FORMAT_ASPECT[post.type];

  const goTo = (i: number) => {
    if (i < 0 || i >= post.media_urls.length || i === mediaIdx) return;
    setMediaIdx(i);
    setPickedSlide(true);
  };

  // Swipe between slides on touch screens. Touches that start over the video
  // controls (bottom strip) are left alone so scrubbing doesn't change slide.
  const onTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const t = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    touchStart.current = rect.bottom - t.clientY < 64 ? null : { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start || !hasMulti) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(t.clientY - start.y)) return;
    goTo(mediaIdx + (dx < 0 ? 1 : -1));
  };
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
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "relative w-full overflow-hidden",
                    frameAspect && "max-w-[400px] bg-black",
                    frameAspect,
                  )}
                  onTouchStart={onTouchStart}
                  onTouchEnd={onTouchEnd}
                >
                  {isVideoUrl(currentUrl) ? (
                    <SlideVideo
                      key={currentUrl}
                      src={currentUrl}
                      className={cn(
                        "w-full",
                        frameAspect ? "h-full object-cover" : "max-h-[400px] object-contain",
                      )}
                      autoPlay={pickedSlide || autoPlayFirst}
                    />
                  ) : (
                    <img
                      src={currentUrl}
                      alt=""
                      className={cn(
                        "w-full",
                        frameAspect ? "h-full object-cover" : "max-h-[400px] object-contain",
                      )}
                    />
                  )}

                  {hasMulti && (
                    <>
                      <div className="pointer-events-none absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white">
                        {mediaIdx + 1}/{post.media_urls.length}
                      </div>
                      {mediaIdx > 0 && (
                        <button
                          type="button"
                          onClick={() => goTo(mediaIdx - 1)}
                          aria-label="Anterior"
                          className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-black shadow"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                      )}
                      {mediaIdx < post.media_urls.length - 1 && (
                        <button
                          type="button"
                          onClick={() => goTo(mediaIdx + 1)}
                          aria-label="Siguiente"
                          className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-black shadow"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      )}
                    </>
                  )}
                </div>

                {/* Dots sit below the frame so they never cover the video controls. */}
                {hasMulti && (
                  <div className="flex justify-center gap-1.5 py-2">
                    {post.media_urls.map((u, i) => (
                      <button
                        key={u + i}
                        type="button"
                        onClick={() => goTo(i)}
                        aria-label={`Ir al elemento ${i + 1}`}
                        className={cn(
                          "h-2 w-2 rounded-full transition",
                          i === mediaIdx ? "bg-primary" : "bg-muted-foreground/30",
                        )}
                      />
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
