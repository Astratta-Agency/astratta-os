import { format as fmt } from "date-fns";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ContentPillar } from "@/hooks/useSocialPosts";

export type PostFormat = "feed_post" | "carousel" | "reel" | "story" | "video" | "other";

const FORMAT_OPTIONS: { value: PostFormat; label: string }[] = [
  { value: "feed_post", label: "Feed" },
  { value: "carousel", label: "Carrusel" },
  { value: "reel", label: "Reel" },
  { value: "story", label: "Story" },
  { value: "video", label: "Video" },
  { value: "other", label: "Otro" },
];

interface Props {
  clientName: string;
  type: PostFormat;
  onType: (t: PostFormat) => void;
  scheduledFor: string | null;
  onScheduledFor: (iso: string | null) => void;
  pillar: string | null;
  onPillar: (p: string | null) => void;
  pillarOptions: ContentPillar[];
}

export function PostEditorMeta({
  clientName,
  type,
  onType,
  scheduledFor,
  onScheduledFor,
  pillar,
  onPillar,
  pillarOptions,
}: Props) {
  const dtLocal = scheduledFor
    ? fmt(new Date(scheduledFor), "yyyy-MM-dd'T'HH:mm")
    : "";

  return (
    <div className="space-y-3 rounded-lg border bg-card p-3">
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label className="text-xs text-muted-foreground">Cliente</Label>
          <p className="mt-1 text-sm font-medium">{clientName}</p>
        </div>
        <div>
          <Label htmlFor="scheduled" className="text-xs text-muted-foreground">
            Fecha programada
          </Label>
          <Input
            id="scheduled"
            type="datetime-local"
            value={dtLocal}
            onChange={(e) => {
              const v = e.target.value;
              onScheduledFor(v ? new Date(v).toISOString() : null);
            }}
            className="mt-1"
          />
        </div>
      </div>

      <div>
        <Label className="text-xs text-muted-foreground">Formato</Label>
        <div className="mt-1 inline-flex flex-wrap gap-1 rounded-md border bg-muted/30 p-0.5">
          {FORMAT_OPTIONS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => onType(f.value)}
              className={`rounded px-2.5 py-1 text-xs font-medium transition ${
                type === f.value ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label className="text-xs text-muted-foreground">Pilar de contenido</Label>
        <Select
          value={pillar ?? "__none__"}
          onValueChange={(v) => onPillar(v === "__none__" ? null : v)}
        >
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Sin pilar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Sin pilar</SelectItem>
            {pillarOptions
              .filter((p) => p.id !== null)
              .map((p) => (
                <SelectItem key={p.id!} value={p.name}>
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
                    {p.name}
                  </span>
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
