import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";
import type { InvoiceStatus } from "@/hooks/useInvoices";
import { INVOICE_STATUS_LABEL, INVOICE_STATUS_ORDER } from "./invoice-status-badge";

interface Props {
  clients: { id: string; name: string }[];
  clientId: string;
  status: InvoiceStatus | "all";
  from: string;
  to: string;
  onChange: (patch: { clientId?: string; status?: InvoiceStatus | "all"; from?: string; to?: string }) => void;
  onClear: () => void;
}

export function InvoicesFiltersBar({ clients, clientId, status, from, to, onChange, onClear }: Props) {
  const hasFilters = !!clientId || status !== "all" || !!from || !!to;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={clientId || "all"} onValueChange={(v) => onChange({ clientId: v === "all" ? "" : v })}>
        <SelectTrigger className="w-[200px]"><SelectValue placeholder="Cliente" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los clientes</SelectItem>
          {clients.map((c) => (
            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={status} onValueChange={(v) => onChange({ status: v as InvoiceStatus | "all" })}>
        <SelectTrigger className="w-[160px]"><SelectValue placeholder="Estado" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los estados</SelectItem>
          {INVOICE_STATUS_ORDER.map((s) => (
            <SelectItem key={s} value={s}>{INVOICE_STATUS_LABEL[s]}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input type="date" value={from} onChange={(e) => onChange({ from: e.target.value })} className="w-[150px]" />
      <span className="text-xs text-muted-foreground">—</span>
      <Input type="date" value={to} onChange={(e) => onChange({ to: e.target.value })} className="w-[150px]" />

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={onClear}>
          <X className="h-4 w-4" /> Limpiar
        </Button>
      )}
    </div>
  );
}
