import { useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Download,
  ExternalLink,
  FileSignature,
  FileText,
  Files,
  Plus,
  Receipt,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { EmptyState } from "@/components/empty-state";
import { formatMoney } from "@/lib/money";
import { toast } from "@/hooks/use-toast";
import {
  CONTRACT_STATUS_LABEL,
  PROPOSAL_TYPE_LABEL,
} from "@/hooks/useContracts";
import { useInvoices } from "@/hooks/useInvoices";
import {
  DOCUMENT_CATEGORY_LABEL,
  formatFileSize,
  useClientDocuments,
  useDeleteClientDocument,
  useSignedContractsForClient,
  useSignedProposalsForClient,
  type ClientDocumentRow,
} from "@/hooks/useClientDocuments";
import { UploadDocumentDialog } from "./upload-document-dialog";

interface Props {
  clientId: string;
  workspaceId: string;
}

export function ClientDocumentsTab({ clientId, workspaceId }: Props) {
  const contracts = useSignedContractsForClient(clientId);
  const proposals = useSignedProposalsForClient(clientId);
  const paidInvoices = useInvoices(workspaceId, { clientId, statuses: ["paid"] });
  const docs = useClientDocuments(clientId);
  const del = useDeleteClientDocument(clientId);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleting, setDeleting] = useState<ClientDocumentRow | null>(null);

  return (
    <div className="space-y-6">
      {/* Contratos firmados */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileSignature className="h-4 w-4" /> Contratos firmados
          </CardTitle>
        </CardHeader>
        <CardContent>
          {contracts.isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : (contracts.data?.length ?? 0) === 0 ? (
            <EmptyState
              title="Aún no hay contratos firmados"
              description="Cuando envíes y firmes un contrato aparecerá aquí."
            />
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border">
              {contracts.data!.map((c) => {
                const signedDate = c.countersigned_at ?? c.client_signed_at;
                return (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
                  >
                    <div className="min-w-0 space-y-1">
                      <Link
                        to={`/app/contratos/${c.id}`}
                        className="truncate font-medium text-foreground hover:underline"
                      >
                        {c.title}
                      </Link>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="secondary" className="text-xs">
                          {PROPOSAL_TYPE_LABEL[c.service_type as keyof typeof PROPOSAL_TYPE_LABEL] ??
                            c.service_type}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {CONTRACT_STATUS_LABEL[c.status as keyof typeof CONTRACT_STATUS_LABEL] ??
                            c.status}
                        </Badge>
                        {signedDate && (
                          <span>
                            Firmado{" "}
                            {format(new Date(signedDate), "d MMM yyyy", { locale: es })}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button asChild variant="outline" size="sm">
                      <Link to={`/app/contratos/${c.id}`}>
                        Ver
                      </Link>
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Propuestas firmadas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" /> Propuestas firmadas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {proposals.isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : (proposals.data?.length ?? 0) === 0 ? (
            <EmptyState
              title="Aún no hay propuestas firmadas"
              description="Al firmar una propuesta desde el módulo de Ventas aparecerá aquí."
            />
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border">
              {proposals.data!.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
                >
                  <div className="min-w-0 space-y-1">
                    <span className="truncate font-medium text-foreground">{p.title}</span>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="secondary" className="text-xs">
                        {PROPOSAL_TYPE_LABEL[p.type as keyof typeof PROPOSAL_TYPE_LABEL] ?? p.type}
                      </Badge>
                      {p.signed_at && (
                        <span>
                          Firmada {format(new Date(p.signed_at), "d MMM yyyy", { locale: es })}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <a
                      href={`/propuestas/${p.public_token}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Ver <ExternalLink className="ml-1 h-3 w-3" />
                    </a>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Facturas pagadas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="h-4 w-4" /> Facturas pagadas / Recibos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {paidInvoices.isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : (paidInvoices.data?.length ?? 0) === 0 ? (
            <EmptyState
              title="Aún no hay facturas pagadas"
              description="Los recibos de pago aparecerán aquí cuando el cliente salde una factura."
            />
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border">
              {paidInvoices.data!.map((i) => (
                <li
                  key={i.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">
                        {i.invoice_number ?? "—"}
                      </span>
                      <span className="font-medium text-foreground">
                        {formatMoney(i.total, i.currency)}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {i.paid_at
                        ? `Pagada ${format(new Date(i.paid_at), "d MMM yyyy", { locale: es })}`
                        : format(new Date(i.issue_date), "d MMM yyyy", { locale: es })}
                    </div>
                  </div>
                  {i.stripe_invoice_pdf ? (
                    <Button asChild variant="outline" size="sm">
                      <a href={i.stripe_invoice_pdf} target="_blank" rel="noopener noreferrer">
                        <Download className="h-4 w-4" /> PDF
                      </a>
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Pago registrado manualmente
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Archivos subidos */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Files className="h-4 w-4" /> Archivos subidos
          </CardTitle>
          <Button size="sm" onClick={() => setUploadOpen(true)}>
            <Plus className="h-4 w-4" /> Subir documento
          </Button>
        </CardHeader>
        <CardContent>
          {docs.isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : (docs.data?.length ?? 0) === 0 ? (
            <EmptyState
              title="Aún no hay archivos subidos"
              description="Subí briefs, kickoffs, brand guidelines u otros PDFs para tenerlos centralizados."
            />
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border">
              {docs.data!.map((d) => (
                <li
                  key={d.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
                >
                  <div className="min-w-0 space-y-1">
                    <a
                      href={d.public_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate font-medium text-foreground hover:underline"
                    >
                      {d.title}
                    </a>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="secondary" className="text-xs">
                        {DOCUMENT_CATEGORY_LABEL[d.category]}
                      </Badge>
                      <span>{formatFileSize(d.size_bytes)}</span>
                      <span>·</span>
                      <span>{format(new Date(d.created_at), "d MMM yyyy", { locale: es })}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button asChild variant="outline" size="sm">
                      <a href={d.public_url} target="_blank" rel="noopener noreferrer">
                        <Download className="h-4 w-4" /> Descargar
                      </a>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setDeleting(d)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <UploadDocumentDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        clientId={clientId}
        workspaceId={workspaceId}
      />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar documento</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará "{deleting?.title}" del almacenamiento. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!deleting) return;
                try {
                  await del.mutateAsync({
                    id: deleting.id,
                    storage_path: deleting.storage_path,
                  });
                  toast({ title: "Documento eliminado" });
                  setDeleting(null);
                } catch (e: any) {
                  toast({
                    title: "Error",
                    description: e?.message,
                    variant: "destructive",
                  });
                }
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
