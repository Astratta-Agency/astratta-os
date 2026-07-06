import { format, formatDistanceToNow, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { History } from "lucide-react";
import { useTaskActivity, type TaskActivityEntry, type TaskPriority, type TaskStatus, type TaskType } from "@/hooks/useTasks";
import type { WorkspaceMember } from "@/hooks/useProjects";
import { PRIORITY_LABEL, STATUS_LABEL, TYPE_LABEL } from "@/lib/task-labels";

interface Props {
  taskId: string;
  members: WorkspaceMember[];
  clients: { id: string; name: string }[];
  projects: { id: string; name: string }[];
  leads?: { id: string; company_name: string | null; contact_name: string | null }[];
}

function memberName(members: WorkspaceMember[], id: string | null | undefined) {
  if (!id) return null;
  const m = members.find((x) => x.user_id === id);
  return m?.full_name || m?.email || "Usuario";
}

function fmtDate(v: string | null) {
  if (!v) return null;
  try {
    return format(parseISO(v), "dd/MM/yyyy");
  } catch {
    return v;
  }
}

export function describeActivity(
  e: TaskActivityEntry,
  ctx: Pick<Props, "members" | "clients" | "projects" | "leads">,
): string {
  if (e.action === "created") return "creó la tarea";

  const q = (s: string | null) => (s ? `«${s}»` : "");

  switch (e.field) {
    case "status": {
      const from = STATUS_LABEL[e.old_value as TaskStatus] ?? e.old_value;
      const to = STATUS_LABEL[e.new_value as TaskStatus] ?? e.new_value;
      return `cambió el estado de ${q(from)} a ${q(to)}`;
    }
    case "assigned_to": {
      const from = memberName(ctx.members, e.old_value);
      const to = memberName(ctx.members, e.new_value);
      if (!from && to) return `asignó la tarea a ${to}`;
      if (from && !to) return `quitó la asignación (antes ${from})`;
      return `reasignó la tarea de ${from ?? "?"} a ${to ?? "?"}`;
    }
    case "title":
      return `cambió el título de ${q(e.old_value)} a ${q(e.new_value)}`;
    case "description":
      return "editó la descripción";
    case "priority": {
      const from = PRIORITY_LABEL[e.old_value as TaskPriority] ?? e.old_value;
      const to = PRIORITY_LABEL[e.new_value as TaskPriority] ?? e.new_value;
      return `cambió la prioridad de ${from} a ${to}`;
    }
    case "type": {
      const from = TYPE_LABEL[e.old_value as TaskType] ?? e.old_value;
      const to = TYPE_LABEL[e.new_value as TaskType] ?? e.new_value;
      return `cambió el tipo de ${q(from)} a ${q(to)}`;
    }
    case "due_date": {
      const from = fmtDate(e.old_value);
      const to = fmtDate(e.new_value);
      if (!from && to) return `definió la fecha límite: ${to}`;
      if (from && !to) return `quitó la fecha límite (antes ${from})`;
      return `cambió la fecha límite de ${from} a ${to}`;
    }
    case "estimated_hours": {
      if (!e.old_value && e.new_value) return `estimó ${e.new_value} h`;
      if (e.old_value && !e.new_value) return "quitó la estimación de horas";
      return `cambió las horas estimadas de ${e.old_value} a ${e.new_value}`;
    }
    case "tags":
      return e.new_value
        ? `actualizó las etiquetas: ${e.new_value}`
        : "quitó todas las etiquetas";
    case "project_id": {
      const name = (id: string | null) => ctx.projects.find((p) => p.id === id)?.name ?? null;
      const to = name(e.new_value);
      if (!e.new_value) return "desvinculó la tarea del proyecto";
      return `movió la tarea al proyecto ${q(to ?? e.new_value)}`;
    }
    case "client_id": {
      const name = (id: string | null) => ctx.clients.find((c) => c.id === id)?.name ?? null;
      const to = name(e.new_value);
      if (!e.new_value) return "desvinculó la tarea del cliente";
      return `vinculó la tarea al cliente ${q(to ?? e.new_value)}`;
    }
    case "lead_id": {
      const lead = ctx.leads?.find((l) => l.id === e.new_value);
      const label = lead?.company_name || lead?.contact_name || null;
      if (!e.new_value) return "desvinculó la tarea del lead";
      return `vinculó la tarea al lead ${q(label ?? e.new_value)}`;
    }
    default:
      return `modificó ${e.field ?? "la tarea"}`;
  }
}

export function TaskActivity({ taskId, members, clients, projects, leads }: Props) {
  const { data: entries = [], isLoading } = useTaskActivity(taskId);

  return (
    <div className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <History className="h-4 w-4" /> Actividad
      </h3>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando actividad…</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin actividad registrada.</p>
      ) : (
        <ol className="relative ml-2 space-y-4 border-l border-border pl-4">
          {entries.map((e) => {
            const actor = memberName(members, e.actor_id) ?? "Sistema";
            return (
              <li key={e.id} className="relative">
                <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-primary/60" />
                <div className="text-sm">
                  <span className="font-medium">{actor}</span>{" "}
                  <span className="text-muted-foreground">
                    {describeActivity(e, { members, clients, projects, leads })}
                  </span>
                </div>
                <div
                  className="text-[10px] text-muted-foreground"
                  title={format(parseISO(e.created_at), "dd/MM/yyyy HH:mm")}
                >
                  {formatDistanceToNow(parseISO(e.created_at), { addSuffix: true, locale: es })}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
