import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import {
  Archive,
  ArchiveRestore,
  FileText,
  Files,
  MoreHorizontal,
  Plus,
  Search,
  Star,
  Trash2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
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

import { DocIcon } from "@/components/documents/doc-page-parts";
import { memberDisplay } from "@/components/tasks/assignee-avatars";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { useAuth } from "@/hooks/useAuth";
import { useClients } from "@/hooks/useClients";
import { useWorkspaceMembers } from "@/hooks/useProjects";
import {
  DOCUMENT_TYPE_LABEL,
  useCreateDocument,
  useDeleteDocument,
  useDocumentFavorites,
  useDocuments,
  useToggleDocumentFavorite,
  useUpdateDocument,
  type Doc,
  type DocumentType,
} from "@/hooks/useDocuments";
import { DOC_TEMPLATES, type DocTemplate } from "@/lib/doc-templates";

type View = "all" | "mine" | "favorites" | "archived";

const VIEWS: { key: View; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "all", label: "Todos los documentos", icon: Files },
  { key: "mine", label: "Mis documentos", icon: UserRound },
  { key: "favorites", label: "Favoritos", icon: Star },
  { key: "archived", label: "Archivados", icon: Archive },
];

const TYPE_BADGE: Record<DocumentType, string> = {
  idea: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  script: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200",
  kpi_plan: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  nota: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
  otro: "bg-muted text-muted-foreground",
};

const ROW_GRID = "md:grid-cols-[minmax(220px,2fr)_150px_110px_140px_130px_64px]";

export default function Documentos() {
  const { workspace } = useActiveWorkspace();
  const { user } = useAuth();
  const workspaceId = workspace?.id;
  const navigate = useNavigate();

  const [params, setParams] = useSearchParams();
  const view = (params.get("view") as View) || "all";
  const search = params.get("q") ?? "";
  const type = (params.get("type") as DocumentType | null) ?? "all";
  const clientId = params.get("client_id") ?? "all";

  const [deleteDocTarget, setDeleteDocTarget] = useState<Doc | null>(null);

  const update = (next: Record<string, string | null>) => {
    const p = new URLSearchParams(params);
    Object.entries(next).forEach(([k, v]) => {
      if (!v || v === "all") p.delete(k);
      else p.set(k, v);
    });
    setParams(p, { replace: true });
  };

  const { data: docs = [], isLoading } = useDocuments(workspaceId, {
    search,
    type: type as DocumentType | "all",
    clientId,
    archived: view === "archived",
    createdBy: view === "mine" ? user?.id : undefined,
  });
  // Unfiltered active list: names of parent pages and subpage counts.
  const { data: activeDocs = [] } = useDocuments(workspaceId, {});
  const { data: clients } = useClients(workspaceId, {});
  const { data: members = [] } = useWorkspaceMembers(workspaceId);
  const { data: favorites } = useDocumentFavorites(workspaceId);
  const toggleFav = useToggleDocumentFavorite(workspaceId);
  const createDoc = useCreateDocument(workspaceId);
  const updateDoc = useUpdateDocument(workspaceId);
  const deleteDoc = useDeleteDocument(workspaceId);

  const clientName = (id: string | null) => (id ? (clients ?? []).find((c) => c.id === id)?.name ?? null : null);

  const { byId, childCount } = useMemo(() => {
    const byId = new Map(activeDocs.map((d) => [d.id, d]));
    const childCount = new Map<string, number>();
    for (const d of activeDocs) if (d.parent_id) childCount.set(d.parent_id, (childCount.get(d.parent_id) ?? 0) + 1);
    return { byId, childCount };
  }, [activeDocs]);

  const rows = useMemo(() => {
    let list = docs;
    if (view === "favorites") list = list.filter((d) => favorites?.has(d.id));
    // "All" lists top-level docs; subpages live inside them (search finds them too).
    if (view === "all" && !search.trim()) list = list.filter((d) => !d.parent_id || !byId.has(d.parent_id));
    return list;
  }, [docs, view, favorites, search, byId]);

  const create = async (tpl?: DocTemplate) => {
    try {
      const doc = await createDoc.mutateAsync(
        tpl ? { title: tpl.title, type: tpl.type, icon: tpl.icon, content: tpl.content as Record<string, unknown> } : { type: "nota" },
      );
      navigate(`/app/documentos/${doc.id}`);
    } catch {
      toast.error("No se pudo crear el documento");
    }
  };

  const setArchived = async (d: Doc, archived: boolean) => {
    try {
      await updateDoc.mutateAsync({ id: d.id, archived_at: archived ? new Date().toISOString() : null });
      toast.success(archived ? "Documento archivado" : "Documento restaurado");
    } catch {
      toast.error("No se pudo actualizar el documento");
    }
  };

  const handleDelete = async () => {
    if (!deleteDocTarget) return;
    try {
      await deleteDoc.mutateAsync(deleteDocTarget.id);
      toast.success("Documento eliminado");
    } catch {
      toast.error("No se pudo eliminar (solo autor o admin)");
    } finally {
      setDeleteDocTarget(null);
    }
  };

  return (
    <div className="flex min-h-full">
      <aside className="hidden w-56 shrink-0 border-r px-2 py-6 md:block">
        <div className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Docs</div>
        <nav className="space-y-0.5">
          {VIEWS.map((v) => {
            const Icon = v.icon;
            return (
              <button
                key={v.key}
                type="button"
                onClick={() => update({ view: v.key === "all" ? null : v.key })}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
                  view === v.key ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {v.label}
              </button>
            );
          })}
        </nav>

        {favorites && favorites.size > 0 && (
          <>
            <div className="px-2 pb-1 pt-6 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Favoritos</div>
            <div className="space-y-0.5">
              {activeDocs
                .filter((d) => favorites.has(d.id))
                .slice(0, 8)
                .map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => navigate(`/app/documentos/${d.id}`)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  >
                    <DocIcon doc={d} className="shrink-0 text-sm" />
                    <span className="truncate">{d.title}</span>
                  </button>
                ))}
            </div>
          </>
        )}
      </aside>

      <div className="min-w-0 flex-1 space-y-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{VIEWS.find((v) => v.key === view)?.label ?? "Documentos"}</h1>
            <p className="text-sm text-muted-foreground">Ideas, guiones, reportes, procesos y notas del equipo</p>
          </div>
          <Button disabled={createDoc.isPending} className="gap-2" onClick={() => create()}>
            <Plus className="h-4 w-4" />
            Nuevo documento
          </Button>
        </div>

        {view === "all" && (
          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Empezar con una plantilla</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
              {DOC_TEMPLATES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  disabled={createDoc.isPending}
                  onClick={() => create(t)}
                  className="rounded-lg border bg-card p-3 text-left transition hover:border-primary/40 hover:shadow-sm disabled:opacity-50"
                >
                  <div className="text-xl">{t.icon}</div>
                  <div className="mt-1 text-sm font-medium">{t.label}</div>
                  <div className="text-xs text-muted-foreground">{t.description}</div>
                </button>
              ))}
            </div>
          </section>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por título…"
              className="pl-8"
              value={search}
              onChange={(e) => update({ q: e.target.value })}
            />
          </div>
          <Select value={type} onValueChange={(v) => update({ type: v })}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              {(Object.keys(DOCUMENT_TYPE_LABEL) as DocumentType[]).map((t) => (
                <SelectItem key={t} value={t}>
                  {DOCUMENT_TYPE_LABEL[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={clientId} onValueChange={(v) => update({ client_id: v })}>
            <SelectTrigger className="w-[190px]">
              <SelectValue placeholder="Cliente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los clientes</SelectItem>
              {(clients ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-11 rounded-md" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-5 w-5" />}
            title={
              view === "favorites"
                ? "Aún no tienes favoritos"
                : view === "archived"
                  ? "No hay documentos archivados"
                  : "Sin documentos todavía"
            }
            description={
              view === "favorites"
                ? "Marca un documento con la estrella para tenerlo a mano."
                : "Crea un documento en blanco o empieza con una plantilla."
            }
          />
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <div
              className={cn(
                "hidden gap-3 border-b bg-muted/40 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground md:grid",
                ROW_GRID,
              )}
            >
              <div>Nombre</div>
              <div>Cliente</div>
              <div>Tipo</div>
              <div>Autor</div>
              <div>Actualizado</div>
              <div />
            </div>
            {rows.map((d) => {
              const parent = d.parent_id ? byId.get(d.parent_id) : undefined;
              const pages = childCount.get(d.id) ?? 0;
              const fav = favorites?.has(d.id) ?? false;
              return (
                <div
                  key={d.id}
                  onClick={() => navigate(`/app/documentos/${d.id}`)}
                  className={cn(
                    "group grid cursor-pointer grid-cols-1 items-center gap-3 border-b px-3 py-2 text-sm last:border-b-0 hover:bg-muted/40",
                    ROW_GRID,
                  )}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <DocIcon doc={d} className="shrink-0 text-base" />
                    <span className="truncate font-medium">{d.title}</span>
                    {parent && <span className="shrink-0 truncate text-xs text-muted-foreground">en {parent.title}</span>}
                    {pages > 0 && (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        · {pages} {pages === 1 ? "página" : "páginas"}
                      </span>
                    )}
                    {d.visible_in_portal && <Badge variant="outline" className="shrink-0 text-[10px]">Portal</Badge>}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">{clientName(d.client_id) ?? "—"}</div>
                  <div>
                    <Badge variant="secondary" className={cn("text-[10px]", TYPE_BADGE[d.type])}>
                      {DOCUMENT_TYPE_LABEL[d.type]}
                    </Badge>
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {d.created_by ? memberDisplay(members, d.created_by).name : "—"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(d.updated_at), { addSuffix: true, locale: es })}
                  </div>
                  <div className="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn("h-7 w-7", !fav && "opacity-0 group-hover:opacity-100")}
                      aria-label={fav ? "Quitar de favoritos" : "Agregar a favoritos"}
                      onClick={() => toggleFav.mutate({ id: d.id, favorite: !fav })}
                    >
                      <Star className={cn("h-4 w-4", fav && "fill-amber-400 text-amber-400")} />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
                          aria-label="Acciones"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setArchived(d, !d.archived_at)}>
                          {d.archived_at ? (
                            <ArchiveRestore className="mr-2 h-4 w-4" />
                          ) : (
                            <Archive className="mr-2 h-4 w-4" />
                          )}
                          {d.archived_at ? "Restaurar" : "Archivar"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => setDeleteDocTarget(d)}>
                          <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AlertDialog open={!!deleteDocTarget} onOpenChange={(o) => !o && setDeleteDocTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar documento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. También se eliminarán sus subpáginas. Si solo quieres quitarlo de
              la lista, archívalo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
