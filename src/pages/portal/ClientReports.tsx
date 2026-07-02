import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Download, Eye, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { PortalContext } from "@/hooks/portal/useClientPortalContext";
import {
  formatPeriod,
  usePublishedClientReports,
  type ClientReportRow,
} from "@/hooks/useClientReports";
import { ReportDetailDialog } from "@/components/analytics/report-detail-dialog";

export default function ClientReports() {
  const ctx = useOutletContext<PortalContext>();
  const clientId = ctx.client.id;
  const reports = usePublishedClientReports(clientId);
  const [detail, setDetail] = useState<ClientReportRow | null>(null);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold">Reportes</h1>
        <p className="text-sm text-muted-foreground">
          Reportes mensuales de performance preparados por tu agencia.
        </p>
      </header>

      {reports.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (reports.data?.length ?? 0) === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div
              className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full"
              style={{ backgroundColor: "color-mix(in srgb, var(--portal-primary) 12%, transparent)" }}
            >
              <FileText className="h-6 w-6" style={{ color: "var(--portal-primary)" }} />
            </div>
            <p className="font-medium text-foreground">Aún no hay reportes publicados</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Cuando tu agencia publique el primer reporte, lo verás acá.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {reports.data!.map((r) => (
            <Card key={r.id}>
              <CardHeader>
                <CardTitle
                  className="flex items-center gap-2 text-base"
                  style={{ color: "var(--portal-primary)" }}
                >
                  <FileText className="h-4 w-4" /> {r.title}
                </CardTitle>
                <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground">
                  <Badge variant="secondary" className="text-xs">
                    {formatPeriod(r.period_month, r.period_year)}
                  </Badge>
                  {r.published_at && (
                    <span>
                      Publicado {format(new Date(r.published_at), "d MMM yyyy", { locale: es })}
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {r.executive_summary && (
                  <p className="line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">
                    {r.executive_summary}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => setDetail(r)}
                    style={{ backgroundColor: "var(--portal-primary)", color: "white" }}
                  >
                    <Eye className="h-4 w-4" /> Ver detalle
                  </Button>
                  {r.pdf_public_url && (
                    <Button asChild variant="outline" size="sm">
                      <a href={r.pdf_public_url} target="_blank" rel="noopener noreferrer">
                        <Download className="h-4 w-4" /> Descargar PDF
                      </a>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ReportDetailDialog
        open={!!detail}
        onOpenChange={(o) => !o && setDetail(null)}
        report={detail}
        clientName={ctx.client.name}
        portalStyle
      />
    </div>
  );
}
