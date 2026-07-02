import { useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Download, Eye, FileText, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { toast } from "@/hooks/use-toast";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { useClients } from "@/hooks/useClients";
import { useWorkspaceDetail } from "@/hooks/useWorkspaceSettings";
import {
  formatPeriod,
  useClientReports,
  useDeleteClientReport,
  useGenerateClientReportPdf,
  type ClientReportRow,
} from "@/hooks/useClientReports";
import { ReportFormDialog } from "./report-form-dialog";
import { ReportDetailDialog } from "./report-detail-dialog";

export function ClientReportsTab() {
  const { workspace } = useActiveWorkspace();
  const workspaceId = workspace?.id;
  const clients = useClients(workspaceId, {});
  const [clientId, setClientId] = useState<string>("");
  const currentClient = useMemo(
    () => (clients.data ?? []).find((c) => c.id === clientId) ?? null,
    [clients.data, clientId],
  );
  const reports = useClientReports(clientId || undefined);
  const wsDetail = useWorkspaceDetail(workspaceId);

  const [formOpen, setFormOpen] = useState(false);
  const [editReport, setEditReport] = useState<ClientReportRow | null>(null);
  const [detailReport, setDetailReport] = useState<ClientReportRow | null>(null);
  const [deleting, setDeleting] = useState<ClientReportRow | null>(null);

  const del = useDeleteClientReport(clientId || undefined);
  const genPdf = useGenerateClientReportPdf(clientId || undefined);

  const openNew = () => {
    setEditReport(null);
    setFormOpen(true);
  };
  const openEdit = (r: ClientReportRow) => {
    setEditReport(r);
    setFormOpen(true);
  };

  const handleGeneratePdf = async (r: ClientReportRow) => {
    if (!currentClient || !workspace) return;
    try {
      toast({ title: "Generando PDF…" });
      await genPdf.mutateAsync({
        report: r,
        clientName: currentClient.name,
        workspace: {
          name: workspace.name,
          primary_color: wsDetail.data?.primary_color ?? "#5140f2",
          secondary_color: wsDetail.data?.secondary_color ?? "#ff7503",
          logo_url: wsDetail.data?.logo_url ?? null,
        },
      });
      toast({ title: "PDF generado y subido" });
    } catch (e: any) {
      toast({ title: "Error", description: e?.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      {/* Cliente picker */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cliente</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="min-w-[280px] flex-1">
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccioná un cliente" />
              </SelectTrigger>
              <SelectContent>
                {(clients.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={openNew} disabled={!clientId}>
            <Plus className="h-4 w-4" /> Nuevo reporte
          </Button>
        </CardContent>
      </Card>

      {/* Reportes */}
      {!clientId ? (
        <EmptyState
          title="Elegí un cliente"
          description="Seleccioná un cliente arriba para ver o crear sus reportes mensuales."
        />
      ) : reports.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (reports.data?.length ?? 0) === 0 ? (
        <EmptyState
          title="Aún no hay reportes"
          description={`Creá el primer reporte mensual para ${currentClient?.name ?? "este cliente"}.`}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" /> Reportes de {currentClient?.name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border rounded-md border border-border">
              {reports.data!.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium text-foreground">{r.title}</span>
                      <Badge variant={r.status === "published" ? "default" : "secondary"}>
                        {r.status === "published" ? "Publicado" : "Borrador"}
                      </Badge>
                      {r.pdf_public_url && (
                        <Badge variant="outline" className="text-xs">PDF listo</Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatPeriod(r.period_month, r.period_year)}</span>
                      <span>·</span>
                      <span>
                        {format(new Date(r.updated_at), "d MMM yyyy", { locale: es })}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDetailReport(r)}
                    >
                      <Eye className="h-4 w-4" /> Ver
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openEdit(r)}>
                      <Pencil className="h-4 w-4" /> Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleGeneratePdf(r)}
                      disabled={genPdf.isPending}
                    >
                      <Download className="h-4 w-4" />{" "}
                      {r.pdf_public_url ? "Regenerar PDF" : "Generar PDF"}
                    </Button>
                    {r.pdf_public_url && (
                      <Button asChild variant="ghost" size="sm">
                        <a
                          href={r.pdf_public_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Download className="h-4 w-4" /> PDF
                        </a>
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setDeleting(r)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {workspaceId && clientId && currentClient && (
        <ReportFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          workspaceId={workspaceId}
          clientId={clientId}
          clientName={currentClient.name}
          report={editReport}
        />
      )}

      <ReportDetailDialog
        open={!!detailReport}
        onOpenChange={(o) => !o && setDetailReport(null)}
        report={detailReport}
        clientName={currentClient?.name ?? ""}
      />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar reporte</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará el reporte "{deleting?.title}" y su PDF asociado (si existe). Esta acción
              no se puede deshacer.
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
                    pdf_storage_path: deleting.pdf_storage_path,
                  });
                  toast({ title: "Reporte eliminado" });
                  setDeleting(null);
                } catch (e: any) {
                  toast({ title: "Error", description: e?.message, variant: "destructive" });
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
