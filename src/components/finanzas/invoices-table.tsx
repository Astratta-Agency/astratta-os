import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { Receipt } from "lucide-react";
import { InvoiceStatusBadge } from "./invoice-status-badge";
import { formatMoney } from "@/lib/money";
import type { InvoiceRow } from "@/hooks/useInvoices";

interface Props {
  invoices: InvoiceRow[];
  loading?: boolean;
  onSelect: (invoiceId: string) => void;
  showClient?: boolean;
  showProject?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}

export function InvoicesTable({
  invoices,
  loading,
  onSelect,
  showClient = true,
  showProject = true,
  emptyTitle = "Aún no hay facturas",
  emptyDescription = "Crea la primera factura para comenzar a facturar a tus clientes.",
}: Props) {
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (!invoices.length) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        icon={<Receipt className="h-5 w-5" />}
      />
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Número</TableHead>
            {showClient && <TableHead>Cliente</TableHead>}
            {showProject && <TableHead>Proyecto</TableHead>}
            <TableHead>Estado</TableHead>
            <TableHead>Emitida</TableHead>
            <TableHead>Vence</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">Pagado</TableHead>
            <TableHead className="text-right">Saldo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((inv) => {
            const balance = Number(inv.total) - Number(inv.amount_paid);
            return (
              <TableRow
                key={inv.id}
                className="cursor-pointer"
                onClick={() => onSelect(inv.id)}
              >
                <TableCell className="font-mono text-xs">{inv.invoice_number ?? "—"}</TableCell>
                {showClient && (
                  <TableCell
                    className="max-w-[180px] truncate"
                    onClick={(e) => {
                      if (inv.client?.slug) {
                        e.stopPropagation();
                        navigate(`/app/clientes/${inv.client.slug}`);
                      }
                    }}
                  >
                    {inv.client?.name ?? "—"}
                  </TableCell>
                )}
                {showProject && (
                  <TableCell className="max-w-[180px] truncate text-muted-foreground">
                    {inv.project?.name ?? "—"}
                  </TableCell>
                )}
                <TableCell><InvoiceStatusBadge status={inv.status} /></TableCell>
                <TableCell className="text-muted-foreground">{format(new Date(inv.issue_date), "MMM d, yyyy")}</TableCell>
                <TableCell className="text-muted-foreground">{format(new Date(inv.due_date), "MMM d, yyyy")}</TableCell>
                <TableCell className="text-right">{formatMoney(inv.total, inv.currency)}</TableCell>
                <TableCell className="text-right">{formatMoney(inv.amount_paid, inv.currency)}</TableCell>
                <TableCell className="text-right font-medium">{formatMoney(balance, inv.currency)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
