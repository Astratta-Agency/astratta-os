import { useEffect, useState, type ReactNode } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  ArrowRight,
  Briefcase,
  CalendarDays,
  Check,
  Flag,
  Hourglass,
  Layers,
  Tag,
  User,
  UserRound,
  Users,
  X,
  CircleDot,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { WorkspaceMember } from "@/hooks/useProjects";
import type { TaskPriority, TaskStatus, TaskType } from "@/hooks/useTasks";
import { PRIORITY_LABEL, STATUS_CLASS, STATUS_LABEL, TYPE_LABEL } from "@/lib/task-labels";
import { AssigneeMultiSelect } from "./assignee-multi-select";
import type { TaskFormValue } from "./task-form-fields";

const PRIORITY_FLAG: Record<TaskPriority, string> = {
  p0: "text-destructive",
  p1: "text-orange-500",
  p2: "text-blue-500",
  p3: "text-muted-foreground",
};

const STATUS_ORDER: TaskStatus[] = ["todo", "doing", "review", "done"];

/** One "label → value" row of the ClickUp-style properties grid. */
function Row({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="grid min-h-9 grid-cols-[140px_1fr] items-center gap-2">
      <div className="flex items-center gap-2 text-sm text-muted-foreground [&_svg]:h-4 [&_svg]:w-4">
        {icon}
        <span>{label}</span>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Borderless trigger that looks like plain text until hovered. */
const ghost =
  "inline-flex h-8 max-w-full items-center gap-2 rounded-md px-2 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function OptionList<T extends string>({
  options,
  value,
  onPick,
  render,
}: {
  options: T[];
  value: T;
  onPick: (v: T) => void;
  render: (v: T) => ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onPick(o)}
          className="flex items-center justify-between gap-3 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted"
        >
          {render(o)}
          {o === value && <Check className="h-4 w-4 text-primary" />}
        </button>
      ))}
    </div>
  );
}

function PickerRow<T extends string>({
  value,
  options,
  onPick,
  trigger,
  render,
}: {
  value: T;
  options: T[];
  onPick: (v: T) => void;
  trigger: ReactNode;
  render: (v: T) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={ghost}>
          {trigger}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-1" align="start">
        <OptionList
          options={options}
          value={value}
          render={render}
          onPick={(v) => {
            onPick(v);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

/** "HH:mm" → "3:00 p. m." */
export function fmtTimeOfDay(t: string) {
  const [h, m] = t.split(":").map(Number);
  return format(new Date(2000, 0, 1, h, m), "h:mm a", { locale: es });
}

/** Date trigger + calendar popover with an optional time and a "clear" action. */
function DateField({
  value,
  time,
  placeholder,
  onPick,
  onTime,
}: {
  value: Date | undefined;
  time: string;
  placeholder: string;
  onPick: (d: Date | undefined) => void;
  onTime: (t: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(time);
  useEffect(() => setDraft(time), [time]);
  const commitTime = () => {
    if (draft !== time) onTime(draft);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        if (!o) commitTime();
        setOpen(o);
      }}
    >
      <PopoverTrigger asChild>
        <button type="button" className={ghost}>
          {value ? (
            <span>
              {format(value, "d MMM yyyy", { locale: es })}
              {time && <span className="text-muted-foreground"> · {fmtTimeOfDay(time)}</span>}
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={(d) => onPick(d ?? undefined)}
          initialFocus
          className="pointer-events-auto p-3"
        />
        <div className="flex items-center gap-2 border-t px-3 py-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <Input
            type="time"
            step={900}
            value={draft}
            disabled={!value}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitTime}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            aria-label="Hora (opcional)"
            className="h-8 w-32"
          />
          {time ? (
            <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => onTime("")}>
              Quitar hora
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">{value ? "Hora opcional" : "Elige una fecha"}</span>
          )}
        </div>
        {value && (
          <div className="border-t p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => {
                onPick(undefined);
                setOpen(false);
              }}
            >
              Quitar fecha
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

interface Props {
  value: TaskFormValue;
  /** Applies and persists immediately (auto-save). */
  onCommit: (patch: Partial<TaskFormValue>) => void;
  members: WorkspaceMember[];
  clients: { id: string; name: string }[];
  projects: { id: string; name: string }[];
  leads?: { id: string; company_name: string | null; contact_name: string | null }[];
}

export function TaskProperties({ value, onCommit, members, clients, projects, leads = [] }: Props) {
  const [tagInput, setTagInput] = useState("");
  const [hours, setHours] = useState(value.estimated_hours);

  const addTag = () => {
    const t = tagInput.trim();
    setTagInput("");
    if (!t || value.tags.includes(t)) return;
    onCommit({ tags: [...value.tags, t] });
  };

  const commitHours = () => {
    if (hours !== value.estimated_hours) onCommit({ estimated_hours: hours });
  };

  const sameDay =
    !!value.start_date && !!value.due_date && value.start_date.toDateString() === value.due_date.toDateString();

  const optionIds = (list: { id: string }[]) => ["none", ...list.map((x) => x.id)];
  const nameOf = (list: { id: string; name: string }[], id: string) =>
    id === "none" ? "Ninguno" : (list.find((x) => x.id === id)?.name ?? "—");
  const leadOf = (id: string) => {
    if (id === "none") return "Ninguno";
    const l = leads.find((x) => x.id === id);
    return l?.company_name || l?.contact_name || id.slice(0, 6);
  };

  return (
    <div className="space-y-0.5">
      <Row icon={<CircleDot />} label="Estado">
        <div className="flex items-center gap-1">
          <PickerRow
            value={value.status}
            options={STATUS_ORDER}
            onPick={(status) => onCommit({ status })}
            render={(s) => <Badge className={cn("font-medium", STATUS_CLASS[s])}>{STATUS_LABEL[s]}</Badge>}
            trigger={
              <Badge className={cn("font-medium uppercase tracking-wide", STATUS_CLASS[value.status])}>
                {STATUS_LABEL[value.status]}
              </Badge>
            }
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn("h-7 w-7", value.status === "done" && "text-green-600")}
            title={value.status === "done" ? "Reabrir" : "Marcar como hecha"}
            onClick={() => onCommit({ status: value.status === "done" ? "todo" : "done" })}
          >
            <Check className="h-4 w-4" />
          </Button>
        </div>
      </Row>

      <Row icon={<Users />} label="Asignados">
        <AssigneeMultiSelect
          value={value.assignee_ids}
          onChange={(ids) => onCommit({ assignee_ids: ids })}
          members={members}
          className="h-8 border-0 bg-transparent px-2 shadow-none hover:bg-muted"
        />
      </Row>

      <Row icon={<CalendarDays />} label="Fechas">
        <div className="flex flex-wrap items-center gap-1">
          <DateField
            value={value.start_date}
            time={value.start_time}
            placeholder="Inicio"
            onPick={(d) =>
              onCommit({
                start_date: d,
                ...(d ? {} : { start_time: "" }),
                ...(d && value.due_date && d > value.due_date ? { due_date: d } : {}),
              })
            }
            onTime={(t) =>
              onCommit({
                start_time: t,
                // Same day: the end can't be earlier than the start.
                ...(t && sameDay && value.due_time && t > value.due_time ? { due_time: t } : {}),
              })
            }
          />
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
          <DateField
            value={value.due_date}
            time={value.due_time}
            placeholder="Fin"
            onPick={(d) =>
              onCommit({
                due_date: d,
                ...(d ? {} : { due_time: "" }),
                ...(d && value.start_date && d < value.start_date ? { start_date: d } : {}),
              })
            }
            onTime={(t) =>
              onCommit({
                due_time: t,
                ...(t && sameDay && value.start_time && t < value.start_time ? { start_time: t } : {}),
              })
            }
          />
        </div>
      </Row>

      <Row icon={<Flag />} label="Prioridad">
        <PickerRow
          value={value.priority}
          options={["p0", "p1", "p2", "p3"] as TaskPriority[]}
          onPick={(priority) => onCommit({ priority })}
          render={(p) => (
            <span className="flex items-center gap-2">
              <Flag className={cn("h-4 w-4", PRIORITY_FLAG[p])} /> {PRIORITY_LABEL[p]}
            </span>
          )}
          trigger={
            <>
              <Flag className={cn("h-4 w-4", PRIORITY_FLAG[value.priority])} />
              {PRIORITY_LABEL[value.priority]}
            </>
          }
        />
      </Row>

      <Row icon={<Layers />} label="Tipo">
        <PickerRow
          value={value.type}
          options={Object.keys(TYPE_LABEL) as TaskType[]}
          onPick={(type) => onCommit({ type })}
          render={(t) => TYPE_LABEL[t]}
          trigger={TYPE_LABEL[value.type]}
        />
      </Row>

      <Row icon={<Hourglass />} label="Estimado (h)">
        <Input
          type="number"
          step="0.25"
          min="0"
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          onBlur={commitHours}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          placeholder="Vacío"
          className="h-8 w-28 border-0 bg-transparent px-2 shadow-none hover:bg-muted focus-visible:bg-muted"
        />
      </Row>

      <Row icon={<Tag />} label="Etiquetas">
        <div className="flex flex-wrap items-center gap-1">
          {value.tags.map((t) => (
            <Badge key={t} variant="secondary" className="gap-1">
              {t}
              <button
                type="button"
                aria-label={`Quitar ${t}`}
                onClick={() => onCommit({ tags: value.tags.filter((x) => x !== t) })}
                className="hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          <Input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onBlur={addTag}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag();
              }
            }}
            placeholder={value.tags.length ? "+" : "Vacío"}
            className="h-8 w-24 border-0 bg-transparent px-2 shadow-none hover:bg-muted focus-visible:bg-muted"
          />
        </div>
      </Row>

      <Row icon={<Briefcase />} label="Proyecto">
        <PickerRow
          value={value.project_id}
          options={optionIds(projects)}
          onPick={(project_id) => onCommit({ project_id })}
          render={(id) => nameOf(projects, id)}
          trigger={nameOf(projects, value.project_id)}
        />
      </Row>

      <Row icon={<UserRound />} label="Cliente">
        <PickerRow
          value={value.client_id}
          options={optionIds(clients)}
          onPick={(client_id) => onCommit({ client_id })}
          render={(id) => nameOf(clients, id)}
          trigger={nameOf(clients, value.client_id)}
        />
      </Row>

      <Row icon={<User />} label="Lead">
        <PickerRow
          value={value.lead_id}
          options={optionIds(leads)}
          onPick={(lead_id) => onCommit({ lead_id })}
          render={leadOf}
          trigger={leadOf(value.lead_id)}
        />
      </Row>
    </div>
  );
}
