import { useState } from "react";
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, Loader2, Check, X } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  useContentPillars,
  useCreatePillar,
  useDeletePillar,
  useReorderPillars,
  useUpdatePillar,
} from "@/hooks/useSocialPosts";

const SWATCHES = [
  "#5140f2",
  "#2563eb",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#f97316",
  "#ef4444",
  "#ec4899",
  "#8b5cf6",
  "#64748b",
];

interface Props {
  clientId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function ManagePillarsDialog({ clientId, open, onOpenChange }: Props) {
  const { data: pillars = [], isLoading } = useContentPillars(clientId ?? undefined);
  const createMut = useCreatePillar(clientId ?? undefined);
  const updateMut = useUpdatePillar(clientId ?? undefined);
  const deleteMut = useDeletePillar(clientId ?? undefined);
  const reorderMut = useReorderPillars(clientId ?? undefined);

  // Real pillars only (skip the "Sin pilar" sentinel with id === null)
  const real = pillars.filter((p) => p.id !== null) as { id: string; name: string; color: string }[];

  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(SWATCHES[0]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState(SWATCHES[0]);

  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) {
      toast.error("El nombre no puede estar vacío");
      return;
    }
    try {
      await createMut.mutateAsync({ name, color: newColor });
      setNewName("");
      setNewColor(SWATCHES[0]);
      toast.success("Pilar creado");
    } catch (e: any) {
      toast.error("No se pudo crear el pilar", { description: e?.message });
    }
  };

  const startEdit = (p: { id: string; name: string; color: string }) => {
    setEditingId(p.id);
    setEditName(p.name);
    setEditColor(p.color);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const name = editName.trim();
    if (!name) {
      toast.error("El nombre no puede estar vacío");
      return;
    }
    try {
      await updateMut.mutateAsync({ id: editingId, name, color: editColor });
      cancelEdit();
      toast.success("Pilar actualizado");
    } catch (e: any) {
      toast.error("No se pudo actualizar", { description: e?.message });
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteMut.mutateAsync(pendingDelete.id);
      setPendingDelete(null);
      toast.success("Pilar eliminado");
    } catch (e: any) {
      toast.error("No se pudo eliminar", { description: e?.message });
    }
  };

  const move = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= real.length) return;
    const next = [...real];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    try {
      await reorderMut.mutateAsync(next.map((p) => p.id));
    } catch (e: any) {
      toast.error("No se pudo reordenar", { description: e?.message });
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Gestionar pilares</DialogTitle>
            <DialogDescription>
              Los pilares organizan tu contenido por temática y se comparten en filtros y editor.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Existing pillars */}
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Pilares existentes
              </Label>
              {isLoading ? (
                <div className="rounded-md border p-4 text-sm text-muted-foreground">
                  Cargando…
                </div>
              ) : real.length === 0 ? (
                <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Aún no hay pilares. Crea el primero abajo.
                </div>
              ) : (
                <ul className="space-y-1.5">
                  {real.map((p, i) => {
                    const isEditing = editingId === p.id;
                    return (
                      <li
                        key={p.id}
                        className="flex items-center gap-2 rounded-md border p-2"
                      >
                        {isEditing ? (
                          <>
                            <input
                              type="color"
                              value={editColor}
                              onChange={(e) => setEditColor(e.target.value)}
                              className="h-8 w-8 cursor-pointer rounded border bg-transparent"
                            />
                            <Input
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="h-8 flex-1"
                              autoFocus
                            />
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              onClick={saveEdit}
                              disabled={updateMut.isPending}
                            >
                              {updateMut.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Check className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              onClick={cancelEdit}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <span
                              className="h-4 w-4 rounded-full border"
                              style={{ backgroundColor: p.color }}
                            />
                            <span className="flex-1 truncate text-sm">{p.name}</span>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              onClick={() => move(i, -1)}
                              disabled={i === 0 || reorderMut.isPending}
                              aria-label="Subir"
                            >
                              <ArrowUp className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              onClick={() => move(i, 1)}
                              disabled={i === real.length - 1 || reorderMut.isPending}
                              aria-label="Bajar"
                            >
                              <ArrowDown className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              onClick={() => startEdit(p)}
                              aria-label="Editar"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              onClick={() => setPendingDelete({ id: p.id, name: p.name })}
                              aria-label="Eliminar"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Add new */}
            <div className="space-y-2 rounded-md border p-3">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Nuevo pilar
              </Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={newColor}
                  onChange={(e) => setNewColor(e.target.value)}
                  className="h-9 w-9 cursor-pointer rounded border bg-transparent"
                  aria-label="Color del pilar"
                />
                <Input
                  placeholder="Nombre del pilar"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAdd();
                    }
                  }}
                />
                <Button type="button" onClick={handleAdd} disabled={createMut.isPending}>
                  {createMut.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" />
                  )}
                  Agregar
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {SWATCHES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setNewColor(s)}
                    className="h-5 w-5 rounded-full border transition hover:scale-110"
                    style={{
                      backgroundColor: s,
                      outline: newColor.toLowerCase() === s ? "2px solid hsl(var(--ring))" : "none",
                      outlineOffset: 1,
                    }}
                    aria-label={`Color ${s}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar pilar "{pendingDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Las publicaciones que ya usan este pilar conservarán su nombre como texto,
              pero dejará de estar disponible en filtros y selectores.
            </AlertDialogDescription>
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
