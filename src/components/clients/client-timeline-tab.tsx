import { useState } from "react";
import {
  Briefcase,
  CheckCircle2,
  CircleUser,
  FilePen,
  RefreshCcw,
  Sparkles,
  StickyNote,
  UserPlus,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useClientTimeline,
  useCreateManualEvent,
  type TimelineFilter,
  type TimelineEvent,
} from "@/hooks/useClientDetail";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";

const iconFor = (t: TimelineEvent["event_type"]) => {
  switch (t) {
    case "client_created":
      return Sparkles;
    case "client_updated":
      return RefreshCcw;
    case "project_created":
      return Briefcase;
    case "project_status_changed":
      return CheckCircle2;
    case "contact_added":
      return UserPlus;
    case "contact_updated":
      return CircleUser;
    case "note_updated":
      return StickyNote;
    case "manual":
    default:
      return FilePen;
  }
};

interface Props {
  clientId: string;
  workspaceId: string;
}

export function ClientTimelineTab({ clientId, workspaceId }: Props) {
  const [filter, setFilter] = useState<TimelineFilter>("all");
  const { data, isLoading } = useClientTimeline(clientId, filter);
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Select value={filter} onValueChange={(v) => setFilter(v as TimelineFilter)}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="projects">Proyectos</SelectItem>
            <SelectItem value="contacts">Contactos</SelectItem>
            <SelectItem value="notes">Notas</SelectItem>
            <SelectItem value="client">Cliente</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          Agregar evento
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : (data?.length ?? 0) === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Sin eventos para este filtro.
          </CardContent>
        </Card>
      ) : (
        <div className="relative">
          <div className="absolute bottom-0 left-4 top-0 w-px bg-border" />
          <ul className="space-y-4">
            {data!.map((ev) => {
              const Icon = iconFor(ev.event_type);
              return (
                <li key={ev.id} className="relative flex gap-4 pl-1">
                  <div className="z-10 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <Card className="flex-1">
                    <CardContent className="p-3">
                      <div className="flex items-baseline justify-between gap-3">
                        <div className="text-sm font-medium text-foreground">{ev.title}</div>
                        <div className="text-xs text-muted-foreground">
                          hace {formatDistanceToNow(new Date(ev.occurred_at), { locale: es })}
                        </div>
                      </div>
                      {ev.description && (
                        <div className="mt-1 text-xs text-muted-foreground">{ev.description}</div>
                      )}
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <AddManualEventDialog
        open={open}
        onOpenChange={setOpen}
        clientId={clientId}
        workspaceId={workspaceId}
      />
    </div>
  );
}

function AddManualEventDialog({
  open,
  onOpenChange,
  clientId,
  workspaceId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  clientId: string;
  workspaceId: string;
}) {
  const create = useCreateManualEvent(clientId, workspaceId);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      await create.mutateAsync({
        title: title.trim(),
        description: description.trim() || undefined,
        occurred_at: date ? new Date(date).toISOString() : undefined,
      });
      toast({ title: "Evento agregado" });
      setTitle("");
      setDescription("");
      setDate("");
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Error", description: err?.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agregar evento</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ev_t">Título *</Label>
            <Input id="ev_t" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ev_d">Descripción</Label>
            <Textarea id="ev_d" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ev_date">Fecha (opcional)</Label>
            <Input id="ev_date" type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
