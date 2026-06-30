import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowDown, ArrowUp, ArrowUpDown, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { ClientLogo } from "./client-logo";
import { HealthScoreBar } from "./health-score-bar";
import { StatusBadge } from "./status-badge";
import { ServicesChips } from "./services-chips";
import { EditClientDialog } from "./edit-client-dialog";
import { type ClientRow, useArchiveClient, useDeleteClient } from "@/hooks/useClients";

type SortKey = "name" | "industry" | "health" | "status";

interface Props {
  clients: ClientRow[];
}

export function ClientsTable({ clients }: Props) {
  const navigate = useNavigate();
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [perPage, setPerPage] = useState(25);
  const [page, setPage] = useState(1);
  const [editingClient, setEditingClient] = useState<ClientRow | null>(null);
  const [deletingClient, setDeletingClient] = useState<ClientRow | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const archive = useArchiveClient();
  const del = useDeleteClient();

  const sorted = useMemo(() => {
    const arr = [...clients];
    arr.sort((a, b) => {
      let av: string | number = "";
      let bv: string | number = "";
      if (sortKey === "name") {
        av = a.name.toLowerCase();
        bv = b.name.toLowerCase();
      } else if (sortKey === "industry") {
        av = (a.industry ?? "").toLowerCase();
        bv = (b.industry ?? "").toLowerCase();
      } else if (sortKey === "health") {
        av = a.health_score ?? -1;
        bv = b.health_score ?? -1;
      } else {
        av = a.status;
        bv = b.status;
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [clients, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / perPage));
  const currentPage = Math.min(page, totalPages);
  const paged = sorted.slice((currentPage - 1) * perPage, currentPage * perPage);

  const toggle = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey !== k ? (
      <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />
    ) : sortDir === "asc" ? (
      <ArrowUp className="ml-1 h-3 w-3" />
    ) : (
      <ArrowDown className="ml-1 h-3 w-3" />
    );

  const soon = () => toast({ title: "Próximamente" });

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <button className="flex items-center" onClick={() => toggle("name")}>
                  Cliente <SortIcon k="name" />
                </button>
              </TableHead>
              <TableHead>
                <button className="flex items-center" onClick={() => toggle("industry")}>
                  Industria <SortIcon k="industry" />
                </button>
              </TableHead>
              <TableHead>Servicios</TableHead>
              <TableHead>
                <button className="flex items-center" onClick={() => toggle("health")}>
                  Health Score <SortIcon k="health" />
                </button>
              </TableHead>
              <TableHead>
                <button className="flex items-center" onClick={() => toggle("status")}>
                  Status <SortIcon k="status" />
                </button>
              </TableHead>
              <TableHead>Próximo pago</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.map((c) => (
              <TableRow
                  key={c.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/app/clientes/${c.slug}`)}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <ClientLogo
                        name={c.name}
                        logoUrl={c.logo_url}
                        brandColor={c.brand_primary_color}
                        size="sm"
                      />
                      <span className="font-medium text-foreground">{c.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {c.industry ?? "—"}
                  </TableCell>
                  <TableCell>
                    <ServicesChips projects={c.projects ?? []} />
                  </TableCell>
                  <TableCell>
                    <HealthScoreBar score={c.health_score} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={c.status} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">—</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/app/clientes/${c.slug}`)}>
                          Abrir ficha
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => window.open(`/portal/${c.slug}`, "_blank")}
                        >
                          Ver portal cliente
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setEditingClient(c)}>Editar</DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={async () => {
                            try {
                              await archive.mutateAsync(c.id);
                              toast({ title: "Cliente archivado", description: `${c.name} se marcó como churned` });
                            } catch (e: any) {
                              toast({ title: "No se pudo archivar", description: e?.message, variant: "destructive" });
                            }
                          }}
                        >
                          Archivar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setDeletingClient(c)} className="text-destructive">
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div>
          {sorted.length === 0
            ? "0 clientes"
            : `Mostrando ${(currentPage - 1) * perPage + 1}–${Math.min(
                currentPage * perPage,
                sorted.length,
              )} de ${sorted.length}`}
        </div>
        <div className="flex items-center gap-3">
          <Select
            value={String(perPage)}
            onValueChange={(v) => {
              setPerPage(Number(v));
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[90px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setPage(currentPage - 1)}
            >
              Anterior
            </Button>
            <span className="px-2">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => setPage(currentPage + 1)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      </div>

      {editingClient && (
        <EditClientDialog
          open={!!editingClient}
          onOpenChange={(v) => !v && setEditingClient(null)}
          workspaceId={editingClient.workspace_id}
          client={{
            id: editingClient.id,
            name: editingClient.name,
            industry: editingClient.industry,
            website: editingClient.website,
            location: editingClient.location,
            status: editingClient.status,
            brand_primary_color: editingClient.brand_primary_color,
            brand_secondary_color: editingClient.brand_secondary_color,
            logo_url: editingClient.logo_url,
          }}
        />
      )}
    </div>
  );
}
