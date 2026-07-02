import { Badge } from "@/components/ui/badge";
import type { InvoiceStatus } from "@/hooks/useInvoices";

const map: Record<InvoiceStatus, { label: string; className: string }> = {
  draft: { label: "Borrador", className: "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30" },
  sent: { label: "Enviada", className: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30" },
  partial: { label: "Pago parcial", className: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30" },
  paid: { label: "Pagada", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30" },
  overdue: { label: "Vencida", className: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30" },
  void: { label: "Anulada", className: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border-zinc-500/30" },
};

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const m = map[status];
  return (
    <Badge variant="outline" className={m.className}>
      {m.label}
    </Badge>
  );
}

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  draft: "Borrador",
  sent: "Enviada",
  partial: "Pago parcial",
  paid: "Pagada",
  overdue: "Vencida",
  void: "Anulada",
};

export const INVOICE_STATUS_ORDER: InvoiceStatus[] = ["draft", "sent", "partial", "overdue", "paid", "void"];
