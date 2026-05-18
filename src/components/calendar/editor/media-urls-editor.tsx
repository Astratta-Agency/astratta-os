import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props {
  urls: string[];
  onChange: (urls: string[]) => void;
}

export function MediaUrlsEditor({ urls, onChange }: Props) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const v = draft.trim();
    if (!v) return;
    try {
      new URL(v);
    } catch {
      return;
    }
    onChange([...urls, v]);
    setDraft("");
  };

  const remove = (i: number) => onChange(urls.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Input
          placeholder="Pega la URL de la imagen o video"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button type="button" variant="outline" size="sm" onClick={add}>
          <Plus className="mr-1 h-3 w-3" /> Agregar
        </Button>
      </div>

      {urls.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {urls.map((u, i) => (
            <div key={i} className="relative shrink-0">
              <img
                src={u}
                alt=""
                className="h-20 w-20 rounded-md border object-cover"
                onError={(e) => ((e.target as HTMLImageElement).style.opacity = "0.3")}
              />
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label="Quitar"
                className="absolute -right-1.5 -top-1.5 rounded-full bg-background p-0.5 shadow-sm ring-1 ring-border hover:bg-destructive hover:text-destructive-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
