import { useEffect, useState } from "react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useRegisterPayment } from "@/hooks/useInvoices";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  invoiceId: string;
  clientId: string;
  outstanding: number;
}

type Method = "ach" | "check" | "cash" | "wire" | "other";

export function RegisterPaymentDialog({ open, onOpenChange, workspaceId, invoiceId, clientId, outstanding }: Props) {
  const register = useRegisterPayment();
  const [amount, setAmount] = useState<number>(outstanding);
  const [method, setMethod] = useState<Method>("wire");
  const [paidAt, setPaidAt] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [notes, setNotes] = useState<string>("");

  useEffect(() => {
    if (open) {
      setAmount(outstanding);
      setMethod("wire");
      setPaidAt(format(new Date(), "yyyy-MM-dd"));
      setNotes("");
    }
  }, [open, outstanding]);

  const submit = async () => {
    if (!amount || amount <= 0) {
      toast.error("El monto debe ser mayor que cero");
      return;
    }
    try {
      await register.mutateAsync({
        workspaceId,
        clientId,
        invoiceId,
        amount,
        method,
        paidAt: new Date(paidAt).toISOString(),
        notes: notes || null,
      });
      toast.success("Pago registrado");
      onOpenChange(false);
    } catch (e: any) {
      toast.error("No se pudo registrar el pago", { description: e?.message });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar pago manual</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Monto (USD)</Label>
            <Input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          </div>
          <div className="space-y-2">
            <Label>Método</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as Method)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ach">ACH</SelectItem>
                <SelectItem value="check">Cheque</SelectItem>
                <SelectItem value="cash">Efectivo</SelectItem>
                <SelectItem value="wire">Transferencia</SelectItem>
                <SelectItem value="other">Otro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Fecha</Label>
            <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={register.isPending}>
            {register.isPending ? "Guardando…" : "Registrar pago"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
