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
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowUpDown, Download, Loader2, Trash2 } from "lucide-react";
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
import { CHANNEL_CALENDAR_COLOR } from "@/lib/channels";
import { ClientLogo } from "@/components/clients/client-logo";
import { useCalendarClients } from "./calendar-clients-context";

interface Props {
  posts: SocialPostRow[];
  pillarMap: Map<string, ContentPillar>;
  onPostClick: (p: SocialPostRow) => void;
  clientName?: string;
  rangeFrom?: Date;
  rangeTo?: Date;
  /** Si se pasa, habilita la selección de filas y la eliminación en lote. */
  onDeletePosts?: (ids: string[]) => Promise<void>;
}

const PAGE_SIZES = [25, 50, 100];

export function CalendarListView({
  posts,
  pillarMap,
  onPostClick,
  clientName,
  rangeFrom,
  rangeTo,
  onDeletePosts,
}: Props) {
  const [asc, setAsc] = useState(true);
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const selectable = !!onDeletePosts;
  // Vista "Todos los clientes": columna y CSV con el cliente de cada post.
  const clientMap = useCalendarClients();
  const showClient = clientMap !== null;
  const colCount = 6 + (selectable ? 1 : 0) + (showClient ? 1 : 0);

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

  // Solo cuentan las seleccionadas que siguen visibles con los filtros actuales.
  const selected = useMemo(
    () => posts.filter((p) => selectedIds.has(p.id)).map((p) => p.id),
    [posts, selectedIds],
  );
  const pageAllSelected = slice.length > 0 && slice.every((p) => selectedIds.has(p.id));
  const pageSomeSelected = slice.some((p) => selectedIds.has(p.id));

  const togglePage = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      slice.forEach((p) => (checked ? next.add(p.id) : next.delete(p.id)));
      return next;
    });
  };

  const toggleOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const doDelete = async () => {
    if (!onDeletePosts || selected.length === 0) return;
    setDeleting(true);
    try {
      await onDeletePosts(selected);
      setSelectedIds(new Set());
      setDeleteOpen(false);
    } finally {
      setDeleting(false);
    }
  };

  const doExport = () => {
    const fmtDT = (v: string | null) =>
      v ? format(new Date(v), "yyyy-MM-dd HH:mm", { locale: es }) : "";
    const filename = `astratta-calendar-${clientName ?? "cliente"}-${
      rangeFrom ? format(rangeFrom, "yyyy-MM-dd") : ""
    }-to-${rangeTo ? format(rangeTo, "yyyy-MM-dd") : ""}.csv`;

    exportToCsv(filename, sorted, [
      { key: "scheduled_for", header: "Fecha programada", format: (v) => fmtDT(v) },
      {
        key: "client_id",
        header: "Cliente",
        format: (v) => (clientMap ? (clientMap.get(v)?.name ?? "") : (clientName ?? "")),
      },
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
      { key: "title", header: "Título (hook)", format: (v) => v ?? "" },
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
              {selectable && (
                <TableHead className="w-10">
                  <Checkbox
                    checked={pageAllSelected ? true : pageSomeSelected ? "indeterminate" : false}
                    onCheckedChange={(v) => togglePage(v === true)}
                    disabled={slice.length === 0}
                    aria-label="Seleccionar todas las publicaciones de la página"
                  />
                </TableHead>
              )}
              <TableHead className="cursor-pointer" onClick={() => setAsc((v) => !v)}>
                <span className="inline-flex items-center gap-1">
                  Fecha/Hora <ArrowUpDown className="h-3 w-3" />
                </span>
              </TableHead>
              {showClient && <TableHead>Cliente</TableHead>}
              <TableHead>Canal</TableHead>
              <TableHead className="hidden md:table-cell">Formato</TableHead>
              <TableHead>Título</TableHead>
              <TableHead className="hidden md:table-cell">Pilar</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {slice.length === 0 && (
              <TableRow>
                <TableCell colSpan={colCount} className="py-12 text-center text-sm text-muted-foreground">
                  Sin publicaciones
                </TableCell>
              </TableRow>
            )}
            {slice.map((p) => {
              const pillar = p.content_pillar ? pillarMap.get(p.content_pillar) : null;
              const client = clientMap?.get(p.client_id) ?? null;
              return (
                <TableRow
                  key={p.id}
                  className="cursor-pointer"
                  data-state={selectedIds.has(p.id) ? "selected" : undefined}
                  onClick={() => onPostClick(p)}
                >
                  {selectable && (
                    <TableCell className="w-10" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(p.id)}
                        onCheckedChange={(v) => toggleOne(p.id, v === true)}
                        aria-label="Seleccionar publicación"
                      />
                    </TableCell>
                  )}
                  <TableCell className="whitespace-nowrap text-xs">
                    {p.scheduled_for
                      ? format(new Date(p.scheduled_for), "dd MMM HH:mm", { locale: es })
                      : "—"}
                  </TableCell>
                  {showClient && (
                    <TableCell className="max-w-[180px]">
                      {client ? (
                        <span className="flex items-center gap-1.5">
                          <ClientLogo
                            name={client.name}
                            logoUrl={client.logo_url}
                            brandColor={client.brand_primary_color}
                            size="sm"
                            className="h-5 w-5 shrink-0 text-[9px]"
                          />
                          <span className="truncate text-sm">{client.name}</span>
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  )}
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {p.channels.slice(0, 4).map((c) => (
                        <ChannelIcon key={c} channel={c} size="sm" style={{ color: CHANNEL_CALENDAR_COLOR[c] }} />
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
                    {(p.title || p.caption || "").slice(0, 60)}
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
          {selectable && selected.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="h-4 w-4" />
              Eliminar ({selected.length})
            </Button>
          )}
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

      <AlertDialog open={deleteOpen} onOpenChange={(o) => !deleting && setDeleteOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Eliminar {selected.length} {selected.length === 1 ? "publicación" : "publicaciones"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Las publicaciones seleccionadas se eliminarán permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                void doDelete();
              }}
            >
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
