import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import {
  Archive,
  ArchiveRestore,
  Check,
  ChevronRight,
  Download,
  FileCode,
  FileSpreadsheet,
  FileText,
  FileType,
  ImageIcon,
  Loader2,
  MoreHorizontal,
  Smile,
  Star,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import type { Editor, JSONContent } from "@tiptap/react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { exportCSV, exportHTML, exportMarkdown, exportPDF } from "@/lib/document-export";

import { DocumentEditor } from "@/components/documents/document-editor";
import {
  CoverPicker,
  DocIcon,
  DocToc,
  DocTree,
  EmojiPicker,
  ancestorsOf,
} from "@/components/documents/doc-page-parts";
import { memberDisplay } from "@/components/tasks/assignee-avatars";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { useClients } from "@/hooks/useClients";
import { useWorkspaceMembers } from "@/hooks/useProjects";
import {
  DOCUMENT_TYPE_LABEL,
  useCreateDocument,
  useDeleteDocument,
  useDocument,
  useDocumentFavorites,
  useDocuments,
  useToggleDocumentFavorite,
  useUpdateDocument,
  type DocumentType,
} from "@/hooks/useDocuments";

const NONE = "__none__";

export default function DocumentoDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { workspace } = useActiveWorkspace();
  const workspaceId = workspace?.id;

  const { data: doc, isLoading } = useDocument(id);
  const { data: allDocs = [] } = useDocuments(workspaceId, {});
  const { data: clients } = useClients(workspaceId, {});
  const { data: members = [] } = useWorkspaceMembers(workspaceId);
  const { data: favorites } = useDocumentFavorites(workspaceId);
  const toggleFav = useToggleDocumentFavorite(workspaceId);
  const updateDoc = useUpdateDocument(workspaceId);
  const createDoc = useCreateDocument(workspaceId);
  const deleteDoc = useDeleteDocument(workspaceId);

  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle");
  const [editor, setEditor] = useState<Editor | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const titleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedId = useRef<string | null>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (doc && loadedId.current !== doc.id) {
      loadedId.current = doc.id;
      setTitle(doc.title === "Sin título" ? "" : doc.title);
    }
  }, [doc]);

  // Auto-grow the title textarea.
  useEffect(() => {
    const el = titleRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [title]);

  const save = useCallback(
    async (patch: Record<string, unknown>) => {
      if (!id) return;
      setSaving("saving");
      try {
        await updateDoc.mutateAsync({ id, ...patch });
        setSaving("saved");
        setTimeout(() => setSaving("idle"), 2000);
      } catch {
        setSaving("idle");
        toast.error("No se pudo guardar el cambio");
      }
    },
    [id, updateDoc],
  );

  const onTitleChange = (value: string) => {
    setTitle(value);
    if (titleTimer.current) clearTimeout(titleTimer.current);
    titleTimer.current = setTimeout(() => save({ title: value.trim() || "Sin título" }), 800);
  };

  const onContentChange = useCallback((content: JSONContent) => save({ content }), [save]);

  const handleExport = (format: "pdf" | "html" | "md" | "csv") => {
    if (!doc) return;
    const content = (editor?.getJSON() ?? (doc.content as JSONContent)) ?? null;
    const name = title || doc.title;
    try {
      if (format === "pdf") {
        const ok = exportPDF(name, content);
        if (!ok) toast.error("El navegador bloqueó la ventana de impresión. Permite pop-ups para exportar a PDF.");
      } else if (format === "html") exportHTML(name, content);
      else if (format === "md") exportMarkdown(name, content);
      else exportCSV(name, content);
    } catch {
      toast.error("No se pudo exportar el documento");
    }
  };

  const addSubpage = async () => {
    if (!doc) return;
    try {
      const child = await createDoc.mutateAsync({ parent_id: doc.id, type: doc.type, client_id: doc.client_id });
      navigate(`/app/documentos/${child.id}`);
    } catch {
      toast.error("No se pudo crear la subpágina");
    }
  };

  const handleDelete = async () => {
    if (!doc) return;
    try {
      await deleteDoc.mutateAsync(doc.id);
      toast.success("Documento eliminado");
      navigate(doc.parent_id ? `/app/documentos/${doc.parent_id}` : "/app/documentos");
    } catch {
      toast.error("No se pudo eliminar (solo autor o admin)");
    } finally {
      setConfirmDelete(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full max-w-xl" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Documento no encontrado.</p>
        <Button variant="link" asChild className="px-0">
          <Link to="/app/documentos">Volver a Documentos</Link>
        </Button>
      </div>
    );
  }

  // The current doc may be archived (not in the active list): include it for the tree.
  const treeDocs = allDocs.some((d) => d.id === doc.id) ? allDocs : [...allDocs, doc];
  const ancestors = ancestorsOf(treeDocs, doc);
  const isFav = favorites?.has(doc.id) ?? false;
  const author = doc.created_by ? memberDisplay(members, doc.created_by).name : null;
  const archived = !!doc.archived_at;

  return (
    <div className="flex min-h-full">
      {/* Page tree */}
      <aside className="hidden w-60 shrink-0 border-r px-2 py-4 lg:block">
        <DocTree docs={treeDocs} current={doc} onAddPage={addSubpage} adding={createDoc.isPending} />
      </aside>

      <div className="min-w-0 flex-1">
        {/* Header bar */}
        <div className="flex items-center gap-2 border-b px-4 py-2 text-sm">
          <nav aria-label="Ruta" className="flex min-w-0 flex-1 items-center gap-1 text-muted-foreground">
            <Link to="/app/documentos" className="shrink-0 hover:text-foreground">
              Documentos
            </Link>
            {ancestors.map((a) => (
              <span key={a.id} className="flex min-w-0 items-center gap-1">
                <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                <Link to={`/app/documentos/${a.id}`} className="flex min-w-0 items-center gap-1 hover:text-foreground">
                  <DocIcon doc={a} className="shrink-0 text-xs" />
                  <span className="truncate">{a.title}</span>
                </Link>
              </span>
            ))}
            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate text-foreground">{title || "Sin título"}</span>
          </nav>

          <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
            {saving === "saving" && (
              <>
                <Loader2 className="h-3 w-3 animate-spin" /> Guardando…
              </>
            )}
            {saving === "saved" && (
              <>
                <Check className="h-3 w-3" /> Guardado
              </>
            )}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label={isFav ? "Quitar de favoritos" : "Agregar a favoritos"}
            title={isFav ? "Quitar de favoritos" : "Agregar a favoritos"}
            onClick={() => toggleFav.mutate({ id: doc.id, favorite: !isFav })}
          >
            <Star className={cn("h-4 w-4", isFav && "fill-amber-400 text-amber-400")} />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Más acciones">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Download className="mr-2 h-4 w-4" /> Exportar
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onClick={() => handleExport("pdf")}>
                    <FileType className="mr-2 h-4 w-4" /> PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport("html")}>
                    <FileCode className="mr-2 h-4 w-4" /> HTML
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport("md")}>
                    <FileText className="mr-2 h-4 w-4" /> Markdown
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport("csv")}>
                    <FileSpreadsheet className="mr-2 h-4 w-4" /> CSV
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuItem onClick={addSubpage}>
                <FileText className="mr-2 h-4 w-4" /> Agregar subpágina
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => save({ archived_at: archived ? null : new Date().toISOString() })}>
                {archived ? <ArchiveRestore className="mr-2 h-4 w-4" /> : <Archive className="mr-2 h-4 w-4" />}
                {archived ? "Restaurar" : "Archivar"}
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="mr-2 h-4 w-4" /> Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {archived && (
          <div className="flex items-center justify-between gap-2 border-b bg-muted/50 px-4 py-2 text-sm text-muted-foreground">
            Este documento está archivado.
            <Button size="sm" variant="outline" onClick={() => save({ archived_at: null })}>
              Restaurar
            </Button>
          </div>
        )}

        {/* Cover */}
        {doc.cover_color && (
          <div
            className="group relative h-36 w-full"
            style={{ background: `linear-gradient(135deg, ${doc.cover_color}, ${doc.cover_color}80)` }}
          >
            <CoverPicker onPick={(c) => save({ cover_color: c })} onClear={() => save({ cover_color: null })}>
              <Button
                size="sm"
                variant="secondary"
                className="absolute bottom-3 right-4 opacity-0 transition-opacity group-hover:opacity-100"
              >
                Cambiar portada
              </Button>
            </CoverPicker>
          </div>
        )}

        <div className="flex gap-8 px-6">
          <div className="mx-auto w-full max-w-3xl pb-24">
            {/* Icon */}
            {doc.icon && (
              <EmojiPicker onPick={(e) => save({ icon: e })} onClear={() => save({ icon: null })}>
                <button
                  type="button"
                  aria-label="Cambiar icono"
                  className={cn("rounded-lg text-6xl leading-none hover:bg-muted", doc.cover_color ? "-mt-10" : "mt-8")}
                >
                  {doc.icon}
                </button>
              </EmojiPicker>
            )}

            {/* Add icon / cover */}
            <div className={cn("group flex gap-1 pt-4", !doc.icon && !doc.cover_color && "pt-8")}>
              {!doc.icon && (
                <EmojiPicker onPick={(e) => save({ icon: e })}>
                  <Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-xs text-muted-foreground">
                    <Smile className="h-3.5 w-3.5" /> Agregar icono
                  </Button>
                </EmojiPicker>
              )}
              {!doc.cover_color && (
                <CoverPicker onPick={(c) => save({ cover_color: c })}>
                  <Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-xs text-muted-foreground">
                    <ImageIcon className="h-3.5 w-3.5" /> Agregar portada
                  </Button>
                </CoverPicker>
              )}
            </div>

            {/* Title */}
            <textarea
              ref={titleRef}
              value={title}
              rows={1}
              onChange={(e) => onTitleChange(e.target.value.replace(/\n/g, ""))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  editor?.commands.focus("start");
                }
              }}
              placeholder="Sin título"
              aria-label="Título del documento"
              className="mt-2 w-full resize-none overflow-hidden bg-transparent text-4xl font-bold leading-tight tracking-tight outline-none placeholder:text-muted-foreground/50"
            />

            {/* Meta + properties */}
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
              {author && <span>{author}</span>}
              <span>Actualizado {formatDistanceToNow(new Date(doc.updated_at), { addSuffix: true, locale: es })}</span>
              <Select value={doc.type} onValueChange={(v) => save({ type: v as DocumentType })}>
                <SelectTrigger className="h-7 w-auto gap-1 border-0 bg-muted/60 px-2 text-xs shadow-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(DOCUMENT_TYPE_LABEL) as DocumentType[]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {DOCUMENT_TYPE_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={doc.client_id ?? NONE}
                onValueChange={(v) =>
                  save({ client_id: v === NONE ? null : v, ...(v === NONE ? { visible_in_portal: false } : {}) })
                }
              >
                <SelectTrigger className="h-7 w-auto gap-1 border-0 bg-muted/60 px-2 text-xs shadow-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Sin cliente</SelectItem>
                  {(clients ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {doc.client_id && (
                <div className="flex items-center gap-2">
                  <Switch
                    id="portal-visible"
                    checked={doc.visible_in_portal}
                    onCheckedChange={(checked) => save({ visible_in_portal: checked })}
                  />
                  <Label htmlFor="portal-visible" className="text-xs font-normal">
                    Visible en portal
                  </Label>
                </div>
              )}
            </div>

            <div className="mt-6">
              <DocumentEditor
                key={doc.id}
                initialContent={(doc.content as JSONContent) ?? null}
                onChange={onContentChange}
                onReady={setEditor}
              />
            </div>
          </div>

          {/* Table of contents */}
          <aside className="sticky top-4 hidden w-52 shrink-0 self-start pt-10 xl:block">
            <DocToc editor={editor} />
          </aside>
        </div>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar documento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. También se eliminarán sus subpáginas. Si solo quieres
              quitarlo de la lista, archívalo.
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
