import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { toast } from "@/hooks/use-toast";
import { MAX_FILE_BYTES } from "@/lib/storage";
import {
  DOCUMENT_CATEGORY_LABEL,
  useUploadClientDocument,
  type ClientDocumentCategory,
} from "@/hooks/useClientDocuments";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  clientId: string;
  workspaceId: string;
}

const CATEGORIES: ClientDocumentCategory[] = ["brief", "kickoff", "brand_guidelines", "other"];

export function UploadDocumentDialog({ open, onOpenChange, clientId, workspaceId }: Props) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<ClientDocumentCategory>("other");
  const [file, setFile] = useState<File | null>(null);
  const upload = useUploadClientDocument(clientId, workspaceId);

  useEffect(() => {
    if (!open) {
      setTitle("");
      setCategory("other");
      setFile(null);
    }
  }, [open]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast({ title: "El título es requerido", variant: "destructive" });
      return;
    }
    if (!file) {
      toast({ title: "Selecciona un archivo PDF", variant: "destructive" });
      return;
    }
    if (file.type !== "application/pdf") {
      toast({ title: "Solo se permiten archivos PDF", variant: "destructive" });
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      toast({ title: "El archivo es demasiado grande", variant: "destructive" });
      return;
    }
    try {
      await upload.mutateAsync({ file, title: title.trim(), category });
      toast({ title: "Documento subido" });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Error", description: err?.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Subir documento</DialogTitle>
            <DialogDescription>
              Sube un PDF asociado al cliente (brief, kickoff, brand guidelines, u otro).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="doc-title">Título</Label>
            <Input
              id="doc-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Brief campaña Q3"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Categoría</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as ClientDocumentCategory)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {DOCUMENT_CATEGORY_LABEL[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="doc-file">Archivo PDF</Label>
            <Input
              id="doc-file"
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              required
            />
            <p className="text-xs text-muted-foreground">
              Máximo {(MAX_FILE_BYTES / 1024 / 1024).toFixed(0)} MB. Solo PDF.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={upload.isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={upload.isPending}>
              {upload.isPending ? "Subiendo…" : "Subir"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
