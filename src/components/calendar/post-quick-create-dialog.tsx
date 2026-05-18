import { useEffect, useState } from "react";
import { addDays, format, setHours, setMinutes } from "date-fns";
import { CalendarIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { CHANNELS, CHANNEL_LABEL, type Channel, type PostStatus } from "@/lib/post-states";
import { ChannelIcon } from "./channel-icon";
import type { ContentPillar } from "@/hooks/useSocialPosts";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultDate?: Date | null;
  pillarOptions: ContentPillar[];
  submitting?: boolean;
  onSubmit: (input: {
    caption: string;
    scheduled_for: Date;
    channels: Channel[];
    content_pillar: string | null;
    status: PostStatus;
  }) => Promise<void> | void;
}

export function PostQuickCreateDialog({
  open,
  onOpenChange,
  defaultDate,
  pillarOptions,
  submitting,
  onSubmit,
}: Props) {
  const [caption, setCaption] = useState("");
  const [date, setDate] = useState<Date>(defaultDate ?? setMinutes(setHours(addDays(new Date(), 1), 9), 0));
  const [time, setTime] = useState("09:00");
  const [channels, setChannels] = useState<Channel[]>(["instagram"]);
  const [pillar, setPillar] = useState<string>("__none__");
  const [status, setStatus] = useState<PostStatus>("draft");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      const base = defaultDate ?? setMinutes(setHours(addDays(new Date(), 1), 9), 0);
      setDate(base);
      setTime(format(base, "HH:mm"));
      setCaption("");
      setChannels(["instagram"]);
      setPillar("__none__");
      setStatus("draft");
      setError(null);
    }
  }, [open, defaultDate]);

  const handleSubmit = async () => {
    setError(null);
    if (!caption.trim()) return setError("El caption no puede estar vacío");
    if (channels.length === 0) return setError("Selecciona al menos un canal");
    const [hh, mm] = time.split(":").map((n) => parseInt(n, 10));
    if (Number.isNaN(hh) || Number.isNaN(mm)) return setError("Hora inválida");
    const scheduled = setMinutes(setHours(date, hh), mm);
    const min = addDays(new Date(), -30);
    const max = addDays(new Date(), 365);
    if (scheduled < min || scheduled > max) {
      return setError("La fecha debe estar entre 30 días atrás y 365 días adelante");
    }
    await onSubmit({
      caption: caption.trim(),
      scheduled_for: scheduled,
      channels,
      content_pillar: pillar === "__none__" ? null : pillar,
      status,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nueva publicación</DialogTitle>
          <DialogDescription>Crea rápidamente. Podrás detallar más en el editor completo.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="caption">Caption</Label>
            <Textarea
              id="caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value.slice(0, 500))}
              placeholder="Escribe el caption..."
              rows={4}
            />
            <p className="text-right text-[11px] text-muted-foreground">{caption.length}/500</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Fecha</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(date, "dd MMM yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(d) => d && setDate(d)}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="time">Hora</Label>
              <Input id="time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Canales</Label>
            <div className="flex flex-wrap gap-1.5">
              {CHANNELS.map((c) => {
                const active = channels.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() =>
                      setChannels((arr) => (active ? arr.filter((x) => x !== c) : [...arr, c]))
                    }
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground hover:border-primary/60",
                    )}
                  >
                    <ChannelIcon channel={c} size="sm" />
                    {CHANNEL_LABEL[c]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Pilar</Label>
              <Select value={pillar} onValueChange={setPillar}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {pillarOptions.map((o) => (
                    <SelectItem key={o.id ?? "__none__"} value={o.id ?? "__none__"}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Estado inicial</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as PostStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="idea">Idea</SelectItem>
                  <SelectItem value="draft">Borrador</SelectItem>
                  <SelectItem value="pending_internal_review">Revisión interna</SelectItem>
                  <SelectItem value="pending_approval">Esperando cliente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Creando..." : "Crear"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
