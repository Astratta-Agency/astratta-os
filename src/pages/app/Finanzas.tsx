import { useMemo, useState } from "react";
import { startOfMonth, endOfMonth } from "date-fns";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { useClients } from "@/hooks/useClients";
import { useInvoices, usePayments, type InvoiceStatus } from "@/hooks/useInvoices";
import { KpiCard } from "@/components/clients/kpi-card";
import { InvoicesFiltersBar } from "@/components/finanzas/invoices-filters-bar";
import { InvoicesTable } from "@/components/finanzas/invoices-table";
import { PaymentsTable } from "@/components/finanzas/payments-table";
import { NewInvoiceDialog } from "@/components/finanzas/new-invoice-dialog";
import { InvoiceDetailSheet } from "@/components/finanzas/invoice-detail-sheet";
import { GastosTab } from "@/components/finanzas/gastos-tab";
import { FinanceReportsTab } from "@/components/finanzas/finance-reports-tab";
import { formatMoney } from "@/lib/money";

export default function Finanzas() {
  const { workspace } = useActiveWorkspace();
  const workspaceId = workspace?.id;

  const [clientId, setClientId] = useState("");
  const [status, setStatus] = useState<InvoiceStatus | "all">("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const { data: clients = [] } = useClients(workspaceId, {
    search: "",
    status: "all",
    industry: "all",
    location: "all",
  });
  const clientOptions = useMemo(() => clients.map((c) => ({ id: c.id, name: c.name })), [clients]);

  const { data: invoices = [], isLoading } = useInvoices(workspaceId, {
    clientId: clientId || undefined,
    statuses: status === "all" ? undefined : [status],
    from: from || undefined,
    to: to || undefined,
  });

  // KPI data — unfiltered "all invoices" is heavier; reuse the filtered list is not ideal.
  // Simpler heuristic: use `invoices` when no filters, else pull an unfiltered second query.
  const { data: allInvoices = [] } = useInvoices(workspaceId, {});
  const { data: allPayments = [] } = usePayments(workspaceId, {});

  const kpis = useMemo(() => {
    const now = new Date();
    const monthStart = startOfMonth(now).toISOString().slice(0, 10);
    const monthEnd = endOfMonth(now).toISOString().slice(0, 10);
    const inMonth = (d: string) => d >= monthStart && d <= monthEnd;

    const billedMonth = allInvoices
      .filter((i) => i.status !== "void" && inMonth(i.issue_date))
      .reduce((s, i) => s + Number(i.total), 0);

    const pending = allInvoices
      .filter((i) => i.status === "sent" || i.status === "partial")
      .reduce((s, i) => s + (Number(i.total) - Number(i.amount_paid)), 0);

    const overdue = allInvoices
      .filter((i) => i.status === "overdue")
      .reduce((s, i) => s + (Number(i.total) - Number(i.amount_paid)), 0);

    const collectedMonth = allPayments
      .filter((p) => p.status === "succeeded" && p.paid_at.slice(0, 10) >= monthStart && p.paid_at.slice(0, 10) <= monthEnd)
      .reduce((s, p) => s + Number(p.amount), 0);

    return { billedMonth, pending, overdue, collectedMonth };
  }, [allInvoices, allPayments]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Finanzas</h1>
          <p className="text-sm text-muted-foreground">Facturas, pagos y estado de cobros</p>
        </div>
        <Button onClick={() => setNewOpen(true)}>
          <Plus className="h-4 w-4" /> Nueva factura
        </Button>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Facturado este mes" value={formatMoney(kpis.billedMonth)} />
        <KpiCard label="Pendiente de cobro" value={formatMoney(kpis.pending)} />
        <KpiCard label="Vencido" value={formatMoney(kpis.overdue)} />
        <KpiCard label="Cobrado este mes" value={formatMoney(kpis.collectedMonth)} />
      </div>

      <Tabs defaultValue="facturas" className="space-y-4">
        <TabsList>
          <TabsTrigger value="facturas">Facturas</TabsTrigger>
          <TabsTrigger value="pagos">Pagos</TabsTrigger>
          <TabsTrigger value="gastos">Gastos</TabsTrigger>
          <TabsTrigger value="reportes">Reportes financieros</TabsTrigger>
        </TabsList>

        <TabsContent value="facturas" className="space-y-4">
          <InvoicesFiltersBar
            clients={clientOptions}
            clientId={clientId}
            status={status}
            from={from}
            to={to}
            onChange={(p) => {
              if (p.clientId !== undefined) setClientId(p.clientId);
              if (p.status !== undefined) setStatus(p.status);
              if (p.from !== undefined) setFrom(p.from);
              if (p.to !== undefined) setTo(p.to);
            }}
            onClear={() => {
              setClientId("");
              setStatus("all");
              setFrom("");
              setTo("");
            }}
          />
          <InvoicesTable
            invoices={invoices}
            loading={isLoading}
            onSelect={(id) => setDetailId(id)}
          />
        </TabsContent>

        <TabsContent value="pagos">
          <PaymentsTable payments={allPayments} />
        </TabsContent>

        <TabsContent value="gastos">
          <GastosTab />
        </TabsContent>

        <TabsContent value="reportes">
          <FinanceReportsTab />
        </TabsContent>
      </Tabs>

      {workspaceId && (
        <NewInvoiceDialog
          open={newOpen}
          onOpenChange={setNewOpen}
          workspaceId={workspaceId}
          onCreated={(id) => setDetailId(id)}
        />
      )}
      {workspaceId && (
        <InvoiceDetailSheet
          invoiceId={detailId}
          open={!!detailId}
          onOpenChange={(o) => !o && setDetailId(null)}
          workspaceId={workspaceId}
        />
      )}
    </div>
  );
}
