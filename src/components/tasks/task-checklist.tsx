import { useState } from "react";
import { Check, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  useAddChecklistItem,
  useChecklist,
  useDeleteChecklistItem,
  useUpdateChecklistItem,
} from "@/hooks/useTasks";

interface Props {
  taskId: string;
}

export function TaskChecklist({ taskId }: Props) {
  const { data: items = [] } = useChecklist(taskId);
  const add = useAddChecklistItem();
  const upd = useUpdateChecklistItem();
  const del = useDeleteChecklistItem();
  const [newTitle, setNewTitle] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");

  const done = items.filter((i) => i.is_done).length;
  const pct = items.length > 0 ? Math.round((done / items.length) * 100) : 0;

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    try {
      await add.mutateAsync({ taskId, title: newTitle.trim(), position: items.length });
      setNewTitle("");
    } catch (e: any) {
      toast.error("No se pudo agregar", { description: e?.message });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Checklist</h3>
        {items.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {done}/{items.length} completadas
          </span>
        )}
      </div>
      {items.length > 0 && <Progress value={pct} className="h-1.5" />}

      <div className="space-y-1.5">
        {items.map((item) => (
          <div key={item.id} className="group flex items-center gap-2">
            <Checkbox
              checked={item.is_done}
              onCheckedChange={(v) =>
                upd.mutate({ id: item.id, patch: { is_done: !!v }, taskId })
              }
            />
            {editingId === item.id ? (
              <Input
                autoFocus
                value={editingText}
                onChange={(e) => setEditingText(e.target.value)}
                onBlur={() => {
                  if (editingText.trim() && editingText !== item.title) {
                    upd.mutate({ id: item.id, patch: { title: editingText.trim() }, taskId });
                  }
                  setEditingId(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  if (e.key === "Escape") setEditingId(null);
                }}
                className="h-8"
              />
            ) : (
              <button
                type="button"
                onClick={() => {
                  setEditingId(item.id);
                  setEditingText(item.title);
                }}
                className={`flex-1 text-left text-sm ${item.is_done ? "text-muted-foreground line-through" : ""}`}
              >
                {item.title}
              </button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 opacity-0 group-hover:opacity-100"
              onClick={() => del.mutate({ id: item.id, taskId })}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="Agregar ítem…"
          className="h-8"
        />
        <Button size="sm" variant="outline" onClick={handleAdd} disabled={!newTitle.trim()}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
