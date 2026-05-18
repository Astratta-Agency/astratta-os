import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ProjectKanbanCard } from "@/components/projects/project-kanban-card";
import {
  PROJECT_STATUS_LABEL,
  PROJECT_STATUS_ORDER,
} from "@/components/projects/project-meta";
import type { ProjectRow, WorkspaceMember } from "@/hooks/useProjects";
import type { ProjectStatus } from "@/integrations/supabase/database.types";

interface Props {
  rows: ProjectRow[];
  members: WorkspaceMember[];
  onOpenProject: (p: ProjectRow) => void;
  onStatusChange: (p: ProjectRow, to: ProjectStatus) => void;
}

function Column({
  status,
  projects,
  members,
  onOpenProject,
  isOver,
}: {
  status: ProjectStatus;
  projects: ProjectRow[];
  members: WorkspaceMember[];
  onOpenProject: (p: ProjectRow) => void;
  isOver?: boolean;
}) {
  const { setNodeRef } = useDroppable({ id: `col:${status}` });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-72 shrink-0 snap-start flex-col rounded-lg border bg-muted/30 p-3 transition md:w-auto md:min-w-0",
        isOver && "border-secondary ring-2 ring-secondary/40",
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{PROJECT_STATUS_LABEL[status]}</h3>
        <Badge variant="secondary" className="h-5">
          {projects.length}
        </Badge>
      </div>
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
        {projects.length === 0 && (
          <p className="rounded border border-dashed p-3 text-center text-xs text-muted-foreground">
            Sin proyectos
          </p>
        )}
        {projects.map((p) => (
          <ProjectKanbanCard
            key={p.id}
            project={p}
            members={members}
            onOpen={() => onOpenProject(p)}
          />
        ))}
      </div>
    </div>
  );
}

export function ProjectsKanban({ rows, members, onOpenProject, onStatusChange }: Props) {
  const [activeProject, setActiveProject] = useState<ProjectRow | null>(null);
  const [overCol, setOverCol] = useState<ProjectStatus | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const grouped: Record<ProjectStatus, ProjectRow[]> = {
    planning: [],
    in_progress: [],
    paused: [],
    delivered: [],
    closed: [],
  };
  for (const p of rows) grouped[p.status].push(p);

  const handleStart = (e: DragStartEvent) => {
    const p = (e.active.data.current as any)?.project as ProjectRow | undefined;
    setActiveProject(p ?? null);
  };

  const handleEnd = (e: DragEndEvent) => {
    setActiveProject(null);
    setOverCol(null);
    const overId = e.over?.id;
    if (!overId || typeof overId !== "string" || !overId.startsWith("col:")) return;
    const target = overId.slice(4) as ProjectStatus;
    const p = (e.active.data.current as any)?.project as ProjectRow | undefined;
    if (!p || p.status === target) return;
    onStatusChange(p, target);
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleStart}
      onDragOver={(e) => {
        const id = e.over?.id;
        setOverCol(typeof id === "string" && id.startsWith("col:") ? (id.slice(4) as ProjectStatus) : null);
      }}
      onDragEnd={handleEnd}
      onDragCancel={() => {
        setActiveProject(null);
        setOverCol(null);
      }}
    >
      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-5 md:overflow-visible">
        {PROJECT_STATUS_ORDER.map((s) => (
          <Column
            key={s}
            status={s}
            projects={grouped[s]}
            members={members}
            onOpenProject={onOpenProject}
            isOver={overCol === s}
          />
        ))}
      </div>
      <DragOverlay>
        {activeProject && (
          <div className="w-72 opacity-90">
            <ProjectKanbanCard project={activeProject} members={members} onOpen={() => {}} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
