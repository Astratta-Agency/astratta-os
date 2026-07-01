import { format, parseISO, isBefore, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import type { Task, TaskStatus } from "@/hooks/useTasks";
import type { WorkspaceMember } from "@/hooks/useProjects";
import { PRIORITY_CLASS, PRIORITY_LABEL, STATUS_LABEL, TYPE_LABEL } from "@/lib/task-labels";

interface Props {
  tasks: Task[];
  members: WorkspaceMember[];
  onOpen: (id: string) => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
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

export function TasksTable({ tasks, members, onOpen, onStatusChange }: Props) {
  if (tasks.length === 0) {
    return (
      <div className="rounded-lg border border-dashed py-12 text-center">
        <p className="text-sm text-muted-foreground">No hay tareas para mostrar.</p>
      </div>
    );
  }
  const today = startOfDay(new Date());
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Título</TableHead>
            <TableHead className="w-[110px]">Tipo</TableHead>
            <TableHead className="w-[90px]">Prioridad</TableHead>
            <TableHead className="w-[200px]">Asignado</TableHead>
            <TableHead className="w-[140px]">Fecha límite</TableHead>
            <TableHead className="w-[150px]">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((t) => {
            const assigned = memberLabel(members, t.assigned_to);
            const overdue =
              t.due_date && t.status !== "done"
                ? isBefore(parseISO(t.due_date), today)
                : false;
            return (
              <TableRow
                key={t.id}
                className="cursor-pointer"
                onClick={() => onOpen(t.id)}
              >
                <TableCell className="font-medium">
                  <div className="flex flex-col">
                    <span className="truncate">{t.title}</span>
                    {t.tags.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {t.tags.slice(0, 3).map((tag) => (
                          <Badge key={tag} variant="outline" className="text-[10px]">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {TYPE_LABEL[t.type]}
                </TableCell>
                <TableCell>
                  <Badge className={cn("rounded", PRIORITY_CLASS[t.priority])}>
                    {PRIORITY_LABEL[t.priority]}
                  </Badge>
                </TableCell>
                <TableCell>
                  {assigned ? (
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        {assigned.avatar && <AvatarImage src={assigned.avatar} alt={assigned.name} />}
                        <AvatarFallback className="text-[10px]">{assigned.initials}</AvatarFallback>
                      </Avatar>
                      <span className="truncate text-sm">{assigned.name}</span>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  {t.due_date ? (
                    <span className={cn(overdue && "font-medium text-destructive")}>
                      {format(parseISO(t.due_date), "dd MMM yyyy", { locale: es })}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Select
                    value={t.status}
                    onValueChange={(v) => onStatusChange(t.id, v as TaskStatus)}
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
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
