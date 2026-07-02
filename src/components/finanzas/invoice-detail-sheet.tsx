import { useEffect, useState } from "react";
import { format } from "date-fns";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, ExternalLink, MoreVertical, Plus, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  useInvoice,
  useInvoiceItems,
  useInvoicePayments,
  useUpdateInvoiceItems,
  useDeleteInvoice,
  useMarkInvoiceSent,
  useVoidInvoice,
  useSendInvoiceViaStripe,
} from "@/hooks/useInvoices";
import { InvoiceStatusBadge } from "./invoice-status-badge";
import { ClientLogo } from "@/components/clients/client-logo";
import { formatMoney, PAYMENT_METHOD_LABEL } from "@/lib/money";
import { RegisterPaymentDialog } from "./register-payment-dialog";
import { ServiceCatalogSelect } from "@/components/settings/service-catalog-select";
import { SERVICE_PRICE_TYPE_LABEL } from "@/hooks/useWorkspaceSettings";
import { Badge } from "@/components/ui/badge";

interface Props {
  invoiceId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
}

type Item = { id?: string; description: string; quantity: number; unit_price: number };

const STRIPE_ERRORS: Record<string, string> = {
  invoice_has_no_items: "Agrega al menos un ítem antes de enviar por Stripe.",
  invoice_not_sendable: "Esta factura ya está pagada o anulada.",
  client_missing_billing_email: "El cliente no tiene un contacto principal con email. Agrégalo desde la ficha del cliente.",
  stripe_not_configured: "Stripe no está configurado, contacta al owner del workspace.",
};

export function InvoiceDetailSheet({ invoiceId, open, onOpenChange, workspaceId }: Props) {
  const { data: invoice, isLoading } = useInvoice(invoiceId ?? undefined);
  const { data: items = [] } = useInvoiceItems(invoiceId ?? undefined);
  const { data: payments = [] } = useInvoicePayments(invoiceId ?? undefined);

  const updateItems = useUpdateInvoiceItems(invoiceId ?? "");
  const del = useDeleteInvoice();
  const markSent = useMarkInvoiceSent(invoiceId ?? "");
  const voidInvoice = useVoidInvoice(invoiceId ?? "");
  const stripeSend = useSendInvoiceViaStripe();

  const [draftItems, setDraftItems] = useState<Item[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmVoid, setConfirmVoid] = useState(false);
  const [payOpen, setPayOpen] = useState(false);

  useEffect(() => {
    setDraftItems(items.map((i) => ({ id: i.id, description: i.description, quantity: Number(i.quantity), unit_price: Number(i.unit_price) })));
  }, [items]);

  if (!invoiceId) return null;

  const isDraft = invoice?.status === "draft";
  const isPaid = invoice?.status === "paid";
  const isVoid = invoice?.status === "void";
  const canRegisterPayment = invoice && ["sent", "partial", "overdue"].includes(invoice.status);
  const outstanding = invoice ? Number(invoice.total) - Number(invoice.amount_paid) : 0;

  const saveItems = async () => {
    if (!invoiceId) return;
    try {
      await updateItems.mutateAsync(draftItems.map((it) => ({ description: it.description, quantity: it.quantity, unit_price: it.unit_price })));
      toast.success("Ítems actualizados");
    } catch (e: any) {
      toast.error("No se pudo actualizar", { description: e?.message });
    }
  };

  const handleStripeSend = async () => {
    if (!invoiceId) return;
    try {
      await stripeSend.mutateAsync(invoiceId);
      toast.success("Factura enviada por Stripe");
    } catch (e: any) {
      const code = e?.code as string | undefined;
      const msg = (code && STRIPE_ERRORS[code]) || e?.message || "Error al enviar por Stripe";
      toast.error(msg);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
        {isLoading || !invoice ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <>
            <SheetHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {invoice.client && (
                    <ClientLogo
                      name={invoice.client.name}
                      logoUrl={invoice.client.logo_url}
                      brandColor={invoice.client.brand_primary_color}
                      size="md"
                    />
                  )}
                  <div>
                    <SheetTitle className="text-left font-display text-xl">
                      {invoice.invoice_number ?? "Borrador"}
                    </SheetTitle>
                    <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{invoice.client?.name}</span>
                      <InvoiceStatusBadge status={invoice.status} />
                    </div>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {isDraft && (
                      <DropdownMenuItem onClick={() => markSent.mutate()}>Marcar como enviada manualmente</DropdownMenuItem>
                    )}
                    {!isVoid && !isDraft && !isPaid && (
                      <DropdownMenuItem onClick={() => setConfirmVoid(true)}>Anular factura</DropdownMenuItem>
                    )}
                    {isDraft && (
                      <DropdownMenuItem className="text-destructive" onClick={() => setConfirmDelete(true)}>
                        <Trash2 className="h-4 w-4" /> Eliminar
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </SheetHeader>

            <div className="mt-6 space-y-6">
              {/* Meta */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Emitida</div>
                  <div>{format(new Date(invoice.issue_date), "MMM d, yyyy")}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Vence</div>
                  <div>{format(new Date(invoice.due_date), "MMM d, yyyy")}</div>
                </div>
              </div>

              {/* Totals */}
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatMoney(invoice.subtotal, invoice.currency)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Impuestos ({Number(invoice.tax_rate)}%)</span><span>{formatMoney(invoice.tax_amount, invoice.currency)}</span></div>
                  <div className="flex justify-between border-t border-border pt-1 font-semibold"><span>Total</span><span>{formatMoney(invoice.total, invoice.currency)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Pagado</span><span>{formatMoney(invoice.amount_paid, invoice.currency)}</span></div>
                  <div className="flex justify-between font-semibold"><span>Saldo</span><span>{formatMoney(outstanding, invoice.currency)}</span></div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                {isDraft && (
                  <Button onClick={handleStripeSend} disabled={stripeSend.isPending}>
                    <Send className="h-4 w-4" /> {stripeSend.isPending ? "Enviando…" : "Enviar por Stripe"}
                  </Button>
                )}
                {canRegisterPayment && (
                  <Button onClick={() => setPayOpen(true)}>
                    <Plus className="h-4 w-4" /> Registrar pago manual
                  </Button>
                )}
                {invoice.stripe_hosted_invoice_url && (
                  <Button variant="outline" asChild>
                    <a href={invoice.stripe_hosted_invoice_url} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-4 w-4" /> Ver en Stripe
                    </a>
                  </Button>
                )}
                {invoice.stripe_invoice_pdf && (
                  <Button variant="outline" asChild>
                    <a href={invoice.stripe_invoice_pdf} target="_blank" rel="noreferrer">
                      <Download className="h-4 w-4" /> PDF
                    </a>
                  </Button>
                )}
              </div>

              <Separator />

              {/* Line items */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Ítems</h3>
                  {isDraft && (
                    <Button size="sm" variant="outline" onClick={() => setDraftItems((a) => [...a, { description: "", quantity: 1, unit_price: 0 }])}>
                      <Plus className="h-4 w-4" /> Añadir
                    </Button>
                  )}
                </div>
                {isDraft ? (
                  <div className="space-y-2">
                    {draftItems.map((it, i) => (
                      <InvoiceDraftItemRow
                        key={i}
                        workspaceId={workspaceId}
                        item={it}
                        currency={invoice.currency}
                        onChange={(patch) =>
                          setDraftItems((a) => a.map((x, idx) => (idx === i ? { ...x, ...patch } : x)))
                        }
                        onRemove={() => setDraftItems((a) => a.filter((_, idx) => idx !== i))}
                      />
                    ))}
                    <Button size="sm" onClick={saveItems} disabled={updateItems.isPending}>
                      {updateItems.isPending ? "Guardando…" : "Guardar ítems"}
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>Descripción</TableHead>
                      <TableHead className="text-right">Cant.</TableHead>
                      <TableHead className="text-right">Precio</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {items.map((it) => (
                        <TableRow key={it.id}>
                          <TableCell>{it.description}</TableCell>
                          <TableCell className="text-right">{Number(it.quantity)}</TableCell>
                          <TableCell className="text-right">{formatMoney(it.unit_price, invoice.currency)}</TableCell>
                          <TableCell className="text-right">{formatMoney(it.amount, invoice.currency)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>

              {/* Payments history */}
              <div className="space-y-2">
                <h3 className="font-semibold">Historial de pagos</h3>
                {payments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin pagos registrados.</p>
                ) : (
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {payments.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell>{format(new Date(p.paid_at), "MMM d, yyyy")}</TableCell>
                          <TableCell>{PAYMENT_METHOD_LABEL[p.method] ?? p.method}</TableCell>
                          <TableCell className="capitalize">{p.status}</TableCell>
                          <TableCell className="text-right">
                            {formatMoney(p.amount, p.currency)}
                            {p.receipt_url && (
                              <a href={p.receipt_url} target="_blank" rel="noreferrer" className="ml-2 text-xs text-primary hover:underline">recibo</a>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>

              {(invoice.notes || invoice.terms) && (
                <div className="grid gap-3 text-sm">
                  {invoice.notes && <div><Label className="text-muted-foreground">Notas</Label><p className="whitespace-pre-wrap">{invoice.notes}</p></div>}
                  {invoice.terms && <div><Label className="text-muted-foreground">Términos</Label><p className="whitespace-pre-wrap">{invoice.terms}</p></div>}
                </div>
              )}
            </div>

            {canRegisterPayment && (
              <RegisterPaymentDialog
                open={payOpen}
                onOpenChange={setPayOpen}
                workspaceId={workspaceId}
                invoiceId={invoice.id}
                clientId={invoice.client_id}
                outstanding={Math.max(0, outstanding)}
              />
            )}

            <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Eliminar factura</AlertDialogTitle>
                  <AlertDialogDescription>Esta acción no se puede deshacer. Solo se pueden eliminar borradores.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={async () => {
                      try {
                        await del.mutateAsync(invoice.id);
                        toast.success("Factura eliminada");
                        onOpenChange(false);
                      } catch (e: any) {
                        toast.error("No se pudo eliminar", { description: e?.message });
                      }
                    }}
                  >Eliminar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={confirmVoid} onOpenChange={setConfirmVoid}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Anular factura</AlertDialogTitle>
                  <AlertDialogDescription>La factura quedará marcada como anulada y no podrá cobrarse.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={async () => {
                      try {
                        await voidInvoice.mutateAsync();
                        toast.success("Factura anulada");
                      } catch (e: any) {
                        toast.error("No se pudo anular", { description: e?.message });
                      }
                    }}
                  >Anular</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
