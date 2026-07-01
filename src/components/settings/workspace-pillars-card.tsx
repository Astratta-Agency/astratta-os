import { useState } from "react";
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, Loader2, Check, X } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  useCreateWorkspaceDefaultPillar,
  useDeleteWorkspaceDefaultPillar,
  useReorderWorkspaceDefaultPillars,
  useUpdateWorkspaceDefaultPillar,
  useWorkspaceDefaultPillars,
} from "@/hooks/useWorkspaceSettings";

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
  workspaceId: string | undefined;
  isOwner: boolean;
}

export function WorkspacePillarsCard({ workspaceId, isOwner }: Props) {
  const { data: pillars = [], isLoading } = useWorkspaceDefaultPillars(workspaceId);
  const createMut = useCreateWorkspaceDefaultPillar(workspaceId);
  const updateMut = useUpdateWorkspaceDefaultPillar(workspaceId);
  const deleteMut = useDeleteWorkspaceDefaultPillar(workspaceId);
  const reorderMut = useReorderWorkspaceDefaultPillars(workspaceId);

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
    if (target < 0 || target >= pillars.length) return;
    const next = [...pillars];
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
      <Card>
        <CardHeader>
          <CardTitle>Pilares de contenido base</CardTitle>
          <CardDescription>
            Estos pilares se copian automáticamente a cada cliente nuevo que crees. Podés
            personalizarlos por cliente después.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="rounded-md border p-4 text-sm text-muted-foreground">Cargando…</div>
          ) : pillars.length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              Aún no hay pilares base. {isOwner ? "Crea el primero abajo." : ""}
            </div>
          ) : (
            <ul className="space-y-1.5">
              {pillars.map((p, i) => {
                const isEditing = editingId === p.id;
                return (
                  <li key={p.id} className="flex items-center gap-2 rounded-md border p-2">
                    {isEditing && isOwner ? (
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
                        <Button type="button" size="icon" variant="ghost" onClick={saveEdit} disabled={updateMut.isPending}>
                          {updateMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        </Button>
                        <Button type="button" size="icon" variant="ghost" onClick={cancelEdit}>
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <span className="h-4 w-4 rounded-full border" style={{ backgroundColor: p.color }} />
                        <span className="flex-1 truncate text-sm">{p.name}</span>
                        {isOwner && (
                          <>
                            <Button type="button" size="icon" variant="ghost" onClick={() => move(i, -1)} disabled={i === 0 || reorderMut.isPending} aria-label="Subir">
                              <ArrowUp className="h-4 w-4" />
                            </Button>
                            <Button type="button" size="icon" variant="ghost" onClick={() => move(i, 1)} disabled={i === pillars.length - 1 || reorderMut.isPending} aria-label="Bajar">
                              <ArrowDown className="h-4 w-4" />
                            </Button>
                            <Button type="button" size="icon" variant="ghost" onClick={() => startEdit(p)} aria-label="Editar">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button type="button" size="icon" variant="ghost" onClick={() => setPendingDelete({ id: p.id, name: p.name })} aria-label="Eliminar">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </>
                        )}
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {isOwner && (
            <div className="space-y-2 rounded-md border p-3">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Nuevo pilar</Label>
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
                  {createMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
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
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar pilar "{pendingDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Solo se elimina de los pilares base del workspace. Los clientes existentes que ya lo
              tengan copiado no se ven afectados.
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
