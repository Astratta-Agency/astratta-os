import { useMemo } from "react";
import { addDays, isBefore, parseISO, startOfDay } from "date-fns";
import type { Task, TaskStatus } from "@/hooks/useTasks";
import type { WorkspaceMember } from "@/hooks/useProjects";
import { TasksTable } from "./tasks-table";

interface Props {
  tasks: Task[];
  members: WorkspaceMember[];
  onOpen: (id: string) => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
}

export function TasksOverdueView({ tasks, members, onOpen, onStatusChange }: Props) {
  const { overdue, atRisk } = useMemo(() => {
    const today = startOfDay(new Date());
    const in2 = addDays(today, 2);
    const overdue: Task[] = [];
    const atRisk: Task[] = [];
    for (const t of tasks) {
      if (t.status === "done" || !t.due_date) continue;
      const d = parseISO(t.due_date);
      if (isBefore(d, today)) overdue.push(t);
      else if (!isBefore(in2, d)) atRisk.push(t);
    }
    const byDate = (a: Task, b: Task) =>
      (a.due_date ?? "").localeCompare(b.due_date ?? "");
    return { overdue: overdue.sort(byDate), atRisk: atRisk.sort(byDate) };
  }, [tasks]);

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-2 text-sm font-semibold text-destructive">
          Vencidas <span className="text-muted-foreground">({overdue.length})</span>
        </h2>
        <TasksTable
          tasks={overdue}
          members={members}
          onOpen={onOpen}
          onStatusChange={onStatusChange}
        />
      </section>
      <section>
        <h2 className="mb-2 text-sm font-semibold text-orange-600 dark:text-orange-400">
          En riesgo (próximas 48h) <span className="text-muted-foreground">({atRisk.length})</span>
        </h2>
        <TasksTable
          tasks={atRisk}
          members={members}
          onOpen={onOpen}
          onStatusChange={onStatusChange}
        />
      </section>
    </div>
  );
}
