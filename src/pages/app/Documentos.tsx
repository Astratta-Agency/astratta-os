import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FileText, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { useClients } from "@/hooks/useClients";
import {
  DOCUMENT_TYPE_LABEL,
  useCreateDocument,
  useDeleteDocument,
  useDocuments,
  type DocumentType,
} from "@/hooks/useDocuments";

const TYPE_BADGE: Record<DocumentType, string> = {
  idea: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  script: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200",
  kpi_plan: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  nota: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
  otro: "bg-muted text-muted-foreground",
};

export default function Documentos() {
  const { workspace } = useActiveWorkspace();
  const workspaceId = workspace?.id;
  const navigate = useNavigate();

  const [params, setParams] = useSearchParams();
  const search = params.get("q") ?? "";
  const type = (params.get("type") as DocumentType | null) ?? "all";
  const clientId = params.get("client_id") ?? "all";

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const update = (next: Record<string, string | null>) => {
    const p = new URLSearchParams(params);
    Object.entries(next).forEach(([k, v]) => {
      if (!v || v === "all") p.delete(k);
      else p.set(k, v);
    });
    setParams(p, { replace: true });
  };

  const { data: docs, isLoading } = useDocuments(workspaceId, {
    search,
    type: type as DocumentType | "all",
    clientId,
  });
  const { data: clients } = useClients(workspaceId, {});
  const createDoc = useCreateDocument(workspaceId);
  const deleteDoc = useDeleteDocument(workspaceId);

  const clientName = (id: string | null) =>
    id ? (clients ?? []).find((c) => c.id === id)?.name ?? null : null;

  const handleCreate = async (docType: DocumentType) => {
    try {
      const doc = await createDoc.mutateAsync({ type: docType });
      navigate(`/app/documentos/${doc.id}`);
    } catch {
      toast.error("No se pudo crear el documento");
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteDoc.mutateAsync(deleteId);
      toast.success("Documento eliminado");
    } catch {
      toast.error("No se pudo eliminar (solo autor o admin)");
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Documentos</h1>
          <p className="text-sm text-muted-foreground">
            Ideas, scripts, planes de KPIs y notas del equipo
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button disabled={createDoc.isPending} className="gap-2">
              <Plus className="h-4 w-4" />
              Nuevo documento
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {(Object.keys(DOCUMENT_TYPE_LABEL) as DocumentType[]).map((t) => (
              <DropdownMenuItem key={t} onClick={() => handleCreate(t)}>
                {DOCUMENT_TYPE_LABEL[t]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
      ) : !docs?.length ? (
        <EmptyState
          icon={<FileText className="h-5 w-5" />}
          title="Sin documentos todavía"
          description="Crea tu primer documento: una idea de contenido, el script de un reel o el plan de KPIs del mes."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {docs.map((doc) => (
            <Card
              key={doc.id}
              className="group cursor-pointer transition-shadow hover:shadow-md"
              onClick={() => navigate(`/app/documentos/${doc.id}`)}
            >
              <CardContent className="flex h-full flex-col gap-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <span className="line-clamp-2 font-medium">{doc.title}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteId(doc.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
                <div className="mt-auto flex flex-wrap items-center gap-1.5">
                  <Badge variant="secondary" className={TYPE_BADGE[doc.type]}>
                    {DOCUMENT_TYPE_LABEL[doc.type]}
                  </Badge>
                  {clientName(doc.client_id) && (
                    <Badge variant="outline">{clientName(doc.client_id)}</Badge>
                  )}
                  {doc.visible_in_portal && <Badge variant="outline">Portal</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">
                  Actualizado{" "}
                  {new Date(doc.updated_at).toLocaleDateString("es", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar documento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
