import { useCallback, useEffect, useMemo, useState } from "react";
import { format as fmt } from "date-fns";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { X, Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { StateBadgePost } from "../state-badge-post";
import { PostEditorMeta, type PostFormat } from "./post-editor-meta";
import { ChannelTabs } from "./channel-tabs";
import { VariantEditor, variantToDraft, emptyDraft, type VariantDraft } from "./variant-editor";
import { PostPreview } from "./post-preview";
import { MediaUploader } from "./media-uploader";
import { MediaLibraryPicker } from "./media-library-picker";
import { PostFormatWarnings } from "./post-format-warnings";
import { StateChangeDropdown } from "./state-change-dropdown";
import { PostSubmitForApprovalButton } from "./post-submit-for-approval-button";
import { SubmitForApprovalDialog } from "./submit-for-approval-dialog";

import { useSearchParams } from "react-router-dom";
import {
  usePost,
  useUpdatePost,
  useUpsertVariant,
  useDeleteVariant,
  useBeforeUnloadGuard,
  useAutosave,
  useDeletePost,
  useDuplicatePost,
  type PostVariantRow,
} from "@/hooks/usePostEditor";
import type { Channel, PostStatus } from "@/lib/post-states";
import { useContentPillars } from "@/hooks/useSocialPosts";

interface Props {
  postId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  clientName: string;
  clientSlug: string;
  clientLogo?: string | null;
  brandColor?: string | null;
  workspaceId: string;
  isHealthcare: boolean;
  onChangeStatus: (postId: string, from: PostStatus, to: PostStatus, clientId: string) => Promise<void>;
}

type PostMeta = {
  title: string;
  type: PostFormat;
  scheduled_for: string | null;
  content_pillar: string | null;
  channels: Channel[];
  media_urls: string[];
};

export function PostEditorPanel({
  postId,
  open,
  onOpenChange,
  clientName,
  clientSlug,
  clientLogo,
  brandColor,
  workspaceId,
  isHealthcare,
  onChangeStatus,
}: Props) {
  const { data: post, isLoading } = usePost(postId);
  const { data: pillarOptions = [] } = useContentPillars(post?.client_id);
  const updatePost = useUpdatePost(postId);
  const upsertVariant = useUpsertVariant(postId);
  const deleteVariant = useDeleteVariant(postId);
  const deletePost = useDeletePost();
  const duplicatePost = useDuplicatePost();
  const [, setSearchParams] = useSearchParams();

  const [meta, setMeta] = useState<PostMeta | null>(null);
  const [drafts, setDrafts] = useState<Record<string, VariantDraft>>({});
  const [active, setActive] = useState<Channel | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryPendingOnly, setLibraryPendingOnly] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);

  // Hydrate local state when post loads / changes
  useEffect(() => {
    if (!post) {
      setMeta(null);
      setDrafts({});
      setActive(null);
      return;
    }
    setMeta({
      title: post.title ?? "",
      type: (post.type as PostFormat) ?? "feed_post",
      scheduled_for: post.scheduled_for,
      content_pillar: post.content_pillar,
      channels: post.channels,
      media_urls: post.media_urls,
    });
    const map: Record<string, VariantDraft> = {};
    const byChannel = new Map<Channel, PostVariantRow>();
    post.variants.filter((v) => v.is_enabled).forEach((v) => byChannel.set(v.channel, v));
    post.channels.forEach((c) => {
      const v = byChannel.get(c);
      // Seed from post.caption/hashtags if no variant yet
      map[c] = v
        ? variantToDraft(v)
        : { ...emptyDraft(), caption: post.caption ?? "", hashtags: post.hashtags ?? "" };
    });
    setDrafts(map);
    setActive((prev) => (prev && post.channels.includes(prev) ? prev : post.channels[0] ?? null));
  }, [post]);

  const saveAll = useCallback(
    async (state: { meta: PostMeta; drafts: Record<string, VariantDraft> }) => {
      if (!postId || !post) return;
      await updatePost.mutateAsync({
        title: state.meta.title,
        type: state.meta.type,
        scheduled_for: state.meta.scheduled_for,
        content_pillar: state.meta.content_pillar,
        channels: state.meta.channels,
        media_urls: state.meta.media_urls,
      });
      await Promise.all(
        state.meta.channels.map((c) => {
          const d = state.drafts[c];
          if (!d) return Promise.resolve();
          return upsertVariant.mutateAsync({
            channel: c,
            patch: {
              caption: d.caption,
              hashtags: d.hashtags,
              first_comment: d.first_comment,
              mentions: d.mentions,
              location: d.location || null,
              utm_url: d.utm_url || null,
              is_enabled: true,
            },
          });
        }),
      );
    },
    [postId, post, updatePost, upsertVariant],
  );

  const autosaveValue = useMemo(() => (meta ? { meta, drafts } : null), [meta, drafts]);
  const { status: saveStatus, lastSavedAt, flush } = useAutosave(
    autosaveValue,
    async (v) => {
      if (!v) return;
      await saveAll(v);
    },
    { enabled: !!postId && !!meta, delay: 1500 },
  );

  useBeforeUnloadGuard(open && saveStatus !== "saved" && saveStatus !== "idle");

  // Cmd/Ctrl+S
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void flush();
        toast.success("Guardado");
      }
      // Cmd/Ctrl + 1..6 → channel tab
      if ((e.metaKey || e.ctrlKey) && /^[1-6]$/.test(e.key) && meta) {
        const idx = parseInt(e.key, 10) - 1;
        const c = meta.channels[idx];
        if (c) {
          e.preventDefault();
          setActive(c);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, flush, meta]);

  const handleClose = () => {
    if (saveStatus === "saving" || saveStatus === "error") {
      setConfirmClose(true);
      return;
    }
    onOpenChange(false);
  };

  const handleAddChannel = (c: Channel) => {
    if (!meta) return;
    setMeta({ ...meta, channels: [...meta.channels, c] });
    setDrafts((d) => ({
      ...d,
      [c]: d[c] ?? { ...emptyDraft(), caption: meta && drafts[meta.channels[0]]?.caption || "" },
    }));
    setActive(c);
  };

  const handleRemoveChannel = async (c: Channel) => {
    if (!meta) return;
    const next = meta.channels.filter((x) => x !== c);
    setMeta({ ...meta, channels: next });
    setActive((a) => (a === c ? next[0] ?? null : a));
    try {
      await deleteVariant.mutateAsync(c);
    } catch (e: any) {
      toast.error("No se pudo eliminar el canal", { description: e?.message });
    }
  };

  const handleCopyTo = (targets: Channel[]) => {
    if (!active) return;
    const src = drafts[active];
    if (!src) return;
    setDrafts((d) => {
      const next = { ...d };
      targets.forEach((t) => {
        next[t] = {
          ...next[t],
          caption: src.caption,
          hashtags: src.hashtags,
          mentions: src.mentions,
          location: src.location,
        };
      });
      return next;
    });
    toast.success(`Copiado a ${targets.length} canal${targets.length === 1 ? "" : "es"}`);
  };

  const handleStatusChange = async (to: PostStatus) => {
    if (!post || !meta) return;
    // Consent guard: block scheduling/publishing if any attached asset
    // requires consent but isn't signed.
    if ((to === "scheduled" || to === "published") && meta.media_urls.length > 0) {
      try {
        const { data: assets } = await (await import("@/integrations/supabase/client")).supabase
          .from("media_assets" as any)
          .select("file_name, public_url, consent_required, consent_signed")
          .in("public_url", meta.media_urls);
        const missing = ((assets ?? []) as any[]).filter(
          (a) => a.consent_required && !a.consent_signed,
        );
        if (missing.length > 0) {
          toast.error(
            `El asset ${missing[0].file_name} no tiene consentimiento firmado`,
            {

              description:
                missing.length > 1
                  ? `+${missing.length - 1} más sin consentimiento`
                  : undefined,
              action: {
                label: "Ver biblioteca",
                onClick: () => {
                  setLibraryPendingOnly(true);
                  setLibraryOpen(true);
                },
              },
            },
          );
          return;
        }
      } catch {
        /* if the lookup fails, fall through and let the server-side check it */
      }
    }
    try {
      await onChangeStatus(post.id, post.status, to, post.client_id);
    } catch (e: any) {
      toast.error("No se pudo cambiar el estado", { description: e?.message });
    }
  };

  const handleDuplicate = async () => {
    if (!post) return;
    try {
      // Best-effort save current edits so the copy reflects the latest state.
      try {
        await flush();
      } catch {
        /* ignore — user can retry from the new copy */
      }
      const newId = await duplicatePost.mutateAsync(post.id);
      toast.success("Publicación duplicada");
      // Swap the editor to the new post via the same `post` query param the
      // Calendar page uses to open the editor.
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          p.set("post", newId);
          return p;
        },
        { replace: true },
      );
    } catch (e: any) {
      toast.error("No se pudo duplicar", { description: e?.message });
    }
  };

  const handleConfirmDelete = async () => {
    if (!post) return;
    try {
      await deletePost.mutateAsync(post.id);
      toast.success("Publicación eliminada");
      setConfirmDelete(false);
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          p.delete("post");
          return p;
        },
        { replace: true },
      );
      onOpenChange(false);
    } catch (e: any) {
      toast.error("No se pudo eliminar", { description: e?.message });
    }
  };



  const captionLengths = useMemo(() => {
    const out: Partial<Record<Channel, number>> = {};
    Object.entries(drafts).forEach(([k, v]) => (out[k as Channel] = v.caption.length));
    return out;
  }, [drafts]);

  const saveLabel =
    saveStatus === "saving"
      ? "Guardando…"
      : saveStatus === "error"
        ? "Error al guardar"
        : saveStatus === "saved" && lastSavedAt
          ? `Guardado · ${fmt(lastSavedAt, "HH:mm:ss")}`
          : "Sin cambios";

  return (
    <Sheet open={open} onOpenChange={(o) => (o ? onOpenChange(true) : handleClose())}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto p-0 sm:max-w-[920px]"
      >
        {isLoading || !meta || !post ? (
          <div className="space-y-3 p-6">
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center gap-2 border-b bg-background/95 px-4 py-3 backdrop-blur">
              <Input
                value={meta.title}
                onChange={(e) => setMeta({ ...meta, title: e.target.value })}
                placeholder="Sin título"
                className="h-8 max-w-xs border-0 px-1 text-base font-semibold focus-visible:ring-1"
              />
              <StateBadgePost status={post.status} size="sm" />
              <span
                className={`ml-2 text-[11px] ${
                  saveStatus === "error"
                    ? "text-destructive"
                    : saveStatus === "saving"
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-muted-foreground"
                }`}
              >
                {saveLabel}
              </span>
              <div className="ml-auto flex items-center gap-1">
                <PostSubmitForApprovalButton
                  status={post.status}
                  onClick={async () => {
                    try {
                      await flush();
                    } catch {
                      /* surfaced by save status */
                    }
                    setSubmitOpen(true);
                  }}
                />
                <StateChangeDropdown status={post.status} onChange={handleStatusChange} />
                <Button size="sm" variant="ghost" onClick={() => toast("Duplicar próximamente")}>
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setConfirmDelete(true)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={handleClose} aria-label="Cerrar">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Body */}
            <div className="grid gap-4 p-4 md:grid-cols-2">
              {/* Left: editor */}
              <div className="space-y-4">
                <PostEditorMeta
                  clientName={clientName}
                  type={meta.type}
                  onType={(t) => setMeta({ ...meta, type: t })}
                  scheduledFor={meta.scheduled_for}
                  onScheduledFor={(s) => setMeta({ ...meta, scheduled_for: s })}
                  pillar={meta.content_pillar}
                  onPillar={(p) => setMeta({ ...meta, content_pillar: p })}
                  pillarOptions={pillarOptions}
                />

                <PostFormatWarnings type={meta.type} />

                <div className="rounded-lg border bg-card">
                  <ChannelTabs
                    channels={meta.channels}
                    active={active}
                    onActive={setActive}
                    onAdd={handleAddChannel}
                    onRemove={handleRemoveChannel}
                    captionLengths={captionLengths}
                  />
                  <div className="p-3">
                    {active && drafts[active] ? (
                      <VariantEditor
                        channel={active}
                        draft={drafts[active]}
                        onChange={(d) => setDrafts((all) => ({ ...all, [active]: d }))}
                        otherChannels={meta.channels.filter((c) => c !== active)}
                        onCopyTo={handleCopyTo}
                        clientSlug={clientSlug}
                        postId={post.id}
                        scheduledFor={meta.scheduled_for}
                      />
                    ) : (
                      <p className="py-6 text-center text-sm text-muted-foreground">
                        Agrega un canal para empezar a editar
                      </p>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border bg-card p-3">
                  <MediaUploader
                    workspaceId={workspaceId}
                    clientId={post.client_id}
                    urls={meta.media_urls}
                    onChange={(u) => setMeta({ ...meta, media_urls: u })}
                    postType={meta.type}
                    isHealthcare={isHealthcare}
                    onOpenLibrary={() => {
                      setLibraryPendingOnly(false);
                      setLibraryOpen(true);
                    }}
                  />
                </div>

              </div>

              {/* Right: preview — desktop sticky, mobile accordion */}
              <div className="hidden md:block">
                <div className="sticky top-20">
                  {active && drafts[active] ? (
                    <PostPreview
                      channel={active}
                      clientName={clientName}
                      clientLogo={clientLogo}
                      brandColor={brandColor}
                      mediaUrl={meta.media_urls[0]}
                      draft={drafts[active]}
                    />
                  ) : (
                    <p className="text-center text-sm text-muted-foreground">
                      Selecciona un canal para ver la previsualización
                    </p>
                  )}
                </div>
              </div>

              <div className="md:hidden">
                <Accordion type="single" collapsible>
                  <AccordionItem value="preview">
                    <AccordionTrigger>Ver previsualización</AccordionTrigger>
                    <AccordionContent>
                      {active && drafts[active] && (
                        <PostPreview
                          channel={active}
                          clientName={clientName}
                          clientLogo={clientLogo}
                          brandColor={brandColor}
                          mediaUrl={meta.media_urls[0]}
                          draft={drafts[active]}
                        />
                      )}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            </div>
          </>
        )}
      </SheetContent>

      {post && (
        <MediaLibraryPicker
          open={libraryOpen}
          onOpenChange={setLibraryOpen}
          clientId={post.client_id}
          isHealthcare={isHealthcare}
          attachedUrls={meta?.media_urls ?? []}
          initialPendingOnly={libraryPendingOnly}
          onAdd={(toAdd) => {
            if (!meta) return;
            const merged = Array.from(new Set([...meta.media_urls, ...toAdd]));
            setMeta({ ...meta, media_urls: merged });
          }}
        />
      )}

      {post && meta && (
        <SubmitForApprovalDialog
          open={submitOpen}
          onOpenChange={setSubmitOpen}
          postId={post.id}
          clientId={post.client_id}
          clientSlug={clientSlug}
          clientName={clientName}
          isHealthcare={isHealthcare}
          post={{
            channels: meta.channels,
            scheduled_for: meta.scheduled_for,
            media_urls: meta.media_urls,
            status: post.status,
          }}
          variants={post.variants}
        />
      )}




      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hay cambios sin guardar</AlertDialogTitle>
            <AlertDialogDescription>
              Si cierras ahora podrías perder los últimos cambios. ¿Cerrar de todos modos?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmClose(false);
                onOpenChange(false);
              }}
            >
              Cerrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar publicación?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                toast("Eliminación próximamente");
                setConfirmDelete(false);
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}
