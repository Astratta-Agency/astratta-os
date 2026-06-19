import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { WorkspaceMember } from "@/hooks/useProjects";

interface Props {
  memberIds: string[];
  allMembers: WorkspaceMember[];
}

export function ProjectTeamCard({ memberIds, allMembers }: Props) {
  const team = allMembers.filter((m) => memberIds.includes(m.user_id));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Equipo asignado</CardTitle>
      </CardHeader>
      <CardContent>
        {team.length === 0 ? (
          <div className="py-6 text-center">
            <div className="text-2xl text-muted-foreground">—</div>
            <div className="mt-1 text-sm text-muted-foreground">Sin equipo asignado</div>
          </div>
        ) : (
          <ul className="space-y-3">
            {team.map((m) => {
              const name = m.full_name || m.email || "Miembro";
              const initials = name
                .split(/\s+/)
                .map((w) => w[0])
                .filter(Boolean)
                .slice(0, 2)
                .join("")
                .toUpperCase();
              return (
                <li key={m.user_id} className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    {m.avatar_url && <AvatarImage src={m.avatar_url} alt={name} />}
                    <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-foreground">{name}</div>
                    <div className="truncate text-xs text-muted-foreground capitalize">
                      {m.role}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
