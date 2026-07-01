import { format } from "date-fns";
import { es } from "date-fns/locale";
import { X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { WorkspaceMember } from "@/hooks/useProjects";
import type { TaskPriority, TaskStatus, TaskType } from "@/hooks/useTasks";
import { PRIORITY_LABEL, TYPE_LABEL, STATUS_LABEL } from "@/lib/task-labels";

export type TaskFormValue = {
  title: string;
  description: string;
  type: TaskType;
  priority: TaskPriority;
  status: TaskStatus;
  assigned_to: string; // "none" | uuid
  due_date: Date | undefined;
  estimated_hours: string;
  tags: string[];
  project_id: string; // "none" | uuid
  client_id: string; // "none" | uuid
  lead_id: string; // "none" | uuid
};

export const emptyTaskForm = (): TaskFormValue => ({
  title: "",
  description: "",
  type: "produccion",
  priority: "p2",
  status: "todo",
  assigned_to: "none",
  due_date: undefined,
  estimated_hours: "",
  tags: [],
  project_id: "none",
  client_id: "none",
  lead_id: "none",
});

export function taskFormToDb(f: TaskFormValue) {
  return {
    title: f.title.trim(),
    description: f.description.trim() || null,
    type: f.type,
    priority: f.priority,
    status: f.status,
    assigned_to: f.assigned_to === "none" ? null : f.assigned_to,
    due_date: f.due_date ? format(f.due_date, "yyyy-MM-dd") : null,
    estimated_hours: f.estimated_hours.trim() ? Number(f.estimated_hours) : null,
    tags: f.tags,
    project_id: f.project_id === "none" ? null : f.project_id,
    client_id: f.client_id === "none" ? null : f.client_id,
    lead_id: f.lead_id === "none" ? null : f.lead_id,
  };
}

interface Props {
  value: TaskFormValue;
  onChange: (patch: Partial<TaskFormValue>) => void;
  members: WorkspaceMember[];
  clients: { id: string; name: string }[];
  projects: { id: string; name: string }[];
  leads?: { id: string; company_name: string | null; contact_name: string | null }[];
  showStatus?: boolean;
}

export function TaskFormFields({
  value,
  onChange,
  members,
  clients,
  projects,
  leads = [],
  showStatus = false,
}: Props) {
  const [tagInput, setTagInput] = useState("");

  const addTag = () => {
    const t = tagInput.trim();
    if (!t || value.tags.includes(t)) return;
    onChange({ tags: [...value.tags, t] });
    setTagInput("");
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="tf-title">Título *</Label>
        <Input
          id="tf-title"
          value={value.title}
          onChange={(e) => onChange({ title: e.target.value })}
          maxLength={200}
          placeholder="Ej: Preparar copy para lanzamiento"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="tf-desc">Descripción</Label>
        <Textarea
          id="tf-desc"
          value={value.description}
          onChange={(e) => onChange({ description: e.target.value })}
          rows={3}
          placeholder="Detalles, contexto, links…"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Tipo</Label>
          <Select value={value.type} onValueChange={(v) => onChange({ type: v as TaskType })}>
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
          <Select value={value.priority} onValueChange={(v) => onChange({ priority: v as TaskPriority })}>
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
          <Select value={value.assigned_to} onValueChange={(v) => onChange({ assigned_to: v })}>
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
          <Label>Fecha límite</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start font-normal">
                {value.due_date ? format(value.due_date, "PPP", { locale: es }) : "Sin fecha"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={value.due_date}
                onSelect={(d) => onChange({ due_date: d ?? undefined })}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
              {value.due_date && (
                <div className="border-t p-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={() => onChange({ due_date: undefined })}
                  >
                    Quitar fecha
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tf-hours">Horas estimadas</Label>
          <Input
            id="tf-hours"
            type="number"
            step="0.25"
            min="0"
            value={value.estimated_hours}
            onChange={(e) => onChange({ estimated_hours: e.target.value })}
            placeholder="0"
          />
        </div>

        {showStatus && (
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={value.status} onValueChange={(v) => onChange({ status: v as TaskStatus })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["todo", "doing", "review", "done"] as const).map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <Label>Etiquetas</Label>
        <div className="flex gap-2">
          <Input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag();
              }
            }}
            placeholder="Agregar etiqueta y enter"
          />
          <Button type="button" variant="outline" onClick={addTag}>
            Añadir
          </Button>
        </div>
        {value.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {value.tags.map((t) => (
              <Badge key={t} variant="secondary" className="gap-1">
                {t}
                <button
                  type="button"
                  onClick={() => onChange({ tags: value.tags.filter((x) => x !== t) })}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label>Cliente</Label>
          <Select value={value.client_id} onValueChange={(v) => onChange({ client_id: v })}>
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
          <Select value={value.project_id} onValueChange={(v) => onChange({ project_id: v })}>
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

        <div className="space-y-1.5">
          <Label>Lead</Label>
          <Select value={value.lead_id} onValueChange={(v) => onChange({ lead_id: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">—</SelectItem>
              {leads.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.company_name || l.contact_name || l.id.slice(0, 6)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
