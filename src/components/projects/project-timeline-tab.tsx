import { useMemo, useState } from "react";
import { CheckCircle2, FilePen, Pencil, Sparkles } from "lucide-react";
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
import {
  useProjectTimeline,
  useCreateProjectNote,
  type ProjectTimelineEvent,
  type ProjectTimelineFilter,
} from "@/hooks/useProjectDetail";
import { PROJECT_STATUS_LABEL } from "@/components/projects/project-meta";
import type { ProjectStatus } from "@/integrations/supabase/database.types";

const iconFor = (t: ProjectTimelineEvent["event_type"]) => {
  switch (t) {
    case "project_status_changed":
      return CheckCircle2;
    case "project_updated":
      return Pencil;
    case "manual":
      return FilePen;
    default:
      return Sparkles;
  }
};

interface Props {
  projectId: string;
  clientId: string;
  workspaceId: string;
  projectName: string;
  projectCreatedAt: string;
}

export function ProjectTimelineTab({
  projectId,
  clientId,
  workspaceId,
  projectName,
  projectCreatedAt,
}: Props) {
  const [filter, setFilter] = useState<ProjectTimelineFilter>("all");
  const { data, isLoading } = useProjectTimeline(clientId, projectId, filter);
  const [open, setOpen] = useState(false);

  const events = useMemo<ProjectTimelineEvent[]>(() => {
    const list = data ?? [];
    if (filter === "status") return list;
    const synthetic: ProjectTimelineEvent = {
      id: `__created_${projectId}`,
      event_type: "project_created",
      title: `Proyecto creado — ${projectName}`,
      description: null,
      metadata: { project_id: projectId },
      actor_id: null,
      occurred_at: projectCreatedAt,
    };
    // Avoid duplicate if a real project_created event exists in db
    const hasCreated = list.some((e) => e.event_type === "project_created");
    return hasCreated ? list : [...list, synthetic];
  }, [data, filter, projectId, projectName, projectCreatedAt]);

  const renderTitle = (ev: ProjectTimelineEvent): string => {
    if (ev.event_type === "project_status_changed") {
      const meta = (ev.metadata ?? {}) as { from_status?: ProjectStatus; to_status?: ProjectStatus };
      if (meta.from_status && meta.to_status) {
        return `${projectName}: ${PROJECT_STATUS_LABEL[meta.from_status]} → ${PROJECT_STATUS_LABEL[meta.to_status]}`;
      }
    }
    return ev.title;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Select value={filter} onValueChange={(v) => setFilter(v as ProjectTimelineFilter)}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="status">Cambios de estado</SelectItem>
            <SelectItem value="manual">Notas</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          Agregar nota
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : events.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Sin eventos para este filtro.
          </CardContent>
        </Card>
      ) : (
        <div className="relative">
          <div className="absolute bottom-0 left-4 top-0 w-px bg-border" />
          <ul className="space-y-4">
            {events.map((ev) => {
              const Icon = iconFor(ev.event_type);
              return (
                <li key={ev.id} className="relative flex gap-4 pl-1">
                  <div className="z-10 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <Card className="flex-1">
                    <CardContent className="p-3">
                      <div className="flex items-baseline justify-between gap-3">
                        <div className="text-sm font-medium text-foreground">
                          {renderTitle(ev)}
                        </div>
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

      <AddNoteDialog
        open={open}
        onOpenChange={setOpen}
        clientId={clientId}
        workspaceId={workspaceId}
        projectId={projectId}
      />
    </div>
  );
}

function AddNoteDialog({
  open,
  onOpenChange,
  clientId,
  workspaceId,
  projectId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  clientId: string;
  workspaceId: string;
  projectId: string;
}) {
  const create = useCreateProjectNote(clientId, workspaceId, projectId);
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
      toast({ title: "Nota agregada" });
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
          <DialogTitle>Agregar nota</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="pn_t">Título *</Label>
            <Input id="pn_t" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pn_d">Descripción</Label>
            <Textarea id="pn_d" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pn_date">Fecha (opcional)</Label>
            <Input id="pn_date" type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
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
