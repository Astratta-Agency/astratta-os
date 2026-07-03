import { useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell, LabelList, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Task } from "@/hooks/useTasks";
import type { WorkspaceMember } from "@/hooks/useProjects";
import { PRIORITY_LABEL, STATUS_LABEL } from "@/lib/task-labels";
import { PRIORITY_HEX, STATUS_HEX } from "@/lib/task-view-colors";
import { EmptyState } from "@/components/empty-state";

type ChartGroupBy = "status" | "priority" | "assignee" | "project";

interface Props {
  tasks: Task[];
  members: WorkspaceMember[];
  projects?: { id: string; name: string }[];
  showProject?: boolean;
}

export function TaskChartView({ tasks, members, projects = [], showProject = true }: Props) {
  const [groupBy, setGroupBy] = useState<ChartGroupBy>("status");

  const data = useMemo(() => {
    if (tasks.length === 0) return [];
    if (groupBy === "status") {
      const counts: Record<string, number> = {};
      for (const t of tasks) counts[t.status] = (counts[t.status] ?? 0) + 1;
      return (["todo", "doing", "review", "done"] as const)
        .filter((s) => counts[s])
        .map((s) => ({ name: STATUS_LABEL[s], value: counts[s], color: STATUS_HEX[s] }));
    }
    if (groupBy === "priority") {
      const counts: Record<string, number> = {};
      for (const t of tasks) counts[t.priority] = (counts[t.priority] ?? 0) + 1;
      return (["p0", "p1", "p2", "p3"] as const)
        .filter((p) => counts[p])
        .map((p) => ({ name: PRIORITY_LABEL[p], value: counts[p], color: PRIORITY_HEX[p] }));
    }
    if (groupBy === "assignee") {
      const counts = new Map<string, number>();
      for (const t of tasks) {
        const key = t.assigned_to ?? "unassigned";
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      return Array.from(counts.entries())
        .map(([id, value]) => {
          const m = members.find((x) => x.user_id === id);
          return {
            name: id === "unassigned" ? "Sin asignar" : m?.full_name || m?.email || "Miembro",
            value,
            color: "#5140f2",
          };
        })
        .sort((a, b) => b.value - a.value)
        .slice(0, 12);
    }
    // project
    const counts = new Map<string, number>();
    for (const t of tasks) {
      const key = t.project_id ?? "none";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([id, value]) => {
        const p = projects.find((x) => x.id === id);
        return {
          name: id === "none" ? "Sin proyecto" : p?.name ?? "Proyecto",
          value,
          color: "#ff7503",
        };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);
  }, [tasks, groupBy, members, projects]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base">Distribución de tareas</CardTitle>
        <Select value={groupBy} onValueChange={(v) => setGroupBy(v as ChartGroupBy)}>
          <SelectTrigger className="h-8 w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="status">Por status</SelectItem>
            <SelectItem value="priority">Por prioridad</SelectItem>
            <SelectItem value="assignee">Por responsable</SelectItem>
            {showProject && <SelectItem value="project">Por proyecto</SelectItem>}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <EmptyState
            title="Sin datos para graficar"
            description="Cuando haya tareas se mostrará su distribución aquí."
          />
        ) : (
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 24, right: 16, left: 0, bottom: 16 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/60" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  interval={0}
                  angle={data.length > 6 ? -20 : 0}
                  textAnchor={data.length > 6 ? "end" : "middle"}
                  height={data.length > 6 ? 60 : 30}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {data.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                  <LabelList dataKey="value" position="top" fontSize={11} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
