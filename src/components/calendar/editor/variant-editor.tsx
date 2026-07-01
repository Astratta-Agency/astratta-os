import { useState } from "react";
import { Hash, MessageSquare, AtSign, MapPin, Link2, Copy } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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

function ToolbarIcon({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          aria-label={label}
          className={cn(
            "relative flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          {children}
          {active && (
            <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
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

  const hasHashtags = draft.hashtags.trim().length > 0;
  const hasFirstComment = draft.first_comment.trim().length > 0;
  const hasMentions = draft.mentions.length > 0;
  const hasLocation = draft.location.trim().length > 0;
  const hasUtm = draft.utm_url.trim().length > 0;

  return (
    <div className="space-y-3">
      <Textarea
        value={draft.caption}
        onChange={(e) => patch({ caption: e.target.value })}
        placeholder={`Escribe el caption para ${meta.label}...`}
        rows={12}
        className="resize-none border-0 bg-transparent px-1 text-sm shadow-none focus-visible:ring-0"
      />

      <TooltipProvider delayDuration={200}>
        <div className="flex flex-wrap items-center gap-1 border-t pt-2">
          {/* Hashtags */}
          <Popover>
            <PopoverTrigger asChild>
              <div>
                <ToolbarIcon label="Hashtags" active={hasHashtags}>
                  <Hash className="h-4 w-4" />
                </ToolbarIcon>
              </div>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="start">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor={`tags-${channel}`} className="text-xs">Hashtags</Label>
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
                  autoFocus
                />
              </div>
            </PopoverContent>
          </Popover>

          {/* First comment */}
          {meta.firstComment && (
            <Popover>
              <PopoverTrigger asChild>
                <div>
                  <ToolbarIcon label="Primer comentario" active={hasFirstComment}>
                    <MessageSquare className="h-4 w-4" />
                  </ToolbarIcon>
                </div>
              </PopoverTrigger>
              <PopoverContent className="w-80" align="start">
                <div className="space-y-2">
                  <Label htmlFor={`first-${channel}`} className="text-xs">Primer comentario</Label>
                  <Textarea
                    id={`first-${channel}`}
                    value={draft.first_comment}
                    onChange={(e) => patch({ first_comment: e.target.value })}
                    placeholder="Se publicará como primer comentario tras el post"
                    rows={4}
                    autoFocus
                  />
                </div>
              </PopoverContent>
            </Popover>
          )}

          {/* Mentions */}
          <Popover>
            <PopoverTrigger asChild>
              <div>
                <ToolbarIcon label="Menciones" active={hasMentions}>
                  <AtSign className="h-4 w-4" />
                </ToolbarIcon>
              </div>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="start">
              <div className="space-y-2">
                <Label htmlFor={`mentions-${channel}`} className="text-xs">Menciones</Label>
                <Input
                  id={`mentions-${channel}`}
                  value={draft.mentions.join(" ")}
                  onChange={(e) =>
                    patch({ mentions: e.target.value.split(/\s+/).filter(Boolean) })
                  }
                  placeholder="@usuario @marca"
                  autoFocus
                />
              </div>
            </PopoverContent>
          </Popover>

          {/* Location */}
          <Popover>
            <PopoverTrigger asChild>
              <div>
                <ToolbarIcon label="Ubicación" active={hasLocation}>
                  <MapPin className="h-4 w-4" />
                </ToolbarIcon>
              </div>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="start">
              <div className="space-y-2">
                <Label htmlFor={`loc-${channel}`} className="text-xs">Ubicación</Label>
                <Input
                  id={`loc-${channel}`}
                  value={draft.location}
                  onChange={(e) => patch({ location: e.target.value })}
                  placeholder="Ej: 180 Grados Med Spa, Dallas TX"
                  autoFocus
                />
              </div>
            </PopoverContent>
          </Popover>

          {/* UTM */}
          <ToolbarIcon label="UTM / Link" active={hasUtm} onClick={() => setUtmOpen(true)}>
            <Link2 className="h-4 w-4" />
          </ToolbarIcon>

          {/* Copy to other channels */}
          {otherChannels.length > 0 && (
            <ToolbarIcon label="Copiar a otros canales" onClick={() => setCopyOpen(true)}>
              <Copy className="h-4 w-4" />
            </ToolbarIcon>
          )}

          {/* Counters */}
          <div className="ml-auto flex items-center gap-3 pr-1 text-[11px] tabular-nums">
            <span
              className={cn(
                tagTone === "ok" && "text-muted-foreground",
                tagTone === "warn" && "text-amber-600 dark:text-amber-400",
                tagTone === "over" && "text-destructive",
              )}
            >
              #{tagCount}/{meta.hashtagLimit}
            </span>
            <span
              className={cn(
                captionTone === "ok" && "text-muted-foreground",
                captionTone === "warn" && "text-amber-600 dark:text-amber-400",
                captionTone === "over" && "text-destructive",
              )}
            >
              {draft.caption.length}/{meta.limit}
            </span>
          </div>
        </div>
      </TooltipProvider>

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
            <label
              key={c}
              className="flex cursor-pointer items-center gap-2 rounded-md border p-2 hover:bg-muted/40"
            >
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
