import { useState } from "react";
import { BarChart3, GanttChart, KanbanSquare, Table2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Task, TaskStatus } from "@/hooks/useTasks";
import type { WorkspaceMember } from "@/hooks/useProjects";
import { TaskTableView, type GroupBy } from "./task-table-view";
import { TaskKanbanView } from "./task-kanban-view";
import { TaskGanttView } from "./task-gantt-view";
import { TaskChartView } from "./task-chart-view";

export type TaskViewType = "table" | "kanban" | "gantt" | "chart";

interface Props {
  tasks: Task[];
  members: WorkspaceMember[];
  projects?: { id: string; name: string }[];
  onOpen: (id: string) => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onCreate?: (defaults: { status?: TaskStatus }) => void;
  /** Hide project-related grouping (used from inside a project detail page) */
  hideProjectGrouping?: boolean;
  defaultView?: TaskViewType;
}

const VIEWS: { key: TaskViewType; label: string; icon: React.ComponentType<any> }[] = [
  { key: "table", label: "Tabla", icon: Table2 },
  { key: "kanban", label: "Kanban", icon: KanbanSquare },
  { key: "gantt", label: "Gantt", icon: GanttChart },
  { key: "chart", label: "Chart", icon: BarChart3 },
];

export function TaskViewsSwitcher({
  tasks,
  members,
  projects = [],
  onOpen,
  onStatusChange,
  onCreate,
  hideProjectGrouping = false,
  defaultView = "table",
}: Props) {
  const [view, setView] = useState<TaskViewType>(defaultView);
  const [groupBy, setGroupBy] = useState<GroupBy>("status");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-0.5 rounded-lg border bg-muted/40 p-0.5">
          {VIEWS.map((v) => {
            const Icon = v.icon;
            const active = view === v.key;
            return (
              <Button
                key={v.key}
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setView(v.key)}
                className={cn(
                  "h-8 gap-1.5 rounded-md px-2.5 text-xs font-medium",
                  active
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {v.label}
              </Button>
            );
          })}
        </div>

        {view === "table" && (
          <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>Agrupar por</span>
            <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
              <SelectTrigger className="h-8 w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="status">Status</SelectItem>
                <SelectItem value="priority">Prioridad</SelectItem>
                <SelectItem value="assignee">Responsable</SelectItem>
                {!hideProjectGrouping && <SelectItem value="project">Proyecto</SelectItem>}
                <SelectItem value="none">Sin agrupar</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {view === "table" && (
        <TaskTableView
          tasks={tasks}
          members={members}
          projects={projects}
          onOpen={onOpen}
          onStatusChange={onStatusChange}
          onCreate={onCreate}
          groupBy={groupBy}
        />
      )}
      {view === "kanban" && (
        <TaskKanbanView
          tasks={tasks}
          members={members}
          onOpen={onOpen}
          onStatusChange={onStatusChange}
          onCreate={onCreate}
        />
      )}
      {view === "gantt" && <TaskGanttView tasks={tasks} onOpen={onOpen} />}
      {view === "chart" && (
        <TaskChartView
          tasks={tasks}
          members={members}
          projects={projects}
          showProject={!hideProjectGrouping}
        />
      )}
    </div>
  );
}
