import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  loading: boolean;
  onSubmit: (reason: string) => void;
}

const MIN = 10;

export function RejectDialog({ open, onOpenChange, loading, onSubmit }: Props) {
  const [text, setText] = useState("");
  useEffect(() => { if (!open) setText(""); }, [open]);
  const valid = text.trim().length >= MIN;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rechazar post</DialogTitle>
          <DialogDescription>
            Cuéntale a tu equipo por qué este post no funciona. Es definitivo, pero pueden crear uno nuevo.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Razón del rechazo…"
            rows={5}
          />
          <p className={text.trim().length < MIN ? "text-xs text-muted-foreground" : "text-xs text-emerald-600"}>
            {text.trim().length} / mínimo {MIN} caracteres
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={() => onSubmit(text.trim())}
            disabled={!valid || loading}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Rechazar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
