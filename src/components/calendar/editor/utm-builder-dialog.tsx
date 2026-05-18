import { useMemo, useState } from "react";
import { format as fmt } from "date-fns";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type { Channel } from "@/lib/post-states";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  channel: Channel;
  clientSlug: string;
  postId: string;
  scheduledFor: string | null;
  initialUrl: string | null;
  onApply: (utmUrl: string) => void;
}

export function UtmBuilderDialog({
  open,
  onOpenChange,
  channel,
  clientSlug,
  postId,
  scheduledFor,
  initialUrl,
  onApply,
}: Props) {
  const baseDefault = useMemo(() => {
    try {
      if (initialUrl) {
        const u = new URL(initialUrl);
        return `${u.origin}${u.pathname}`;
      }
    } catch {}
    return "";
  }, [initialUrl]);

  const [base, setBase] = useState(baseDefault);
  const monthTag = scheduledFor ? fmt(new Date(scheduledFor), "yyyy-MM") : fmt(new Date(), "yyyy-MM");
  const [source, setSource] = useState(channel);
  const [medium, setMedium] = useState("social");
  const [campaign, setCampaign] = useState(`${clientSlug}-${monthTag}`);
  const [content, setContent] = useState(postId.slice(-8));

  const result = useMemo(() => {
    if (!base) return "";
    try {
      const u = new URL(base);
      const params = u.searchParams;
      if (source) params.set("utm_source", source);
      if (medium) params.set("utm_medium", medium);
      if (campaign) params.set("utm_campaign", campaign);
      if (content) params.set("utm_content", content);
      return u.toString();
    } catch {
      return "";
    }
  }, [base, source, medium, campaign, content]);

  const valid = result.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generar UTM</DialogTitle>
          <DialogDescription>
            Construye un link rastreado para esta variante. Se guardará solo en este canal.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div>
            <Label htmlFor="utm-base">URL base</Label>
            <Input
              id="utm-base"
              placeholder="https://tucliente.com/landing"
              value={base}
              onChange={(e) => setBase(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="utm-source">Source</Label>
              <Input id="utm-source" value={source} onChange={(e) => setSource(e.target.value as Channel)} />
            </div>
            <div>
              <Label htmlFor="utm-medium">Medium</Label>
              <Input id="utm-medium" value={medium} onChange={(e) => setMedium(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="utm-campaign">Campaign</Label>
              <Input id="utm-campaign" value={campaign} onChange={(e) => setCampaign(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="utm-content">Content</Label>
              <Input id="utm-content" value={content} onChange={(e) => setContent(e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Resultado</Label>
            <div className="mt-1 break-all rounded-md border bg-muted/30 p-2 text-xs">
              {result || <span className="text-muted-foreground">Ingresa una URL base válida</span>}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            disabled={!valid}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(result);
                toast.success("Copiado al portapapeles");
              } catch {
                toast.error("No se pudo copiar");
              }
            }}
          >
            Copiar
          </Button>
          <Button
            disabled={!valid}
            onClick={() => {
              onApply(result);
              onOpenChange(false);
            }}
          >
            Aplicar a esta variante
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
