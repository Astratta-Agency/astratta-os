import { toast } from "sonner";
import { Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTeamMembers } from "@/hooks/useTeam";
import {
  useClientContentRoles,
  useUpsertClientContentRole,
  CONTENT_ROLE_LABEL,
  type ContentRoleKey,
} from "@/hooks/useContentSubtasks";

interface Props {
  clientId: string;
  workspaceId: string;
}

const ROLES: ContentRoleKey[] = ["content_creator", "designer"];

export function ClientContentRolesCard({ clientId, workspaceId }: Props) {
  const { data: members = [], isLoading: membersLoading } = useTeamMembers(workspaceId);
  const { data: roles = [], isLoading: rolesLoading } = useClientContentRoles(clientId);
  const upsert = useUpsertClientContentRole(clientId);

  const currentFor = (role: ContentRoleKey) =>
    roles.find((r) => r.role_key === role)?.member_user_id ?? "__none__";

  const handleChange = async (role: ContentRoleKey, value: string) => {
    try {
      await upsert.mutateAsync({
        role_key: role,
        member_user_id: value === "__none__" ? null : value,
      });
      toast.success("Responsable actualizado");
    } catch (e: any) {
      toast.error("No se pudo guardar", { description: e?.message });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4 text-muted-foreground" />
          Responsables de contenido
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Al crear un borrador de post para este cliente, las subtareas se asignan automáticamente
          a estas personas según la plantilla.
        </p>
        {membersLoading || rolesLoading ? (
          <>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </>
        ) : (
          ROLES.map((role) => (
            <div key={role} className="space-y-1.5">
              <Label className="text-xs">{CONTENT_ROLE_LABEL[role]}</Label>
              <Select
                value={currentFor(role)}
                onValueChange={(v) => handleChange(role, v)}
                disabled={upsert.isPending}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin asignar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin asignar</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      {m.full_name || m.email || "Miembro"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
