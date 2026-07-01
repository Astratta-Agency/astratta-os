import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import {
  useCreatePayment,
  useFreelancerPayments,
  useMarkPaymentPaid,
  useTimeEntries,
  type TeamMember,
} from "@/hooks/useTeam";

type Props = {
  workspaceId: string;
  members: TeamMember[];
  isOwner: boolean;
};

const today = () => new Date().toISOString().slice(0, 10);
const monthAgo = () => {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 10);
};

function FreelancerBlock({
  freelancer,
  workspaceId,
  isOwner,
}: {
  freelancer: TeamMember;
  workspaceId: string;
  isOwner: boolean;
}) {
  const { data: payments = [] } = useFreelancerPayments(workspaceId, freelancer.user_id);
  const { data: allEntries = [] } = useTimeEntries(workspaceId, { userId: freelancer.user_id });
  const markPaid = useMarkPaymentPaid();
  const [dialogOpen, setDialogOpen] = useState(false);

  const lastPaid = payments.find((p) => p.status === "paid");
  const unpaidEntries = useMemo(() => {
    return allEntries.filter((e) => {
      if (!e.billable) return false;
      if (!lastPaid) return true;
      return e.entry_date > lastPaid.period_end;
    });
  }, [allEntries, lastPaid]);

  const suggestedHours = unpaidEntries.reduce((s, e) => s + Number(e.hours), 0);
  const rate = freelancer.hourly_rate ?? null;
  const suggestedAmount = rate != null ? suggestedHours * rate : null;

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium">{freelancer.full_name || freelancer.email}</p>
          <p className="text-xs text-muted-foreground">
            {rate != null ? `$${rate}/h` : "Sin tarifa configurada"}
          </p>
        </div>
        {isOwner && (
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            Registrar pago
          </Button>
        )}
      </div>

      {suggestedAmount != null && suggestedHours > 0 && (
        <p className="mb-3 text-xs text-muted-foreground">
          Sugerido: <span className="font-medium text-foreground">${suggestedAmount.toFixed(2)}</span>{" "}
          por {suggestedHours.toFixed(2)} h facturables sin pagar
        </p>
      )}

      {payments.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin pagos registrados</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {payments.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2 rounded border border-border px-3 py-2">
              <div>
                <div className="font-medium">${Number(p.amount).toFixed(2)}</div>
                <div className="text-xs text-muted-foreground">
                  {p.period_start} → {p.period_end}
                  {p.note ? ` · ${p.note}` : ""}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={p.status === "paid" ? "default" : "secondary"}>
                  {p.status === "paid" ? "Pagado" : "Pendiente"}
                </Badge>
                {isOwner && p.status === "pending" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => markPaid.mutate({ id: p.id, workspace_id: workspaceId })}
                  >
                    Marcar pagado
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <PaymentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        freelancer={freelancer}
        workspaceId={workspaceId}
        suggestedAmount={suggestedAmount}
      />
    </div>
  );
}

function PaymentDialog({
  open,
  onOpenChange,
  freelancer,
  workspaceId,
  suggestedAmount,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  freelancer: TeamMember;
  workspaceId: string;
  suggestedAmount: number | null;
}) {
  const create = useCreatePayment(workspaceId);
  const [periodStart, setPeriodStart] = useState(monthAgo());
  const [periodEnd, setPeriodEnd] = useState(today());
  const [amount, setAmount] = useState(suggestedAmount != null ? suggestedAmount.toFixed(2) : "");
  const [note, setNote] = useState("");

  const save = async () => {
    if (!amount) {
      toast({ title: "Ingresa un monto", variant: "destructive" });
      return;
    }
    try {
      await create.mutateAsync({
        user_id: freelancer.user_id,
        period_start: periodStart,
        period_end: periodEnd,
        amount: Number(amount),
        note: note || null,
      });
      toast({ title: "Pago registrado" });
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
          <DialogTitle>Registrar pago · {freelancer.full_name || freelancer.email}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Desde</Label>
            <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Hasta</Label>
            <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
          </div>
          <div className="col-span-2 space-y-1">
            <Label>Monto</Label>
            <Input type="number" step="0.01" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="col-span-2 space-y-1">
            <Label>Nota (opcional)</Label>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
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

export function FreelancerPaymentsCard({ workspaceId, members, isOwner }: Props) {
  const freelancers = members.filter((m) => m.role === "collaborator");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pagos a freelancers</CardTitle>
        <CardDescription>Pagos pendientes y realizados por colaborador externo</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {freelancers.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aún no hay freelancers en el equipo — invita uno desde la pestaña Miembros con el rol Freelancer.
          </p>
        ) : (
          freelancers.map((f) => (
            <FreelancerBlock
              key={f.user_id}
              freelancer={f}
              workspaceId={workspaceId}
              isOwner={isOwner}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}
