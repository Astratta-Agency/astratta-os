import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Loader2, Upload, X, AlertTriangle, RotateCcw, Library } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { useUploadAsset, type MediaAssetRow } from "@/hooks/useMediaAssets";
import { MAX_FILE_BYTES, ALLOWED_MIME } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { MediaThumb } from "@/components/shared/media-thumb";

interface Props {
  workspaceId: string;
  clientId: string;
  urls: string[];
  onChange: (urls: string[]) => void;
  postType: string;
  onOpenLibrary: () => void;
}

type PendingItem = {
  id: string;
  file: File;
  status: "uploading" | "error" | "done";
  progress: number;
  error?: string;
  asset?: MediaAssetRow;
  previewUrl: string;
};

const MAX_ITEMS = 10;

export function MediaUploader({
  workspaceId,
  clientId,
  urls,
  onChange,
  postType,
  onOpenLibrary,
}: Props) {
  const upload = useUploadAsset();
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [showUrlPaste, setShowUrlPaste] = useState(false);
  const [urlDraft, setUrlDraft] = useState("");

  const isCarousel = postType === "carousel";

  const handleDrop = useCallback(
    async (files: File[]) => {
      if (!files.length) return;
      const remaining = MAX_ITEMS - urls.length;
      const accepted = files.slice(0, remaining);
      if (files.length > remaining) {
        toast.warning(`Máximo ${MAX_ITEMS} archivos por post`);
      }

      for (const file of accepted) {
        if (file.size > MAX_FILE_BYTES) {
          toast.error(`${file.name}: supera 50MB`);
          continue;
        }
        if (!ALLOWED_MIME.has(file.type)) {
          toast.error(`${file.name}: tipo no permitido`);
          continue;
        }

        const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const previewUrl = URL.createObjectURL(file);
        setPending((p) => [...p, { id, file, status: "uploading", progress: 30, previewUrl }]);

        try {
          const asset = await upload.mutateAsync({
            file,
            workspaceId,
            clientId,
          });
          setPending((p) =>
            p.map((it) => (it.id === id ? { ...it, status: "done", progress: 100, asset } : it)),
          );
          onChange([...urls, asset.public_url]);
          urls = [...urls, asset.public_url]; // keep local in sync for next loop
          // Cleanup the local blob preview after a beat
          setTimeout(() => URL.revokeObjectURL(previewUrl), 1500);
        } catch (e: any) {
          setPending((p) =>
            p.map((it) =>
              it.id === id ? { ...it, status: "error", progress: 0, error: e?.message } : it,
            ),
          );
          toast.error(`Falló ${file.name}`, { description: e?.message });
        }
      }
    },
    [upload, workspaceId, clientId, urls, onChange],
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop: handleDrop,
    noClick: true,
    noKeyboard: true,
    accept: {
      "image/jpeg": [],
      "image/png": [],
      "image/webp": [],
      "image/gif": [],
      "video/mp4": [],
      "video/quicktime": [],
    },
    maxSize: MAX_FILE_BYTES,
  });

  const removeUrl = (u: string) => {
    onChange(urls.filter((x) => x !== u));
    setPending((p) => p.filter((it) => it.asset?.public_url !== u));
  };

  const retryItem = async (it: PendingItem) => {
    setPending((p) =>
      p.map((x) => (x.id === it.id ? { ...x, status: "uploading", progress: 30, error: undefined } : x)),
    );
    try {
      const asset = await upload.mutateAsync({
        file: it.file,
        workspaceId,
        clientId,
      });
      setPending((p) =>
        p.map((x) => (x.id === it.id ? { ...x, status: "done", progress: 100, asset } : x)),
      );
      onChange([...urls, asset.public_url]);
    } catch (e: any) {
      setPending((p) =>
        p.map((x) => (x.id === it.id ? { ...x, status: "error", error: e?.message } : x)),
      );
    }
  };

  const handlePasteUrl = () => {
    const v = urlDraft.trim();
    if (!v) return;
    try {
      new URL(v);
    } catch {
      toast.error("URL inválida");
      return;
    }
    if (urls.includes(v)) return;
    onChange([...urls, v]);
    setUrlDraft("");
  };

  // Orientation warning for reel/story when uploading landscape media
  const orientationWarning = pending.find(
    (p) =>
      p.status === "done" &&
      (postType === "reel" || postType === "story") &&
      p.asset?.orientation === "landscape",
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">
          Media {urls.length > 0 && <span className="text-foreground">({urls.length}/{MAX_ITEMS})</span>}
        </p>
        <Button type="button" variant="ghost" size="sm" onClick={onOpenLibrary}>
          <Library className="mr-1 h-3 w-3" /> Desde biblioteca
        </Button>
      </div>

      <div
        {...getRootProps()}
        className={cn(
          "relative flex flex-col items-center justify-center rounded-md border border-dashed bg-muted/30 px-4 py-6 text-center transition-colors",
          isDragActive && "border-primary bg-primary/5",
        )}
      >
        <input {...getInputProps()} />
        <Upload className="mb-2 h-6 w-6 text-muted-foreground" />
        <p className="text-sm">
          Arrastra una imagen o video aquí
        </p>
        <Button type="button" variant="link" size="sm" onClick={open} className="h-auto p-0">
          o haz clic para seleccionar
        </Button>
        <p className="mt-1 text-[11px] text-muted-foreground">
          JPG, PNG, WEBP, GIF, MP4, MOV · máx 50MB · hasta {MAX_ITEMS} archivos
        </p>
      </div>

      {orientationWarning && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-2 text-xs text-amber-700 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Reels y Stories funcionan mejor en formato vertical (9:16). Una de tus imágenes es horizontal.
          </span>
        </div>
      )}

      {/* Thumbnails — either reorderable (carousel) or static grid */}
      {urls.length > 0 && (
        isCarousel ? (
          <CarouselThumbs
            urls={urls}
            onReorder={onChange}
            onRemove={removeUrl}
            pending={pending}
          />
        ) : (
          <div className="flex flex-wrap gap-2">
            {urls.map((u) => {
              const p = pending.find((x) => x.asset?.public_url === u);
              return (
                <ThumbItem key={u} url={u} pending={p} onRemove={() => removeUrl(u)} />
              );
            })}
          </div>
        )
      )}

      {/* In-flight (uploading or errored, not yet committed) */}
      {pending.filter((p) => p.status !== "done").length > 0 && (
        <div className="flex flex-wrap gap-2">
          {pending
            .filter((p) => p.status !== "done")
            .map((p) => (
              <div
                key={p.id}
                className={cn(
                  "relative h-20 w-20 overflow-hidden rounded-md border",
                  p.status === "error" && "border-destructive",
                )}
              >
                <img src={p.previewUrl} alt="" className="h-full w-full object-cover opacity-60" />
                {p.status === "uploading" && (
                  <>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Loader2 className="h-5 w-5 animate-spin text-foreground" />
                    </div>
                    <div className="absolute inset-x-0 bottom-0">
                      <Progress value={p.progress} className="h-1 rounded-none" />
                    </div>
                  </>
                )}
                {p.status === "error" && (
                  <button
                    type="button"
                    onClick={() => retryItem(p)}
                    className="absolute inset-0 flex items-center justify-center bg-destructive/20 hover:bg-destructive/30"
                    aria-label="Reintentar"
                  >
                    <RotateCcw className="h-4 w-4 text-destructive" />
                  </button>
                )}
              </div>
            ))}
        </div>
      )}

      <Accordion type="single" collapsible value={showUrlPaste ? "url" : ""} onValueChange={(v) => setShowUrlPaste(v === "url")}>
        <AccordionItem value="url" className="border-none">
          <AccordionTrigger className="py-1 text-xs text-muted-foreground hover:no-underline">
            Pegar URL externa
          </AccordionTrigger>
          <AccordionContent>
            <div className="flex items-center gap-2 pt-1">
              <Input
                placeholder="https://drive.google.com/..."
                value={urlDraft}
                onChange={(e) => setUrlDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handlePasteUrl();
                  }
                }}
              />
              <Button type="button" variant="outline" size="sm" onClick={handlePasteUrl}>
                Agregar
              </Button>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Útil para enlaces de Drive o Dropbox. No se sube al almacenamiento.
            </p>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

function ThumbItem({
  url,
  pending,
  onRemove,
}: {
  url: string;
  pending?: PendingItem;
  onRemove: () => void;
}) {
  const isVideo = /\.(mp4|mov|webm)(\?|$)/i.test(url);
  return (
    <div className="relative h-20 w-20 shrink-0">
      {isVideo ? (
        <video src={url} className="h-full w-full rounded-md border object-cover" muted />
      ) : (
        <MediaThumb url={url} className="h-full w-full rounded-md border object-cover" />
      )}
      {pending?.status === "uploading" && (
        <div className="absolute inset-x-0 bottom-0">
          <Progress value={pending.progress} className="h-1 rounded-none" />
        </div>
      )}
      <button
        type="button"
        onClick={onRemove}
        aria-label="Quitar"
        className="absolute -right-1.5 -top-1.5 rounded-full bg-background p-0.5 shadow-sm ring-1 ring-border hover:bg-destructive hover:text-destructive-foreground"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

function CarouselThumbs({
  urls,
  onReorder,
  onRemove,
  pending,
}: {
  urls: string[];
  onReorder: (u: string[]) => void;
  onRemove: (u: string) => void;
  pending: PendingItem[];
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const onEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = urls.indexOf(String(active.id));
    const to = urls.indexOf(String(over.id));
    if (from === -1 || to === -1) return;
    onReorder(arrayMove(urls, from, to));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onEnd}>
      <SortableContext items={urls} strategy={horizontalListSortingStrategy}>
        <div className="flex flex-wrap gap-2">
          {urls.map((u, i) => {
            const p = pending.find((x) => x.asset?.public_url === u);
            return (
              <SortableThumb
                key={u}
                id={u}
                index={i}
                url={u}
                pending={p}
                onRemove={() => onRemove(u)}
              />
            );
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableThumb({
  id,
  index,
  url,
  pending,
  onRemove,
}: {
  id: string;
  index: number;
  url: string;
  pending?: PendingItem;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="relative">
      <ThumbItem url={url} pending={pending} onRemove={onRemove} />
      <span className="absolute left-1 top-1 rounded bg-background/80 px-1 text-[10px] font-semibold backdrop-blur">
        {index + 1}
      </span>
    </div>
  );
}
