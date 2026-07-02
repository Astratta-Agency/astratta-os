import { useEffect, useMemo, useState } from "react";
import { addDays, format } from "date-fns";
import { Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { useCreateInvoice, useWorkspaceFinanceDefaults } from "@/hooks/useInvoices";
import { useClients } from "@/hooks/useClients";
import { useProjects } from "@/hooks/useProjects";
import { formatMoney } from "@/lib/money";
import { ServiceCatalogSelect } from "@/components/settings/service-catalog-select";
import { SERVICE_PRICE_TYPE_LABEL } from "@/hooks/useWorkspaceSettings";
import { Badge } from "@/components/ui/badge";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string | undefined;
  presetClientId?: string;
  onCreated?: (invoiceId: string) => void;
}

type LineItem = { description: string; quantity: number; unit_price: number };

export function NewInvoiceDialog({ open, onOpenChange, workspaceId, presetClientId, onCreated }: Props) {
  const { data: defaults } = useWorkspaceFinanceDefaults(workspaceId);
  const { data: clients = [] } = useClients(workspaceId, { search: "", status: "all", industry: "all", location: "all" });
  const { data: projects = [] } = useProjects(workspaceId, {});
  const create = useCreateInvoice();

  const [clientId, setClientId] = useState<string>("");
  const [projectId, setProjectId] = useState<string>("");
  const [issueDate, setIssueDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [dueDate, setDueDate] = useState<string>("");
  const [taxRate, setTaxRate] = useState<number>(0);
  const [notes, setNotes] = useState<string>("");
  const [terms, setTerms] = useState<string>("");
  const [items, setItems] = useState<LineItem[]>([{ description: "", quantity: 1, unit_price: 0 }]);

  useEffect(() => {
    if (!open) return;
    setClientId(presetClientId ?? "");
    setProjectId("");
    setIssueDate(format(new Date(), "yyyy-MM-dd"));
    setTaxRate(defaults?.default_tax_rate ?? 0);
    setNotes(defaults?.invoice_notes_default ?? "");
    setTerms("");
    setItems([{ description: "", quantity: 1, unit_price: 0 }]);
    const days = defaults?.default_payment_terms_days ?? 15;
    setDueDate(format(addDays(new Date(), days), "yyyy-MM-dd"));
  }, [open, presetClientId, defaults]);

  const clientProjects = useMemo(
    () => projects.filter((p) => p.client_id === clientId),
    [projects, clientId],
  );

  const subtotal = useMemo(
    () => items.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0),
    [items],
  );
  const taxAmount = subtotal * (Number(taxRate) || 0) / 100;
  const total = subtotal + taxAmount;

  const updateItem = (i: number, patch: Partial<LineItem>) =>
    setItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  const removeItem = (i: number) => setItems((arr) => arr.filter((_, idx) => idx !== i));
  const addItem = () => setItems((arr) => [...arr, { description: "", quantity: 1, unit_price: 0 }]);

  const canSubmit =
    !!workspaceId &&
    !!clientId &&
    !!issueDate &&
    !!dueDate &&
    items.length > 0 &&
    items.every((it) => it.description.trim().length > 0 && it.quantity > 0);

  const submit = async () => {
    if (!canSubmit || !workspaceId) return;
    try {
      const id = await create.mutateAsync({
        workspaceId,
        clientId,
        projectId: projectId || null,
        issueDate,
        dueDate,
        taxRate: Number(taxRate) || 0,
        notes: notes || null,
        terms: terms || null,
        items,
      });
      toast.success("Factura creada como borrador");
      onOpenChange(false);
      onCreated?.(id);
    } catch (e: any) {
      toast.error("No se pudo crear la factura", { description: e?.message });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva factura</DialogTitle>
          <DialogDescription>Se guardará como borrador. Podrás enviarla desde el detalle.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Cliente *</Label>
            <Select value={clientId} onValueChange={(v) => { setClientId(v); setProjectId(""); }}>
              <SelectTrigger><SelectValue placeholder="Seleccionar cliente" /></SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Proyecto (opcional)</Label>
            <Select value={projectId || "none"} onValueChange={(v) => setProjectId(v === "none" ? "" : v)} disabled={!clientId}>
              <SelectTrigger><SelectValue placeholder="Sin proyecto" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin proyecto</SelectItem>
                {clientProjects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Emitida *</Label>
            <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Vence *</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Impuestos (%)</Label>
            <Input type="number" step="0.01" min="0" value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value))} />
          </div>
        </div>

        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between">
            <Label>Ítems</Label>
            <Button size="sm" variant="outline" onClick={addItem}><Plus className="h-4 w-4" /> Añadir ítem</Button>
          </div>
          <div className="space-y-2">
            {items.map((it, i) => {
              const amount = (Number(it.quantity) || 0) * (Number(it.unit_price) || 0);
              return (
                <InvoiceItemRow
                  key={i}
                  workspaceId={workspaceId}
                  item={it}
                  amount={amount}
                  disabled={items.length === 1}
                  onChange={(patch) => updateItem(i, patch)}
                  onRemove={() => removeItem(i)}
                />
              );
            })}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Términos</Label>
            <Textarea rows={2} value={terms} onChange={(e) => setTerms(e.target.value)} />
          </div>
        </div>

        <div className="ml-auto w-full max-w-xs space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatMoney(subtotal)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Impuestos ({taxRate || 0}%)</span><span>{formatMoney(taxAmount)}</span></div>
          <div className="flex justify-between border-t border-border pt-1 font-semibold"><span>Total</span><span>{formatMoney(total)}</span></div>
          <p className="pt-1 text-[10px] text-muted-foreground">Los totales finales los calcula la base de datos al guardar.</p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={!canSubmit || create.isPending}>
            {create.isPending ? "Creando…" : "Crear borrador"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
