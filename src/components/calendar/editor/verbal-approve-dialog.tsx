import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import type { PostStatus } from "@/lib/post-states";

type Props = {
  postId: string;
  clientId: string;
  status: PostStatus;
};

const BLOCKED: PostStatus[] = ["approved", "scheduled", "published", "archived"];

export function VerbalApproveButton({ postId, clientId, status }: Props) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const qc = useQueryClient();

  const approve = useMutation({
    mutationFn: async () => {
      const trimmed = note.trim();
      const { error: updErr } = await (supabase as any)
        .from("social_posts")
        .update({ status: "approved" })
        .eq("id", postId);
      if (updErr) throw updErr;

      const { data: userRes } = await supabase.auth.getUser();
      const { error: histErr } = await (supabase as any)
        .from("content_approval_history")
        .insert({
          post_id: postId,
          client_id: clientId,
          action: "approved",
          actor_user_id: userRes.user?.id ?? null,
          comment: trimmed || null,
          metadata: { verbal: true, note: trimmed || null, from: status },
        });
      if (histErr) throw histErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["social-posts"] });
      qc.invalidateQueries({ queryKey: ["social_posts", postId] });
      qc.invalidateQueries({ queryKey: ["post-approval-history", postId] });
      toast.success("Marcado como aprobado");
      setOpen(false);
      setNote("");
    },
    onError: (e: any) => {
      toast.error("No se pudo marcar como aprobado", { description: e?.message });
    },
  });

  if (BLOCKED.includes(status)) return null;

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        className="gap-1"
      >
        <CheckCircle2 className="h-4 w-4" />
        Aprobar (verbal)
      </Button>

      <Dialog open={open} onOpenChange={(o) => !approve.isPending && setOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar como aprobado sin pasar por el portal</DialogTitle>
            <DialogDescription>
              Usa esto solo si el cliente ya dio su aprobación de forma verbal
              (llamada, WhatsApp, en persona, etc.). El cliente no será notificado
              y no tendrá que aprobar nada en el portal.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="verbal-approval-note">
              Nota (opcional)
            </label>
            <Textarea
              id="verbal-approval-note"
              placeholder="Ej. Aprobado por teléfono con Juan el 3 de julio"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={approve.isPending}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => approve.mutate()}
              disabled={approve.isPending}
            >
              {approve.isPending ? "Confirmando…" : "Confirmar aprobación"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
