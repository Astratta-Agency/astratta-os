import { useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, Download } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
import { toast } from "sonner";
import { ChannelIcon } from "./channel-icon";
import { PillarBadge } from "./pillar-badge";
import { StateBadgePost } from "./state-badge-post";
import type { SocialPostRow, ContentPillar } from "@/hooks/useSocialPosts";
import { POST_STATE_META } from "@/lib/post-states";
import { exportToCsv } from "@/lib/csv-export";

interface Props {
  posts: SocialPostRow[];
  pillarMap: Map<string, ContentPillar>;
  onPostClick: (p: SocialPostRow) => void;
  clientName?: string;
  rangeFrom?: Date;
  rangeTo?: Date;
}

const PAGE_SIZES = [25, 50, 100];

export function CalendarListView({ posts, pillarMap, onPostClick, clientName, rangeFrom, rangeTo }: Props) {
  const [asc, setAsc] = useState(true);
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const sorted = useMemo(() => {
    const arr = [...posts];
    arr.sort((a, b) => {
      const da = a.scheduled_for ? new Date(a.scheduled_for).getTime() : 0;
      const db = b.scheduled_for ? new Date(b.scheduled_for).getTime() : 0;
      return asc ? da - db : db - da;
    });
    return arr;
  }, [posts, asc]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const slice = sorted.slice(page * pageSize, (page + 1) * pageSize);

  const doExport = () => {
    const fmtDT = (v: string | null) =>
      v ? format(new Date(v), "yyyy-MM-dd HH:mm", { locale: es }) : "";
    const filename = `astratta-calendar-${clientName ?? "cliente"}-${
      rangeFrom ? format(rangeFrom, "yyyy-MM-dd") : ""
    }-to-${rangeTo ? format(rangeTo, "yyyy-MM-dd") : ""}.csv`;

    exportToCsv(filename, sorted, [
      { key: "scheduled_for", header: "Fecha programada", format: (v) => fmtDT(v) },
      { key: "client", header: "Cliente", format: () => clientName ?? "" },
      { key: "channels", header: "Canales", format: (v) => (Array.isArray(v) && v.length ? v.join(" | ") : "") },
      { key: "type", header: "Formato", format: (v) => v ?? "" },
      {
        key: "content_pillar",
        header: "Pilar",
        format: (v) => (v ? (pillarMap.get(v)?.name ?? v) : "Sin pilar"),
      },
      {
        key: "status",
        header: "Estado",
        format: (v) => POST_STATE_META[v as keyof typeof POST_STATE_META]?.label ?? v ?? "",
      },
      { key: "caption", header: "Caption", format: (v) => v ?? "" },
      { key: "hashtags", header: "Hashtags", format: (v) => v ?? "" },
      { key: "media_urls", header: "Media URLs", format: (v) => (Array.isArray(v) && v.length ? v.join(" | ") : "") },
      { key: "url", header: "URL del post", format: () => "" },
      { key: "created_by", header: "Creado por", format: () => "" },
      { key: "created_at", header: "Creado en", format: (v) => fmtDT(v) },
    ]);
    toast.success(`Exportado — ${sorted.length} publicaciones`);
  };

  const handleExportClick = () => {
    if (sorted.length > 200) setConfirmOpen(true);
    else doExport();
  };

  const exportDisabled = sorted.length === 0;
  const exportButton = (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleExportClick}
      disabled={exportDisabled}
      aria-label="Exportar publicaciones a CSV"
    >
      <Download className="h-4 w-4" />
      Exportar
    </Button>
  );

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer" onClick={() => setAsc((v) => !v)}>
                <span className="inline-flex items-center gap-1">
                  Fecha/Hora <ArrowUpDown className="h-3 w-3" />
                </span>
              </TableHead>
              <TableHead>Canal</TableHead>
              <TableHead className="hidden md:table-cell">Formato</TableHead>
              <TableHead>Caption</TableHead>
              <TableHead className="hidden md:table-cell">Pilar</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {slice.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                  Sin publicaciones
                </TableCell>
              </TableRow>
            )}
            {slice.map((p) => {
              const pillar = p.content_pillar ? pillarMap.get(p.content_pillar) : null;
              return (
                <TableRow key={p.id} className="cursor-pointer" onClick={() => onPostClick(p)}>
                  <TableCell className="whitespace-nowrap text-xs">
                    {p.scheduled_for
                      ? format(new Date(p.scheduled_for), "dd MMM HH:mm", { locale: es })
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {p.channels.slice(0, 4).map((c) => (
                        <ChannelIcon key={c} channel={c} size="sm" className="text-muted-foreground" />
                      ))}
                      {p.channels.length > 4 && (
                        <span className="text-xs text-muted-foreground">+{p.channels.length - 4}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                    {p.type}
                  </TableCell>
                  <TableCell className="max-w-[300px] truncate text-sm">
                    {(p.caption || p.title || "").slice(0, 60)}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {pillar ? <PillarBadge name={pillar.name} color={pillar.color} /> : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    <StateBadgePost status={p.status} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>Filas por página:</span>
          {PAGE_SIZES.map((s) => (
            <Button
              key={s}
              variant={pageSize === s ? "secondary" : "ghost"}
              size="sm"
              onClick={() => {
                setPageSize(s);
                setPage(0);
              }}
            >
              {s}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            Anterior
          </Button>
          <span>
            {page + 1} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            Siguiente
          </Button>
          {exportDisabled ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={0}>{exportButton}</span>
                </TooltipTrigger>
                <TooltipContent>No hay publicaciones para exportar con los filtros actuales</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            exportButton
          )}
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Exportar {sorted.length} publicaciones</AlertDialogTitle>
            <AlertDialogDescription>
              Esto generará un archivo CSV con todas las publicaciones que coinciden con tus filtros actuales. ¿Continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmOpen(false);
                doExport();
              }}
            >
              Exportar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
