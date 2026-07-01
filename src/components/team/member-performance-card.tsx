import { useState } from "react";
import { Star } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "@/hooks/use-toast";
import { useCreateReview, useMemberReviews, type TeamMember, type WorkspaceTask } from "@/hooks/useTeam";

type Props = {
  workspaceId: string;
  members: TeamMember[];
  tasks: WorkspaceTask[];
  isOwner: boolean;
};

function computeOnTime(userId: string, tasks: WorkspaceTask[]): number | null {
  const done = tasks.filter((t) => t.assigned_to === userId && t.status === "done" && t.due_date);
  if (done.length === 0) return null;
  const onTime = done.filter((t) => {
    const doneAt = new Date(t.updated_at);
    const due = new Date(t.due_date as string);
    return doneAt <= due;
  }).length;
  return Math.round((onTime / done.length) * 100);
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${i <= rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`}
        />
      ))}
    </div>
  );
}

function MemberBlock({
  member,
  tasks,
  workspaceId,
  isOwner,
}: {
  member: TeamMember;
  tasks: WorkspaceTask[];
  workspaceId: string;
  isOwner: boolean;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: reviews = [] } = useMemberReviews(member.user_id);
  const onTime = computeOnTime(member.user_id, tasks);
  const latest = reviews[0];

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="font-medium text-foreground">{member.full_name || member.email}</p>
          {member.title && <p className="text-xs text-muted-foreground">{member.title}</p>}
        </div>
        {isOwner && (
          <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
            Nueva review
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <p className="mb-1 text-xs uppercase text-muted-foreground">% a tiempo</p>
          <p className="text-2xl font-semibold">
            {onTime === null ? <span className="text-base text-muted-foreground">Sin datos aún</span> : `${onTime}%`}
          </p>
        </div>
        <div>
          <p className="mb-1 text-xs uppercase text-muted-foreground">Última review</p>
          {latest ? (
            <div className="space-y-1">
              <Stars rating={latest.quality_rating} />
              <p className="text-xs text-muted-foreground">
                {new Date(latest.period).toLocaleDateString("es", { month: "long", year: "numeric" })}
              </p>
              {latest.note && <p className="text-sm">{latest.note}</p>}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sin datos aún</p>
          )}
        </div>
      </div>

      {reviews.length > 1 && (
        <Collapsible className="mt-3">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm">Ver historial ({reviews.length - 1})</Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 space-y-2">
            {reviews.slice(1).map((r) => (
              <div key={r.id} className="rounded border border-border p-2 text-sm">
                <div className="flex items-center justify-between">
                  <Stars rating={r.quality_rating} />
                  <span className="text-xs text-muted-foreground">
                    {new Date(r.period).toLocaleDateString("es", { month: "long", year: "numeric" })}
                  </span>
                </div>
                {r.note && <p className="mt-1 text-muted-foreground">{r.note}</p>}
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}

      <ReviewDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        member={member}
        workspaceId={workspaceId}
      />
    </div>
  );
}

function ReviewDialog({
  open,
  onOpenChange,
  member,
  workspaceId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  member: TeamMember;
  workspaceId: string;
}) {
  const create = useCreateReview(workspaceId);
  const now = new Date();
  const defaultPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [periodMonth, setPeriodMonth] = useState(defaultPeriod);
  const [rating, setRating] = useState(4);
  const [note, setNote] = useState("");

  const save = async () => {
    try {
      await create.mutateAsync({
        user_id: member.user_id,
        period: `${periodMonth}-01`,
        quality_rating: rating,
        note: note || null,
      });
      toast({ title: "Review guardada" });
      onOpenChange(false);
      setNote("");
    } catch (e: any) {
      toast({ title: "Error", description: e?.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva review · {member.full_name || member.email}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Período (mes)</Label>
            <Input type="month" value={periodMonth} onChange={(e) => setPeriodMonth(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Calidad</Label>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <button key={i} type="button" onClick={() => setRating(i)}>
                  <Star
                    className={`h-6 w-6 ${i <= rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`}
                  />
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <Label>Nota (opcional)</Label>
            <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={create.isPending}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function MemberPerformanceCard({ workspaceId, members, tasks, isOwner }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Performance</CardTitle>
        <CardDescription>
          % a tiempo (basado en tareas completadas con fecha límite) y reviews de calidad mensuales.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {members.length === 0 && <p className="text-sm text-muted-foreground">Sin miembros</p>}
        {members.map((m) => (
          <MemberBlock
            key={m.user_id}
            member={m}
            tasks={tasks}
            workspaceId={workspaceId}
            isOwner={isOwner}
          />
        ))}
      </CardContent>
    </Card>
  );
}
