import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  useCreateRecurrenceRule,
  useUpdateRecurrenceRule,
  type RecurrenceRule,
  type TaskPriority,
  type TaskType,
} from "@/hooks/useTasks";
import type { WorkspaceMember } from "@/hooks/useProjects";
import { PRIORITY_LABEL, TYPE_LABEL } from "@/lib/task-labels";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  workspaceId: string;
  members: WorkspaceMember[];
  clients: { id: string; name: string }[];
  projects: { id: string; name: string }[];
  editing?: RecurrenceRule | null;
}

export function RecurringRuleDialog({
  open,
  onOpenChange,
  workspaceId,
  members,
  clients,
  projects,
  editing,
}: Props) {
  const create = useCreateRecurrenceRule();
  const update = useUpdateRecurrenceRule();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<TaskType>("produccion");
  const [priority, setPriority] = useState<TaskPriority>("p2");
  const [assignedTo, setAssignedTo] = useState<string>("none");
  const [clientId, setClientId] = useState<string>("none");
  const [projectId, setProjectId] = useState<string>("none");
  const [estHours, setEstHours] = useState("");
  const [frequency, setFrequency] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [nextRunDate, setNextRunDate] = useState<Date | undefined>(new Date());

  useEffect(() => {
    if (editing) {
      setTitle(editing.title);
      setDescription(editing.description ?? "");
      setType(editing.type);
      setPriority(editing.priority);
      setAssignedTo(editing.assigned_to ?? "none");
      setClientId(editing.client_id ?? "none");
      setProjectId(editing.project_id ?? "none");
      setEstHours(editing.estimated_hours != null ? String(editing.estimated_hours) : "");
      setFrequency(editing.frequency);
      setNextRunDate(parseISO(editing.next_run_date));
    } else {
      setTitle("");
      setDescription("");
      setType("produccion");
      setPriority("p2");
      setAssignedTo("none");
      setClientId("none");
      setProjectId("none");
      setEstHours("");
      setFrequency("weekly");
      setNextRunDate(new Date());
    }
  }, [editing, open]);

  const submit = async () => {
    if (!title.trim() || !nextRunDate) return;
    const payload = {
      workspace_id: workspaceId,
      title: title.trim(),
      description: description.trim() || null,
      type,
      priority,
      assigned_to: assignedTo === "none" ? null : assignedTo,
      client_id: clientId === "none" ? null : clientId,
      project_id: projectId === "none" ? null : projectId,
      estimated_hours: estHours.trim() ? Number(estHours) : null,
      frequency,
      next_run_date: format(nextRunDate, "yyyy-MM-dd"),
    };
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, patch: payload as any });
        toast.success("Regla actualizada");
      } else {
        await create.mutateAsync(payload as any);
        toast.success("Regla creada");
      }
      onOpenChange(false);
    } catch (e: any) {
      toast.error("No se pudo guardar", { description: e?.message });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar regla recurrente" : "Nueva regla recurrente"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Título *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
          </div>
          <div className="space-y-1.5">
            <Label>Descripción</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Frecuencia</Label>
              <Select value={frequency} onValueChange={(v) => setFrequency(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Diaria</SelectItem>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="monthly">Mensual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Próxima fecha</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start font-normal">
                    {nextRunDate ? format(nextRunDate, "PPP", { locale: es }) : "Selecciona"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={nextRunDate}
                    onSelect={setNextRunDate}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={type} onValueChange={(v) => setType(v as TaskType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(TYPE_LABEL) as TaskType[]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {TYPE_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Prioridad</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["p0", "p1", "p2", "p3"] as const).map((p) => (
                    <SelectItem key={p} value={p}>
                      {PRIORITY_LABEL[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Asignado</Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin asignar</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      {m.full_name || m.email || m.user_id.slice(0, 6)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Horas estimadas</Label>
              <Input
                type="number"
                step="0.25"
                min="0"
                value={estHours}
                onChange={(e) => setEstHours(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Cliente</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Proyecto</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={submit}
            disabled={!title.trim() || !nextRunDate || create.isPending || update.isPending}
          >
            {editing ? "Guardar" : "Crear regla"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
