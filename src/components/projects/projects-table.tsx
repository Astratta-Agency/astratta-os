import { useMemo, useState } from "react";
import { format } from "date-fns";
import { MoreHorizontal, ArrowUpDown } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ClientLogo } from "@/components/clients/client-logo";
import { AssignedAvatars } from "@/components/projects/assigned-avatars";
import {
  PROJECT_STATUS_LABEL,
  PROJECT_STATUS_ORDER,
  ProjectStatusBadge,
  ProjectTypeChip,
  computeProgress,
  isOverdue,
} from "@/components/projects/project-meta";
import type { ProjectRow } from "@/hooks/useProjects";
import type { WorkspaceMember } from "@/hooks/useProjects";
import type { ProjectStatus } from "@/integrations/supabase/database.types";

type SortKey = "name" | "client" | "type" | "status" | "start_date" | "end_date";

interface Props {
  rows: ProjectRow[];
  members: WorkspaceMember[];
  loading?: boolean;
  onOpenProject: (p: ProjectRow) => void;
  onChangeStatus: (p: ProjectRow, status: ProjectStatus) => void;
  onArchive: (p: ProjectRow) => void;
  onClearFilters?: () => void;
}

const fmt = (d: string | null) => (d ? format(new Date(d), "dd MMM yyyy") : "—");

export function ProjectsTable({
  rows,
  members,
  loading,
  onOpenProject,
  onChangeStatus,
  onArchive,
  onClearFilters,
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("end_date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const va: any =
        sortKey === "client" ? a.client?.name ?? "" : (a as any)[sortKey] ?? "";
      const vb: any =
        sortKey === "client" ? b.client?.name ?? "" : (b as any)[sortKey] ?? "";
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = sorted.slice((page - 1) * pageSize, page * pageSize);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(k);
      setSortDir("asc");
    }
  };

  const Th = ({ k, children }: { k: SortKey; children: React.ReactNode }) => (
    <TableHead>
      <button
        type="button"
        onClick={() => toggleSort(k)}
        className="inline-flex items-center gap-1 hover:text-foreground"
      >
        {children}
        <ArrowUpDown className="h-3 w-3 opacity-50" />
      </button>
    </TableHead>
  );

  if (!loading && rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-10 text-center">
        <p className="text-sm text-muted-foreground">No hay proyectos con esos filtros</p>
        {onClearFilters && (
          <Button variant="link" onClick={onClearFilters} className="mt-1">
            Limpiar filtros
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <Th k="name">Nombre</Th>
              <Th k="client">Cliente</Th>
              <Th k="type">Tipo</Th>
              <Th k="status">Status</Th>
              <Th k="start_date">Inicio</Th>
              <Th k="end_date">Deadline</Th>
              <TableHead>Equipo</TableHead>
              <TableHead>Progreso</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && rows.length === 0 && (
              <>
                {Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={9}>
                      <div className="h-6 animate-pulse rounded bg-muted" />
                    </TableCell>
                  </TableRow>
                ))}
              </>
            )}
            {current.map((p) => {
              const overdue = isOverdue(p.status, p.end_date);
              const progress = computeProgress(p.status, p.start_date, p.end_date);
              return (
                <TableRow key={p.id} className="group">
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => onOpenProject(p)}
                      className="font-medium hover:text-primary"
                    >
                      {p.name}
                    </button>
                  </TableCell>
                  <TableCell>
                    {p.client && (
                      <Link
                        to={`/app/clientes/${p.client.slug}`}
                        className="inline-flex items-center gap-2 hover:text-primary"
                      >
                        <ClientLogo
                          name={p.client.name}
                          logoUrl={p.client.logo_url}
                          brandColor={p.client.brand_primary_color}
                          size="sm"
                        />
                        <span className="text-sm">{p.client.name}</span>
                      </Link>
                    )}
                  </TableCell>
                  <TableCell>
                    <ProjectTypeChip type={p.type} />
                  </TableCell>
                  <TableCell>
                    <ProjectStatusBadge status={p.status} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {fmt(p.start_date)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-sm",
                      overdue ? "font-medium text-destructive" : "text-muted-foreground",
                    )}
                  >
                    {fmt(p.end_date)}
                  </TableCell>
                  <TableCell>
                    <AssignedAvatars ids={p.assigned_team_ids} members={members} />
                  </TableCell>
                  <TableCell className="min-w-[120px]">
                    {progress === null ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Progress value={progress} className="h-1.5 flex-1" />
                        <span className="w-8 text-right text-xs tabular-nums text-muted-foreground">
                          {progress}%
                        </span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => onOpenProject(p)}>Abrir</DropdownMenuItem>
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>Cambiar status</DropdownMenuSubTrigger>
                          <DropdownMenuSubContent>
                            {PROJECT_STATUS_ORDER.map((s) => (
                              <DropdownMenuItem
                                key={s}
                                disabled={s === p.status}
                                onClick={() => onChangeStatus(p, s)}
                              >
                                {PROJECT_STATUS_LABEL[s]}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => onArchive(p)}>
                          Archivar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>Filas por página</span>
          <Select
            value={String(pageSize)}
            onValueChange={(v) => {
              setPageSize(Number(v));
              setPage(1);
            }}
          >
            <SelectTrigger className="h-8 w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>
            Anterior
          </Button>
          <span>
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            Siguiente
          </Button>
        </div>
      </div>
    </div>
  );
}
