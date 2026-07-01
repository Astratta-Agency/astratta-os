import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ExternalLink, FileText, Loader2 } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  useCreateWorkspaceTemplate,
  useDeleteWorkspaceTemplate,
  useUpdateWorkspaceTemplate,
  useWorkspaceTemplates,
  type TemplateCategory,
  type WorkspaceTemplate,
} from "@/hooks/useWorkspaceSettings";

const CATEGORIES: { value: TemplateCategory; label: string }[] = [
  { value: "contrato", label: "Contrato" },
  { value: "propuesta", label: "Propuesta" },
  { value: "reporte", label: "Reporte" },
  { value: "otro", label: "Otro" },
];

const CATEGORY_LABEL: Record<TemplateCategory, string> = {
  contrato: "Contrato",
  propuesta: "Propuesta",
  reporte: "Reporte",
  otro: "Otro",
};

const schema = z
  .object({
    name: z.string().trim().min(1, "Requerido").max(160),
    category: z.enum(["contrato", "propuesta", "reporte", "otro"]),
    body: z.string().optional().or(z.literal("")),
    file_url: z.string().trim().url("URL inválida").optional().or(z.literal("")),
  })
  .refine((v) => (v.body && v.body.trim().length > 0) || (v.file_url && v.file_url.length > 0), {
    message: "Debe incluir contenido o URL de archivo",
    path: ["body"],
  });

type FormValues = z.infer<typeof schema>;

interface Props {
  workspaceId: string | undefined;
  isOwner: boolean;
}

export function WorkspaceTemplatesCard({ workspaceId, isOwner }: Props) {
  const { data: templates = [], isLoading } = useWorkspaceTemplates(workspaceId);
  const createMut = useCreateWorkspaceTemplate(workspaceId);
  const updateMut = useUpdateWorkspaceTemplate(workspaceId);
  const deleteMut = useDeleteWorkspaceTemplate(workspaceId);

  const [filter, setFilter] = useState<TemplateCategory | "all">("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<WorkspaceTemplate | null>(null);
  const [viewing, setViewing] = useState<WorkspaceTemplate | null>(null);
  const [pendingDelete, setPendingDelete] = useState<WorkspaceTemplate | null>(null);

  const filtered = filter === "all" ? templates : templates.filter((t) => t.category === filter);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", category: "contrato", body: "", file_url: "" },
  });

  const openNew = () => {
    setEditing(null);
    form.reset({ name: "", category: "contrato", body: "", file_url: "" });
    setDialogOpen(true);
  };

  const openEdit = (t: WorkspaceTemplate) => {
    setEditing(t);
    form.reset({
      name: t.name,
      category: t.category,
      body: t.body ?? "",
      file_url: t.file_url ?? "",
    });
    setDialogOpen(true);
  };

  const onSubmit = async (v: FormValues) => {
    try {
      if (editing) {
        await updateMut.mutateAsync({
          id: editing.id,
          patch: {
            name: v.name,
            category: v.category,
            body: v.body || null,
            file_url: v.file_url || null,
          },
        });
        toast.success("Plantilla actualizada");
      } else {
        await createMut.mutateAsync({
          name: v.name,
          category: v.category,
          body: v.body || null,
          file_url: v.file_url || null,
        });
        toast.success("Plantilla creada");
      }
      setDialogOpen(false);
    } catch (e: any) {
      toast.error("Error", { description: e?.message });
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteMut.mutateAsync(pendingDelete.id);
      setPendingDelete(null);
      toast.success("Plantilla eliminada");
    } catch (e: any) {
      toast.error("No se pudo eliminar", { description: e?.message });
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle>Plantillas</CardTitle>
            <CardDescription>Contratos, propuestas y reportes reutilizables.</CardDescription>
          </div>
          {isOwner && (
            <Button size="sm" onClick={openNew}>
              <Plus className="mr-2 h-4 w-4" />
              Nueva plantilla
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Filtrar:</Label>
            <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
              <SelectTrigger className="h-8 w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="rounded-md border p-4 text-sm text-muted-foreground">Cargando…</div>
          ) : filtered.length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              No hay plantillas.
            </div>
          ) : (
            <ul className="space-y-1.5">
              {filtered.map((t) => (
                <li key={t.id} className="flex items-center gap-2 rounded-md border p-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 truncate text-sm">{t.name}</span>
                  <Badge variant="secondary">{CATEGORY_LABEL[t.category]}</Badge>
                  {t.file_url ? (
                    <Button asChild size="sm" variant="ghost">
                      <a href={t.file_url} target="_blank" rel="noreferrer">
                        <ExternalLink className="mr-1 h-4 w-4" />
                        Ver
                      </a>
                    </Button>
                  ) : t.body ? (
                    <Button size="sm" variant="ghost" onClick={() => setViewing(t)}>
                      Ver
                    </Button>
                  ) : null}
                  {isOwner && (
                    <>
                      <Button size="icon" variant="ghost" onClick={() => openEdit(t)} aria-label="Editar">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setPendingDelete(t)} aria-label="Eliminar">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Create/edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar plantilla" : "Nueva plantilla"}</DialogTitle>
            <DialogDescription>Debe incluir contenido de texto o una URL a un archivo.</DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="tpl-name">Nombre *</Label>
              <Input id="tpl-name" {...form.register("name")} />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Categoría *</Label>
              <Select
                value={form.watch("category")}
                onValueChange={(v) => form.setValue("category", v as TemplateCategory, { shouldDirty: true })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tpl-body">Contenido (texto)</Label>
              <Textarea id="tpl-body" rows={6} {...form.register("body")} />
              {form.formState.errors.body && (
                <p className="text-xs text-destructive">{form.formState.errors.body.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tpl-file">URL del archivo</Label>
              <Input id="tpl-file" placeholder="https://…" {...form.register("file_url")} />
              {form.formState.errors.file_url && (
                <p className="text-xs text-destructive">{form.formState.errors.file_url.message}</p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMut.isPending || updateMut.isPending}>
                {(createMut.isPending || updateMut.isPending) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {editing ? "Guardar" : "Crear"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View body dialog */}
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{viewing?.name}</DialogTitle>
            <DialogDescription>{viewing && CATEGORY_LABEL[viewing.category]}</DialogDescription>
          </DialogHeader>
          <pre className="whitespace-pre-wrap rounded-md border bg-muted/40 p-4 text-sm">
            {viewing?.body}
          </pre>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar "{pendingDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMut.isPending ? "Eliminando…" : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
