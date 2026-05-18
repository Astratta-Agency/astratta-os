import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CHANNEL_META, counterTone, countHashtags } from "@/lib/channels";
import type { Channel } from "@/lib/post-states";
import { CHANNEL_LABEL } from "@/lib/post-states";
import { UtmBuilderDialog } from "./utm-builder-dialog";
import type { PostVariantRow } from "@/hooks/usePostEditor";
import { cn } from "@/lib/utils";
import { ChannelIcon } from "../channel-icon";

export type VariantDraft = {
  caption: string;
  hashtags: string;
  first_comment: string;
  mentions: string[];
  location: string;
  utm_url: string;
};

export function emptyDraft(): VariantDraft {
  return { caption: "", hashtags: "", first_comment: "", mentions: [], location: "", utm_url: "" };
}

export function variantToDraft(v: PostVariantRow | undefined | null): VariantDraft {
  if (!v) return emptyDraft();
  return {
    caption: v.caption ?? "",
    hashtags: v.hashtags ?? "",
    first_comment: v.first_comment ?? "",
    mentions: v.mentions ?? [],
    location: v.location ?? "",
    utm_url: v.utm_url ?? "",
  };
}

interface Props {
  channel: Channel;
  draft: VariantDraft;
  onChange: (next: VariantDraft) => void;
  otherChannels: Channel[];
  onCopyTo: (channels: Channel[]) => void;
  clientSlug: string;
  postId: string;
  scheduledFor: string | null;
}

export function VariantEditor({
  channel,
  draft,
  onChange,
  otherChannels,
  onCopyTo,
  clientSlug,
  postId,
  scheduledFor,
}: Props) {
  const meta = CHANNEL_META[channel];
  const [utmOpen, setUtmOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);

  const captionTone = counterTone(draft.caption.length, meta.limit);
  const tagCount = countHashtags(draft.hashtags);
  const tagTone = counterTone(tagCount, meta.hashtagLimit);

  const patch = (p: Partial<VariantDraft>) => onChange({ ...draft, ...p });

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between">
          <Label htmlFor={`caption-${channel}`}>Caption</Label>
          <span
            className={cn(
              "text-[11px] tabular-nums",
              captionTone === "ok" && "text-muted-foreground",
              captionTone === "warn" && "text-amber-600 dark:text-amber-400",
              captionTone === "over" && "text-destructive",
            )}
          >
            {draft.caption.length}/{meta.limit}
          </span>
        </div>
        <Textarea
          id={`caption-${channel}`}
          value={draft.caption}
          onChange={(e) => patch({ caption: e.target.value })}
          placeholder={`Escribe la caption para ${meta.label}...`}
          rows={6}
          className="mt-1 font-mono text-sm"
        />
      </div>

      <div>
        <div className="flex items-center justify-between">
          <Label htmlFor={`tags-${channel}`}>Hashtags</Label>
          <span
            className={cn(
              "text-[11px] tabular-nums",
              tagTone === "ok" && "text-muted-foreground",
              tagTone === "warn" && "text-amber-600 dark:text-amber-400",
              tagTone === "over" && "text-destructive",
            )}
          >
            {tagCount}/{meta.hashtagLimit}
          </span>
        </div>
        <Input
          id={`tags-${channel}`}
          value={draft.hashtags}
          onChange={(e) => patch({ hashtags: e.target.value })}
          placeholder="#astratta #medspa #dallas"
          className="mt-1"
        />
      </div>

      {meta.firstComment && (
        <div>
          <Label htmlFor={`first-${channel}`}>Primer comentario</Label>
          <Textarea
            id={`first-${channel}`}
            value={draft.first_comment}
            onChange={(e) => patch({ first_comment: e.target.value })}
            placeholder="Se publicará como primer comentario tras el post (útil para hashtags ocultos)"
            rows={2}
            className="mt-1"
          />
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label htmlFor={`mentions-${channel}`}>Menciones</Label>
          <Input
            id={`mentions-${channel}`}
            value={draft.mentions.join(" ")}
            onChange={(e) =>
              patch({ mentions: e.target.value.split(/\s+/).filter(Boolean) })
            }
            placeholder="@usuario @marca"
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor={`loc-${channel}`}>Ubicación</Label>
          <Input
            id={`loc-${channel}`}
            value={draft.location}
            onChange={(e) => patch({ location: e.target.value })}
            placeholder="Ej: 180 Grados Med Spa, Dallas TX"
            className="mt-1"
          />
        </div>
      </div>

      <div>
        <Label>UTM URL</Label>
        <div className="mt-1 flex items-center gap-2">
          <Input
            value={draft.utm_url}
            onChange={(e) => patch({ utm_url: e.target.value })}
            placeholder="Sin UTM"
            className="font-mono text-xs"
          />
          <Button type="button" variant="outline" size="sm" onClick={() => setUtmOpen(true)}>
            Generar
          </Button>
        </div>
      </div>

      {otherChannels.length > 0 && (
        <div className="border-t pt-3">
          <Button type="button" variant="ghost" size="sm" onClick={() => setCopyOpen(true)}>
            Copiar variante a otros canales
          </Button>
        </div>
      )}

      <UtmBuilderDialog
        open={utmOpen}
        onOpenChange={setUtmOpen}
        channel={channel}
        clientSlug={clientSlug}
        postId={postId}
        scheduledFor={scheduledFor}
        initialUrl={draft.utm_url}
        onApply={(url) => patch({ utm_url: url })}
      />

      <CopyVariantDialog
        open={copyOpen}
        onOpenChange={setCopyOpen}
        otherChannels={otherChannels}
        onCopy={onCopyTo}
      />
    </div>
  );
}

function CopyVariantDialog({
  open,
  onOpenChange,
  otherChannels,
  onCopy,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  otherChannels: Channel[];
  onCopy: (cs: Channel[]) => void;
}) {
  const [selected, setSelected] = useState<Channel[]>([]);

  const toggle = (c: Channel) =>
    setSelected((s) => (s.includes(c) ? s.filter((x) => x !== c) : [...s, c]));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Copiar variante a otros canales</DialogTitle>
          <DialogDescription>
            Se copiará caption, hashtags, menciones y ubicación. UTM y primer comentario no se copian.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {otherChannels.map((c) => (
            <label key={c} className="flex cursor-pointer items-center gap-2 rounded-md border p-2 hover:bg-muted/40">
              <Checkbox checked={selected.includes(c)} onCheckedChange={() => toggle(c)} />
              <ChannelIcon channel={c} size="sm" />
              <span className="text-sm">{CHANNEL_LABEL[c]}</span>
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={selected.length === 0}
            onClick={() => {
              onCopy(selected);
              setSelected([]);
              onOpenChange(false);
            }}
          >
            Copiar a {selected.length} canal{selected.length === 1 ? "" : "es"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
