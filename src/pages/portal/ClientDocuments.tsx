import { Link, useOutletContext } from "react-router-dom";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Download,
  ExternalLink,
  FileSignature,
  FileText,
  Files,
  Receipt,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/money";
import {
  CONTRACT_STATUS_LABEL,
  PROPOSAL_TYPE_LABEL,
} from "@/hooks/useContracts";
import { useInvoices } from "@/hooks/useInvoices";
import {
  DOCUMENT_CATEGORY_LABEL,
  formatFileSize,
  useClientDocuments,
  useSignedContractsForClient,
  useSignedProposalsForClient,
} from "@/hooks/useClientDocuments";
import type { PortalContext } from "@/hooks/portal/useClientPortalContext";

export default function ClientDocuments() {
  const ctx = useOutletContext<PortalContext>();
  const clientId = ctx.client.id;
  const workspaceId = ctx.client.workspace_id;
  const slug = ctx.client.slug;

  const contracts = useSignedContractsForClient(clientId);
  const proposals = useSignedProposalsForClient(clientId);
  const paidInvoices = useInvoices(workspaceId, { clientId, statuses: ["paid"] });
  const docs = useClientDocuments(clientId);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-2xl font-bold">Documentos</h1>
        <p className="text-sm text-muted-foreground">
          Contratos, propuestas, recibos y archivos compartidos por tu agencia.
        </p>
      </header>

      {/* Contratos firmados */}
      <Card>
        <CardHeader>
          <CardTitle
            className="flex items-center gap-2 text-base"
            style={{ color: "var(--portal-primary)" }}
          >
            <FileSignature className="h-4 w-4" /> Contratos firmados
          </CardTitle>
        </CardHeader>
        <CardContent>
          {contracts.isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : (contracts.data?.length ?? 0) === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Aún no hay contratos firmados.
            </p>
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
                      <span className="truncate font-medium text-foreground">{c.title}</span>
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
                    <Button
                      asChild
                      size="sm"
                      style={{ backgroundColor: "var(--portal-primary)", color: "white" }}
                    >
                      <a
                        href={`/contratos/${c.public_token}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Ver <ExternalLink className="ml-1 h-3 w-3" />
                      </a>
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
          <CardTitle
            className="flex items-center gap-2 text-base"
            style={{ color: "var(--portal-primary)" }}
          >
            <FileText className="h-4 w-4" /> Propuestas firmadas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {proposals.isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : (proposals.data?.length ?? 0) === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Aún no hay propuestas firmadas.
            </p>
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
                  <Button
                    asChild
                    size="sm"
                    style={{ backgroundColor: "var(--portal-primary)", color: "white" }}
                  >
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

      {/* Facturas pagadas / recibos */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle
            className="flex items-center gap-2 text-base"
            style={{ color: "var(--portal-primary)" }}
          >
            <Receipt className="h-4 w-4" /> Recibos de pago
          </CardTitle>
          <Button asChild variant="link" size="sm" style={{ color: "var(--portal-primary)" }}>
            <Link to={`/portal/${slug}/pagos`}>Ver todo en Pagos →</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {paidInvoices.isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : (paidInvoices.data?.length ?? 0) === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Aún no hay facturas pagadas.
            </p>
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

      {/* Archivos subidos por la agencia */}
      <Card>
        <CardHeader>
          <CardTitle
            className="flex items-center gap-2 text-base"
            style={{ color: "var(--portal-primary)" }}
          >
            <Files className="h-4 w-4" /> Archivos subidos por tu agencia
          </CardTitle>
        </CardHeader>
        <CardContent>
          {docs.isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : (docs.data?.length ?? 0) === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Tu agencia aún no ha compartido archivos.
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border">
              {docs.data!.map((d) => (
                <li
                  key={d.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
                >
                  <div className="min-w-0 space-y-1">
                    <span className="truncate font-medium text-foreground">{d.title}</span>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="secondary" className="text-xs">
                        {DOCUMENT_CATEGORY_LABEL[d.category]}
                      </Badge>
                      <span>{formatFileSize(d.size_bytes)}</span>
                      <span>·</span>
                      <span>{format(new Date(d.created_at), "d MMM yyyy", { locale: es })}</span>
                    </div>
                  </div>
                  <Button
                    asChild
                    size="sm"
                    style={{ backgroundColor: "var(--portal-primary)", color: "white" }}
                  >
                    <a href={d.public_url} target="_blank" rel="noopener noreferrer">
                      <Download className="h-4 w-4" /> Descargar
                    </a>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
