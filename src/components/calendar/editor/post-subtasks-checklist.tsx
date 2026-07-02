import { format, parseISO, isBefore, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { Link } from "react-router-dom";
import {
  PenLine,
  Palette,
  Eye,
  CalendarClock,
  Send,
  ExternalLink,
  ListChecks,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  usePostSubtasks,
  SUBTASK_KEY_LABEL,
  type ContentSubtaskKey,
} from "@/hooks/useContentSubtasks";
import { useUpdateTask } from "@/hooks/useTasks";
import { useWorkspaceMembers } from "@/hooks/useProjects";
import type { PostStatus } from "@/lib/post-states";

interface Props {
  postId: string;
  workspaceId: string;
  postStatus: PostStatus;
}

const SUBTASK_ICON: Record<ContentSubtaskKey, React.ComponentType<{ className?: string }>> = {
  copywriting: PenLine,
  design: Palette,
  review: Eye,
  scheduling: CalendarClock,
  publishing: Send,
};

export function PostSubtasksChecklist({ postId, workspaceId, postStatus }: Props) {
  const { data: subtasks = [], isLoading } = usePostSubtasks(postId);
  const { data: members = [] } = useWorkspaceMembers(workspaceId);
  const updateTask = useUpdateTask();

  const today = startOfDay(new Date());

  if (postStatus === "idea") {
    return (
      <div className="rounded-lg border border-dashed bg-muted/30 p-4">
        <div className="flex items-start gap-2">
          <ListChecks className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">Subtareas de contenido</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Las subtareas (copywriting, diseño, revisión, programación, publicación) se generan
              automáticamente cuando pases este post a Borrador.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <ListChecks className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold">Subtareas de contenido</span>
        <span className="ml-auto text-xs text-muted-foreground">
          {subtasks.filter((s) => s.status === "done").length}/{subtasks.length} listas
        </span>
      </div>
      <div className="p-2">
        {isLoading ? (
          <div className="space-y-2 p-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : subtasks.length === 0 ? (
          <p className="p-3 text-center text-xs text-muted-foreground">
            No hay subtareas asociadas a este post todavía.
          </p>
        ) : (
          <ul className="divide-y">
            {subtasks.map((t) => {
              const key = t.content_subtask_key as ContentSubtaskKey;
              const Icon = SUBTASK_ICON[key] ?? ListChecks;
              const done = t.status === "done";
              const overdue =
                !done && t.due_date && isBefore(parseISO(t.due_date), today);
              const member = members.find((m) => m.user_id === t.assigned_to);
              const assignedName = member?.full_name || member?.email || null;
              const initials = (assignedName || "")
                .split(/\s+/)
                .map((w) => w[0])
                .filter(Boolean)
                .slice(0, 2)
                .join("")
                .toUpperCase();

              const handleToggle = async (checked: boolean) => {
                try {
                  await updateTask.mutateAsync({
                    id: t.id,
                    patch: { status: checked ? "done" : "todo" },
                  });
                } catch (e: any) {
                  toast.error("No se pudo actualizar", { description: e?.message });
                }
              };

              return (
                <li key={t.id} className="flex items-center gap-2 px-2 py-2">
                  <Checkbox
                    checked={done}
                    onCheckedChange={(v) => handleToggle(!!v)}
                    aria-label="Completar"
                  />
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "truncate text-sm",
                          done && "text-muted-foreground line-through",
                        )}
                      >
                        {t.title}
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        {SUBTASK_KEY_LABEL[key] ?? key}
                      </Badge>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                      {assignedName ? (
                        <span className="inline-flex items-center gap-1">
                          <Avatar className="h-4 w-4">
                            {member?.avatar_url && (
                              <AvatarImage src={member.avatar_url} alt={assignedName} />
                            )}
                            <AvatarFallback className="text-[8px]">{initials}</AvatarFallback>
                          </Avatar>
                          {assignedName}
                        </span>
                      ) : (
                        <span>Sin asignar</span>
                      )}
                      {t.due_date && (
                        <Badge
                          variant={overdue ? "destructive" : "secondary"}
                          className="text-[10px]"
                        >
                          {format(parseISO(t.due_date), "d MMM", { locale: es })}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Link
                    to={`/app/tareas?task=${t.id}`}
                    className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Abrir tarea"
                    title="Abrir tarea"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
