import { format, formatDistanceToNowStrict } from "date-fns";
import { es } from "date-fns/locale";
import { useDraggable } from "@dnd-kit/core";
import { ClientLogo } from "@/components/clients/client-logo";
import { Card } from "@/components/ui/card";
import { ProjectTypeChip, isOverdue } from "@/components/projects/project-meta";
import { AssignedAvatars } from "@/components/projects/assigned-avatars";
import { cn } from "@/lib/utils";
import type { ProjectRow, WorkspaceMember } from "@/hooks/useProjects";

interface Props {
  project: ProjectRow;
  members: WorkspaceMember[];
  onOpen: () => void;
}

export function ProjectKanbanCard({ project, members, onOpen }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: project.id,
    data: { project },
  });
  const overdue = isOverdue(project.status, project.end_date);
  const style: React.CSSProperties = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : {};
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <Card
        className={cn(
          "cursor-grab space-y-2 p-3 transition active:cursor-grabbing",
          isDragging && "rotate-2 opacity-70 shadow-lg",
        )}
        onClick={onOpen}
      >
        {project.client && (
          <div className="flex items-center gap-2">
            <ClientLogo
              name={project.client.name}
              logoUrl={project.client.logo_url}
              brandColor={project.client.brand_primary_color}
              size="sm"
            />
            <span className="truncate text-xs text-muted-foreground">{project.client.name}</span>
          </div>
        )}
        <h4 className="line-clamp-2 text-sm font-medium leading-snug">{project.name}</h4>
        <div className="flex items-center justify-between">
          <ProjectTypeChip type={project.type} />
          {project.end_date && (
            <span
              className={cn(
                "text-[11px]",
                overdue ? "font-medium text-destructive" : "text-muted-foreground",
              )}
            >
              {overdue ? "Vencido " : ""}
              {formatDistanceToNowStrict(new Date(project.end_date), {
                addSuffix: true,
                locale: es,
              })}
            </span>
          )}
        </div>
        <div className="pt-1">
          <AssignedAvatars ids={project.assigned_team_ids} members={members} />
        </div>
      </Card>
    </div>
  );
}
