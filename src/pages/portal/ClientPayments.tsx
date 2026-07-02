import { useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ExternalLink, Wallet, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useInvoices, usePayments } from "@/hooks/useInvoices";
import { formatMoney, PAYMENT_METHOD_LABEL } from "@/lib/money";
import { InvoiceStatusBadge } from "@/components/finanzas/invoice-status-badge";
import type { PortalContext } from "@/hooks/portal/useClientPortalContext";

export default function ClientPayments() {
  const ctx = useOutletContext<PortalContext>();
  const clientId = ctx.client.id;

  const { data: invoices = [], isLoading: iL } = useInvoices(ctx.client.workspace_id, {
    clientId,
  });
  const { data: payments = [], isLoading: pL } = usePayments(ctx.client.workspace_id, {
    clientId,
  });

  const openInvoices = useMemo(
    () =>
      invoices.filter(
        (i) => i.status === "sent" || i.status === "partial" || i.status === "overdue",
      ),
    [invoices],
  );

  const totalBalance = openInvoices.reduce(
    (s, i) => s + (Number(i.total) - Number(i.amount_paid)),
    0,
  );

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Pagos</h1>
          <p className="text-sm text-muted-foreground">
            Consulta tu estado de cuenta y el histórico de pagos.
          </p>
        </div>
        {totalBalance > 0 && (
          <Badge
            className="text-sm"
            style={{ backgroundColor: "var(--portal-primary)", color: "white" }}
          >
            Saldo pendiente: {formatMoney(totalBalance)}
          </Badge>
        )}
      </header>

      {/* Estado de cuenta */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" /> Estado de cuenta
          </CardTitle>
        </CardHeader>
        <CardContent>
          {iL ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : openInvoices.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No tienes facturas pendientes. ¡Todo al día!
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Vence</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Pagado</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {openInvoices.map((i) => {
                    const saldo = Number(i.total) - Number(i.amount_paid);
                    return (
                      <TableRow key={i.id}>
                        <TableCell className="font-mono text-xs">
                          {i.invoice_number ?? "—"}
                        </TableCell>
                        <TableCell>
                          <InvoiceStatusBadge status={i.status} />
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(i.due_date), "d MMM yyyy", { locale: es })}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatMoney(i.total, i.currency)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatMoney(i.amount_paid, i.currency)}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatMoney(saldo, i.currency)}
                        </TableCell>
                        <TableCell className="text-right">
                          {i.stripe_hosted_invoice_url ? (
                            <Button
                              asChild
                              size="sm"
                              style={{
                                backgroundColor: "var(--portal-primary)",
                                color: "white",
                              }}
                            >
                              <a
                                href={i.stripe_hosted_invoice_url}
                                target="_blank"
                                rel="noreferrer noopener"
                              >
                                Pagar ahora <ExternalLink className="ml-1 h-3 w-3" />
                              </a>
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Histórico de pagos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Wallet className="h-4 w-4" /> Histórico de pagos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pL ? (
            <Skeleton className="h-24 w-full" />
          ) : payments.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Aún no hay pagos registrados.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Factura</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {format(new Date(p.paid_at), "d MMM yyyy", { locale: es })}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {p.invoice?.invoice_number ?? "—"}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatMoney(p.amount, p.currency)}
                      </TableCell>
                      <TableCell>{PAYMENT_METHOD_LABEL[p.method] ?? p.method}</TableCell>
                      <TableCell className="capitalize text-muted-foreground">
                        {p.status}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
