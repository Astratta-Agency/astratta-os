import { useState } from "react";
import { Pencil } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { useUpdateTeamMember, type TeamMember } from "@/hooks/useTeam";
import { InviteTeamMemberDialog } from "./invite-team-member-dialog";

const roleLabel = (r: string) =>
  r === "owner" ? "Propietario" : r === "team_member" ? "Equipo" : r === "collaborator" ? "Freelancer" : r;

const roleVariant = (r: string): "default" | "secondary" | "outline" =>
  r === "owner" ? "default" : r === "collaborator" ? "outline" : "secondary";

function initials(name: string | null, email: string | null) {
  const s = (name || email || "?").trim();
  const parts = s.split(/\s+/);
  return (parts[0]?.[0] ?? "?").toUpperCase() + (parts[1]?.[0]?.toUpperCase() ?? "");
}

type Props = {
  workspaceId: string;
  members: TeamMember[];
  isOwner: boolean;
};

export function TeamMembersTable({ workspaceId, members, isOwner }: Props) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editing, setEditing] = useState<TeamMember | null>(null);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle>Miembros</CardTitle>
          <CardDescription>Personas con acceso a este workspace</CardDescription>
        </div>
        {isOwner && <Button onClick={() => setInviteOpen(true)}>Invitar miembro</Button>}
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Persona</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Título</TableHead>
              <TableHead>Capacidad</TableHead>
              <TableHead>Tarifa</TableHead>
              {isOwner && <TableHead className="w-10"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.length === 0 && (
              <TableRow>
                <TableCell colSpan={isOwner ? 6 : 5} className="text-center text-sm text-muted-foreground">
                  Aún no hay miembros
                </TableCell>
              </TableRow>
            )}
            {members.map((m) => (
              <TableRow key={m.user_id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={m.avatar_url ?? undefined} />
                      <AvatarFallback>{initials(m.full_name, m.email)}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">{m.full_name || m.email || "—"}</span>
                      {m.email && <span className="text-xs text-muted-foreground">{m.email}</span>}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={roleVariant(m.role)}>{roleLabel(m.role)}</Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{m.title || "—"}</TableCell>
                <TableCell className="text-sm">{m.weekly_capacity_hours ?? "—"} h/sem</TableCell>
                <TableCell className="text-sm">
                  {m.role === "collaborator" && isOwner && m.hourly_rate != null ? `$${m.hourly_rate}/h` : "—"}
                </TableCell>
                {isOwner && (
                  <TableCell>
                    {m.role !== "owner" && (
                      <Button variant="ghost" size="icon" onClick={() => setEditing(m)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <InviteTeamMemberDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        workspaceId={workspaceId}
      />
      <EditMemberDialog
        member={editing}
        workspaceId={workspaceId}
        onOpenChange={(v) => !v && setEditing(null)}
      />
    </Card>
  );
}

function EditMemberDialog({
  member,
  workspaceId,
  onOpenChange,
}: {
  member: TeamMember | null;
  workspaceId: string;
  onOpenChange: (v: boolean) => void;
}) {
  const update = useUpdateTeamMember(workspaceId);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [title, setTitle] = useState("");
  const [role, setRole] = useState<string>("team_member");
  const [cap, setCap] = useState<string>("40");
  const [rate, setRate] = useState<string>("");
  const [hydratedFor, setHydratedFor] = useState<string | null>(null);

  const open = !!member;
  if (member && hydratedFor !== member.user_id) {
    const fn = (member.full_name ?? "").trim();
    const idx = fn.indexOf(" ");
    setFirstName(idx === -1 ? fn : fn.slice(0, idx));
    setLastName(idx === -1 ? "" : fn.slice(idx + 1).trim());
    setTitle(member.title ?? "");
    setRole(member.role);
    setCap(String(member.weekly_capacity_hours ?? 40));
    setRate(member.hourly_rate != null ? String(member.hourly_rate) : "");
    setHydratedFor(member.user_id);
  }

  const handleClose = (v: boolean) => {
    if (!v) {
      setFirstName("");
      setLastName("");
      setTitle("");
      setRole("team_member");
      setCap("40");
      setRate("");
      setHydratedFor(null);
    }
    onOpenChange(v);
  };

  const save = async () => {
    if (!member) return;
    const trimmedFirst = firstName.trim();
    if (!trimmedFirst) {
      toast({ title: "Nombre requerido", variant: "destructive" });
      return;
    }
    const newFullName = [trimmedFirst, lastName.trim()].filter(Boolean).join(" ");
    try {
      await update.mutateAsync({
        user_id: member.user_id,
        patch: {
          title: title || null,
          role: role as any,
          weekly_capacity_hours: cap ? Number(cap) : null,
          hourly_rate: rate ? Number(rate) : null,
        },
        full_name: newFullName !== (member.full_name ?? "") ? newFullName : undefined,
      });
      toast({ title: "Miembro actualizado" });
      handleClose(false);
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "No se pudo guardar", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar miembro</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Nombre *</Label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Apellido</Label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Community Manager" />
          </div>
          <div className="space-y-1">
            <Label>Rol</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="team_member">Equipo interno</SelectItem>
                <SelectItem value="collaborator">Freelancer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Capacidad semanal (horas)</Label>
            <Input type="number" min={0} max={168} value={cap} onChange={(e) => setCap(e.target.value)} />
          </div>
          {role === "collaborator" && (
            <div className="space-y-1">
              <Label>Tarifa por hora</Label>
              <Input type="number" min={0} value={rate} onChange={(e) => setRate(e.target.value)} placeholder="Ej: 25" />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>Cancelar</Button>
          <Button onClick={save} disabled={update.isPending}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
