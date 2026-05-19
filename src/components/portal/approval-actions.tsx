import { useState } from "react";
import { Check, MessageSquareWarning, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useApprovalActions } from "@/hooks/portal/useApprovalActions";
import { RequestChangesDialog } from "./request-changes-dialog";
import { RejectDialog } from "./reject-dialog";
import type { ApprovalPost } from "@/hooks/portal/usePendingApprovals";

interface Props {
  post: ApprovalPost;
  clientId: string;
}

export function ApprovalActions({ post, clientId }: Props) {
  const { approvePost, requestChanges, rejectPost } = useApprovalActions(clientId);
  const [changesOpen, setChangesOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);

  const handleApprove = () => {
    approvePost.mutate(
      { postId: post.id, clientId },
      {
        onSuccess: () =>
          toast.success("Post aprobado", {
            description: "Se notificó a tu equipo en Astratta.",
          }),
        onError: (e: any) =>
          toast.error("No se pudo aprobar", { description: e?.message ?? "Inténtalo de nuevo." }),
      },
    );
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setRejectOpen(true)}
          disabled={approvePost.isPending}
          className="text-destructive hover:text-destructive"
        >
          <X className="mr-1 h-4 w-4" />
          Rechazar
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setChangesOpen(true)}
          disabled={approvePost.isPending}
          style={{ borderColor: "var(--portal-secondary)", color: "var(--portal-secondary)" }}
        >
          <MessageSquareWarning className="mr-1 h-4 w-4" />
          Solicitar cambios
        </Button>
        <Button
          size="sm"
          onClick={handleApprove}
          disabled={approvePost.isPending}
          style={{ backgroundColor: "hsl(142 71% 45%)", color: "white" }}
        >
          {approvePost.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />}
          Aprobar
        </Button>
      </div>

      <RequestChangesDialog
        open={changesOpen}
        onOpenChange={setChangesOpen}
        loading={requestChanges.isPending}
        onSubmit={(comment) =>
          requestChanges.mutate(
            { postId: post.id, clientId, comment },
            {
              onSuccess: () => {
                toast.success("Solicitud de cambios enviada");
                setChangesOpen(false);
              },
              onError: (e: any) =>
                toast.error("No se pudo enviar", { description: e?.message ?? "" }),
            },
          )
        }
      />
      <RejectDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        loading={rejectPost.isPending}
        onSubmit={(reason) =>
          rejectPost.mutate(
            { postId: post.id, clientId, reason },
            {
              onSuccess: () => {
                toast.success("Post rechazado");
                setRejectOpen(false);
              },
              onError: (e: any) =>
                toast.error("No se pudo rechazar", { description: e?.message ?? "" }),
            },
          )
        }
      />
    </>
  );
}
