import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { TeamMember, WorkspaceTask } from "@/hooks/useTeam";
import type { ProjectRow } from "@/hooks/useProjects";

type Props = {
  members: TeamMember[];
  projects: ProjectRow[];
  tasks: WorkspaceTask[];
  currentUserId: string | null;
  isOwner: boolean;
};

export function MemberAssignmentsCard({ members, projects, tasks, currentUserId, isOwner }: Props) {
  const visible = isOwner ? members : members.filter((m) => m.user_id === currentUserId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Asignaciones actuales</CardTitle>
        <CardDescription>Proyectos activos y tareas abiertas por miembro</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {visible.length === 0 && (
          <p className="text-sm text-muted-foreground">Sin miembros para mostrar</p>
        )}
        {visible.map((m) => {
          const memberProjects = projects.filter(
            (p) =>
              (p.status === "planning" || p.status === "in_progress") &&
              (p.assigned_team_ids ?? []).includes(m.user_id),
          );
          const memberTasks = tasks.filter((t) => t.assigned_to === m.user_id && t.status !== "done");
          const empty = memberProjects.length === 0 && memberTasks.length === 0;

          return (
            <div key={m.user_id} className="rounded-lg border border-border p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">{m.full_name || m.email || "—"}</p>
                  {m.title && <p className="text-xs text-muted-foreground">{m.title}</p>}
                </div>
              </div>

              {empty ? (
                <p className="text-sm text-muted-foreground">Sin asignaciones activas</p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">Proyectos</p>
                    {memberProjects.length === 0 ? (
                      <p className="text-sm text-muted-foreground">—</p>
                    ) : (
                      <ul className="space-y-1 text-sm">
                        {memberProjects.map((p) => (
                          <li key={p.id} className="flex items-center justify-between gap-2">
                            <span>{p.name}</span>
                            <Badge variant="outline" className="text-xs">
                              {p.client?.name ?? ""}
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">Tareas abiertas</p>
                    {memberTasks.length === 0 ? (
                      <p className="text-sm text-muted-foreground">—</p>
                    ) : (
                      <ul className="space-y-1 text-sm">
                        {memberTasks.map((t) => (
                          <li key={t.id} className="flex items-center justify-between gap-2">
                            <span>{t.title}</span>
                            <Badge variant="secondary" className="text-xs">{t.status}</Badge>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
