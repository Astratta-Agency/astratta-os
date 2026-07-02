import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { Wallet } from "lucide-react";
import { formatMoney, PAYMENT_METHOD_LABEL } from "@/lib/money";
import type { PaymentRow } from "@/hooks/useInvoices";

interface Props {
  payments: PaymentRow[];
  loading?: boolean;
  showClient?: boolean;
  showInvoice?: boolean;
}

export function PaymentsTable({ payments, loading, showClient = true, showInvoice = true }: Props) {
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }
  if (!payments.length) {
    return (
      <EmptyState
        title="Aún no hay pagos"
        description="Los pagos aparecerán aquí cuando registres cobros manualmente o Stripe confirme un pago."
        icon={<Wallet className="h-5 w-5" />}
      />
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead>
            {showClient && <TableHead>Cliente</TableHead>}
            {showInvoice && <TableHead>Factura</TableHead>}
            <TableHead className="text-right">Monto</TableHead>
            <TableHead>Método</TableHead>
            <TableHead>Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.map((p) => (
            <TableRow key={p.id}>
              <TableCell className="text-muted-foreground">{format(new Date(p.paid_at), "MMM d, yyyy")}</TableCell>
              {showClient && (
                <TableCell
                  className="max-w-[180px] truncate cursor-pointer hover:text-primary"
                  onClick={() => p.client?.slug && navigate(`/app/clientes/${p.client.slug}`)}
                >
                  {p.client?.name ?? "—"}
                </TableCell>
              )}
              {showInvoice && (
                <TableCell className="font-mono text-xs">{p.invoice?.invoice_number ?? "—"}</TableCell>
              )}
              <TableCell className="text-right font-medium">{formatMoney(p.amount, p.currency)}</TableCell>
              <TableCell>{PAYMENT_METHOD_LABEL[p.method] ?? p.method}</TableCell>
              <TableCell className="capitalize text-muted-foreground">{p.status}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
