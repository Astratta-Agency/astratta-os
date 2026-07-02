import { useMemo, useState } from "react";
import { addDays } from "date-fns";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/clients/kpi-card";
import { useInvoices } from "@/hooks/useInvoices";
import { InvoicesTable } from "@/components/finanzas/invoices-table";
import { NewInvoiceDialog } from "@/components/finanzas/new-invoice-dialog";
import { InvoiceDetailSheet } from "@/components/finanzas/invoice-detail-sheet";
import { formatMoney } from "@/lib/money";

interface Props {
  workspaceId: string;
  clientId: string;
}

export function ClientFinancesTab({ workspaceId, clientId }: Props) {
  const { data: invoices = [], isLoading } = useInvoices(workspaceId, { clientId });
  const [newOpen, setNewOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const kpis = useMemo(() => {
    const ltv = invoices
      .filter((i) => i.status === "paid")
      .reduce((s, i) => s + Number(i.total), 0);

    const outstanding = invoices
      .filter((i) => i.status === "sent" || i.status === "partial" || i.status === "overdue")
      .reduce((s, i) => s + (Number(i.total) - Number(i.amount_paid)), 0);

    const upcoming = invoices
      .filter((i) => i.status === "sent" || i.status === "partial")
      .map((i) => i.due_date)
      .sort()[0];

    return { ltv, outstanding, upcoming };
  }, [invoices]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <KpiCard label="LTV" value={formatMoney(kpis.ltv)} hint="Suma de facturas pagadas" />
        <KpiCard label="Saldo pendiente" value={formatMoney(kpis.outstanding)} />
        <KpiCard
          label="Próximo vencimiento"
          value={kpis.upcoming ? new Date(kpis.upcoming).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }) : "—"}
        />
      </div>

      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold">Facturas</h2>
        <Button size="sm" onClick={() => setNewOpen(true)}>
          <Plus className="h-4 w-4" /> Nueva factura
        </Button>
      </div>

      <InvoicesTable
        invoices={invoices}
        loading={isLoading}
        onSelect={(id) => setDetailId(id)}
        showClient={false}
        emptyTitle="Este cliente aún no tiene facturas"
        emptyDescription="Crea la primera factura para este cliente."
      />

      <NewInvoiceDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        workspaceId={workspaceId}
        presetClientId={clientId}
        onCreated={(id) => setDetailId(id)}
      />
      <InvoiceDetailSheet
        invoiceId={detailId}
        open={!!detailId}
        onOpenChange={(o) => !o && setDetailId(null)}
        workspaceId={workspaceId}
      />
    </div>
  );
}
