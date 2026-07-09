import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Check, Download, FileCode, FileSpreadsheet, FileText, FileType, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { JSONContent } from "@tiptap/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { exportCSV, exportHTML, exportMarkdown, exportPDF } from "@/lib/document-export";

import { DocumentEditor } from "@/components/documents/document-editor";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { useClients } from "@/hooks/useClients";
import {
  DOCUMENT_TYPE_LABEL,
  useDocument,
  useUpdateDocument,
  type DocumentType,
} from "@/hooks/useDocuments";

const NONE = "__none__";

export default function DocumentoDetalle() {
  const { id } = useParams<{ id: string }>();
  const { workspace } = useActiveWorkspace();
  const workspaceId = workspace?.id;

  const { data: doc, isLoading } = useDocument(id);
  const { data: clients } = useClients(workspaceId, {});
  const updateDoc = useUpdateDocument(workspaceId);

  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle");
  const titleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedId = useRef<string | null>(null);

  useEffect(() => {
    if (doc && loadedId.current !== doc.id) {
      loadedId.current = doc.id;
      setTitle(doc.title);
    }
  }, [doc]);

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
    titleTimer.current = setTimeout(() => save({ title: value || "Sin título" }), 800);
  };

  const onContentChange = useCallback(
    (content: JSONContent) => save({ content }),
    [save],
  );

  const handleExport = (format: "pdf" | "html" | "md" | "csv") => {
    if (!doc) return;
    const content = (doc.content as JSONContent) ?? null;
    try {
      if (format === "pdf") {
        const ok = exportPDF(title || doc.title, content);
        if (!ok) toast.error("El navegador bloqueó la ventana de impresión. Permite pop-ups para exportar a PDF.");
      } else if (format === "html") exportHTML(title || doc.title, content);
      else if (format === "md") exportMarkdown(title || doc.title, content);
      else exportCSV(title || doc.title, content);
    } catch {
      toast.error("No se pudo exportar el documento");
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

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" asChild className="gap-1 text-muted-foreground">
          <Link to="/app/documentos">
            <ArrowLeft className="h-4 w-4" />
            Documentos
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Download className="h-4 w-4" />
                Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
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
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Input
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder="Título del documento"
        className="border-none px-0 text-2xl font-semibold shadow-none focus-visible:ring-0"
      />

      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Tipo</Label>
          <Select
            value={doc.type}
            onValueChange={(v) => save({ type: v as DocumentType })}
          >
            <SelectTrigger className="h-8 w-[150px]">
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
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Cliente</Label>
          <Select
            value={doc.client_id ?? NONE}
            onValueChange={(v) =>
              save({ client_id: v === NONE ? null : v, ...(v === NONE ? { visible_in_portal: false } : {}) })
            }
          >
            <SelectTrigger className="h-8 w-[190px]">
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
        </div>

        {doc.client_id && (
          <div className="flex items-center gap-2 pb-1.5">
            <Switch
              id="portal-visible"
              checked={doc.visible_in_portal}
              onCheckedChange={(checked) => save({ visible_in_portal: checked })}
            />
            <Label htmlFor="portal-visible" className="text-sm">
              Visible en portal del cliente
            </Label>
          </div>
        )}
      </div>

      <DocumentEditor
        initialContent={(doc.content as JSONContent) ?? null}
        onChange={onContentChange}
      />
    </div>
  );
}
