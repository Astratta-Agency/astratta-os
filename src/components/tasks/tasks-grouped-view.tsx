import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Task, TaskStatus } from "@/hooks/useTasks";
import type { WorkspaceMember } from "@/hooks/useProjects";
import { TasksTable } from "./tasks-table";

interface Props {
  tasks: Task[];
  groupBy: "project" | "client";
  groups: { id: string; name: string }[];
  members: WorkspaceMember[];
  onOpen: (id: string) => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
}

export function TasksGroupedView({
  tasks,
  groupBy,
  groups,
  members,
  onOpen,
  onStatusChange,
}: Props) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const grouped = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const g of groups) map.set(g.id, []);
    map.set("__none__", []);
    for (const t of tasks) {
      const key = groupBy === "project" ? t.project_id : t.client_id;
      const k = key ?? "__none__";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(t);
    }
    const result = Array.from(map.entries())
      .filter(([, arr]) => arr.length > 0)
      .map(([id, arr]) => {
        const name =
          id === "__none__"
            ? groupBy === "project"
              ? "Sin proyecto"
              : "Sin cliente"
            : groups.find((g) => g.id === id)?.name || "Sin nombre";
        return { id, name, tasks: arr };
      });
    result.sort((a, b) => {
      if (a.id === "__none__") return 1;
      if (b.id === "__none__") return -1;
      return a.name.localeCompare(b.name);
    });
    return result;
  }, [tasks, groupBy, groups]);

  if (grouped.length === 0) {
    return (
      <div className="rounded-lg border border-dashed py-12 text-center">
        <p className="text-sm text-muted-foreground">No hay tareas para mostrar.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {grouped.map((g) => {
        const isCollapsed = !!collapsed[g.id];
        return (
          <div key={g.id} className="space-y-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 font-semibold"
              onClick={() => setCollapsed((c) => ({ ...c, [g.id]: !c[g.id] }))}
            >
              {isCollapsed ? (
                <ChevronRight className="mr-1 h-4 w-4" />
              ) : (
                <ChevronDown className="mr-1 h-4 w-4" />
              )}
              {g.name}
              <span className="ml-2 text-xs text-muted-foreground">({g.tasks.length})</span>
            </Button>
            {!isCollapsed && (
              <TasksTable
                tasks={g.tasks}
                members={members}
                onOpen={onOpen}
                onStatusChange={onStatusChange}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
