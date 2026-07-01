import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import {
  useCreateTimeEntry,
  useDeleteTimeEntry,
  useTimeEntries,
  type TeamMember,
} from "@/hooks/useTeam";

type Props = {
  workspaceId: string;
  members: TeamMember[];
  currentUserId: string | null;
  isOwner: boolean;
};

function startOfWeek(d: Date) {
  const day = d.getDay(); // 0=Sun
  const diff = (day === 0 ? -6 : 1) - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

export function TimeTrackingCard({ workspaceId, members, currentUserId, isOwner }: Props) {
  const [fromDate, setFromDate] = useState(daysAgo(30));
  const [toDate, setToDate] = useState(today());
  const [filterUser, setFilterUser] = useState<string>(isOwner ? "all" : currentUserId ?? "all");

  const { data: entries = [] } = useTimeEntries(workspaceId, {
    userId: filterUser === "all" ? undefined : filterUser,
    from: fromDate,
    to: toDate,
  });

  // Weekly progress uses this week's entries for each visible member
  const { data: weekEntries = [] } = useTimeEntries(workspaceId, {
    from: startOfWeek(new Date()).toISOString().slice(0, 10),
    to: today(),
  });

  const create = useCreateTimeEntry();
  const del = useDeleteTimeEntry();

  const [entryUserId, setEntryUserId] = useState(currentUserId ?? "");
  const [entryDate, setEntryDate] = useState(today());
  const [hours, setHours] = useState("");
  const [note, setNote] = useState("");
  const [billable, setBillable] = useState(true);

  const visibleMembers = isOwner ? members : members.filter((m) => m.user_id === currentUserId);

  const weekTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of weekEntries) {
      map.set(e.user_id, (map.get(e.user_id) ?? 0) + Number(e.hours));
    }
    return map;
  }, [weekEntries]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entryUserId || !hours) {
      toast({ title: "Completa horas y miembro", variant: "destructive" });
      return;
    }
    try {
      await create.mutateAsync({
        workspace_id: workspaceId,
        user_id: entryUserId,
        entry_date: entryDate,
        hours: Number(hours),
        billable,
        note: note || null,
      });
      toast({ title: "Horas registradas" });
      setHours("");
      setNote("");
    } catch (err: any) {
      toast({ title: "Error", description: err?.message, variant: "destructive" });
    }
  };

  const canDelete = (userId: string) => isOwner || userId === currentUserId;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Time tracking</CardTitle>
        <CardDescription>Registro manual de horas trabajadas</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Weekly progress */}
        <div className="space-y-3">
          <p className="text-sm font-medium">Capacidad de esta semana</p>
          {visibleMembers.map((m) => {
            const used = weekTotals.get(m.user_id) ?? 0;
            const cap = m.weekly_capacity_hours ?? 40;
            const pct = cap > 0 ? Math.min(100, (used / cap) * 100) : 0;
            return (
              <div key={m.user_id} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span>{m.full_name || m.email}</span>
                  <span className="text-muted-foreground">
                    {used.toFixed(1)}/{cap} h
                  </span>
                </div>
                <Progress value={pct} />
              </div>
            );
          })}
        </div>

        {/* Entry form */}
        <form onSubmit={submit} className="grid gap-3 rounded-lg border border-border p-4 md:grid-cols-6">
          {isOwner && (
            <div className="space-y-1 md:col-span-2">
              <Label>Miembro</Label>
              <Select value={entryUserId} onValueChange={setEntryUserId}>
                <SelectTrigger><SelectValue placeholder="Miembro" /></SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      {m.full_name || m.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1">
            <Label>Fecha</Label>
            <Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Horas</Label>
            <Input
              type="number"
              step="0.25"
              min={0}
              placeholder="2.5"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>Nota</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej: post carrusel cliente X" />
          </div>
          <div className="flex items-end gap-2 md:col-span-6">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={billable} onCheckedChange={(v) => setBillable(!!v)} />
              Facturable
            </label>
            <Button type="submit" className="ml-auto" disabled={create.isPending}>
              Registrar
            </Button>
          </div>
        </form>

        {/* Filter + table */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            {isOwner && (
              <div className="space-y-1">
                <Label>Miembro</Label>
                <Select value={filterUser} onValueChange={setFilterUser}>
                  <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {members.map((m) => (
                      <SelectItem key={m.user_id} value={m.user_id}>
                        {m.full_name || m.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1">
              <Label>Desde</Label>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Hasta</Label>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Miembro</TableHead>
                <TableHead>Cliente / Proyecto</TableHead>
                <TableHead>Horas</TableHead>
                <TableHead>Facturable</TableHead>
                <TableHead>Nota</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                    Sin entradas en este rango
                  </TableCell>
                </TableRow>
              )}
              {entries.map((e) => {
                const member = members.find((m) => m.user_id === e.user_id);
                return (
                  <TableRow key={e.id}>
                    <TableCell>{e.entry_date}</TableCell>
                    <TableCell>{member?.full_name || member?.email || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {[e.client?.name, e.project?.name].filter(Boolean).join(" · ") || "—"}
                    </TableCell>
                    <TableCell>{Number(e.hours).toFixed(2)}</TableCell>
                    <TableCell>{e.billable ? "Sí" : "No"}</TableCell>
                    <TableCell className="max-w-xs truncate">{e.note || "—"}</TableCell>
                    <TableCell>
                      {canDelete(e.user_id) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            del.mutate({ id: e.id, workspace_id: workspaceId })
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
