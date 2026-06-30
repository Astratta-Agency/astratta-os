import { useState } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useProjectTasks,
  useCreateProjectTask,
  useUpdateProjectTaskStatus,
  type ProjectTask,
} from "@/hooks/useProjectDetail";
import type { WorkspaceMember } from "@/hooks/useProjects";

const STATUS_LABEL: Record<ProjectTask["status"], string> = {
  todo: "Por hacer",
  doing: "En curso",
  review: "Revisión",
  done: "Hecho",
};

const PRIORITY_LABEL: Record<ProjectTask["priority"], string> = {
  p0: "P0",
  p1: "P1",
  p2: "P2",
  p3: "P3",
};

const PRIORITY_CLASS: Record<ProjectTask["priority"], string> = {
  p0: "bg-destructive text-destructive-foreground",
  p1: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  p2: "bg-muted text-foreground",
  p3: "bg-muted/60 text-muted-foreground",
};

interface Props {
  projectId: string;
  workspaceId: string;
  clientId: string;
  members: WorkspaceMember[];
  createOpen: boolean;
  onCreateOpenChange: (v: boolean) => void;
}

function memberLabel(members: WorkspaceMember[], id: string | null) {
  if (!id) return null;
  const m = members.find((x) => x.user_id === id);
  if (!m) return null;
  const name = m.full_name || m.email || "Miembro";
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return { name, initials, avatar: m.avatar_url };
}

export function ProjectTasksTab({
  projectId,
  workspaceId,
  clientId,
  members,
  createOpen,
  onCreateOpenChange,
}: Props) {
  const { data: tasks = [], isLoading } = useProjectTasks(projectId);
  const updateStatus = useUpdateProjectTaskStatus(projectId);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => onCreateOpenChange(true)}>
          <Plus className="mr-2 h-4 w-4" /> Nueva tarea
        </Button>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Cargando tareas...
        </div>
      ) : tasks.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center">
          <p className="text-sm font-medium text-foreground">
            Aún no hay tareas para este proyecto
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Crea la primera tarea para empezar a hacer seguimiento.
          </p>
          <Button className="mt-4" onClick={() => onCreateOpenChange(true)}>
            <Plus className="mr-2 h-4 w-4" /> Nueva tarea
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead className="w-[100px]">Prioridad</TableHead>
                <TableHead className="w-[160px]">Status</TableHead>
                <TableHead className="w-[200px]">Asignado</TableHead>
                <TableHead className="w-[140px]">Fecha límite</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((t) => {
                const assigned = memberLabel(members, t.assigned_to);
                return (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.title}</TableCell>
                    <TableCell>
                      <Badge className={cn("rounded", PRIORITY_CLASS[t.priority])}>
                        {PRIORITY_LABEL[t.priority]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={t.status}
                        onValueChange={async (v) => {
                          try {
                            await updateStatus.mutateAsync({
                              taskId: t.id,
                              status: v as ProjectTask["status"],
                            });
                          } catch (e: any) {
                            toast.error("No se pudo actualizar", {
                              description: e?.message,
                            });
                          }
                        }}
                      >
                        <SelectTrigger className="h-8 w-full">
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
                    </TableCell>
                    <TableCell>
                      {assigned ? (
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            {assigned.avatar && (
                              <AvatarImage src={assigned.avatar} alt={assigned.name} />
                            )}
                            <AvatarFallback className="text-[10px]">
                              {assigned.initials}
                            </AvatarFallback>
                          </Avatar>
                          <span className="truncate text-sm">{assigned.name}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {t.due_date
                        ? format(parseISO(t.due_date), "dd MMM yyyy", { locale: es })
                        : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <CreateTaskDialog
        open={createOpen}
        onOpenChange={onCreateOpenChange}
        workspaceId={workspaceId}
        projectId={projectId}
        clientId={clientId}
        members={members}
      />
    </div>
  );
}

interface CreateProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  workspaceId: string;
  projectId: string;
  clientId: string;
  members: WorkspaceMember[];
}

function CreateTaskDialog({
  open,
  onOpenChange,
  workspaceId,
  projectId,
  clientId,
  members,
}: CreateProps) {
  const create = useCreateProjectTask(workspaceId, projectId, clientId);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<ProjectTask["priority"]>("p2");
  const [assignedTo, setAssignedTo] = useState<string>("none");
  const [dueDate, setDueDate] = useState<Date | undefined>();

  const reset = () => {
    setTitle("");
    setPriority("p2");
    setAssignedTo("none");
    setDueDate(undefined);
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;
    try {
      await create.mutateAsync({
        title: title.trim(),
        priority,
        assigned_to: assignedTo === "none" ? null : assignedTo,
        due_date: dueDate ? format(dueDate, "yyyy-MM-dd") : null,
      });
      toast.success("Tarea creada");
      onOpenChange(false);
      setTimeout(reset, 200);
    } catch (e: any) {
      toast.error("No se pudo crear la tarea", { description: e?.message });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) setTimeout(reset, 200);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva tarea</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="t-title">Título *</Label>
            <Input
              id="t-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder="Ej: Definir paleta cromática"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Prioridad</Label>
              <Select
                value={priority}
                onValueChange={(v) => setPriority(v as ProjectTask["priority"])}
              >
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
          </div>

          <div className="space-y-1.5">
            <Label>Fecha límite</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start font-normal">
                  {dueDate ? format(dueDate, "PPP", { locale: es }) : "Selecciona fecha"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dueDate}
                  onSelect={setDueDate}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={create.isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!title.trim() || create.isPending}
          >
            {create.isPending ? "Creando..." : "Crear tarea"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
