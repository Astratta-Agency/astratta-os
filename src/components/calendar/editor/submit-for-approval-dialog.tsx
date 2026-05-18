import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";

import { supabase } from "@/integrations/supabase/client";
import { useAssetsByUrls } from "@/hooks/useMediaAssets";
import {
  usePostSubmitForApproval,
  PreflightFailedError,
  type ApprovalSendResponse,
} from "@/hooks/usePostSubmitForApproval";
import { runApprovalPreflight, type PreflightError } from "@/lib/preflight-approval";
import type { Channel, PostStatus } from "@/lib/post-states";
import type { PostVariantRow } from "@/hooks/usePostEditor";
import { SubmitSuccessState } from "./submit-success-state";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  postId: string;
  clientId: string;
  clientSlug: string;
  clientName: string;
  workspaceName?: string;
  isHealthcare: boolean;
  post: {
    channels: Channel[];
    scheduled_for: string | null;
    media_urls: string[];
    status: PostStatus;
  };
  variants: PostVariantRow[];
}

type ClientAdminRow = {
  user_id: string | null;
  invited_email: string | null;
  status: string;
};

function useClientAdmins(clientId: string, enabled: boolean) {
  return useQuery<ClientAdminRow[]>({
    queryKey: ["client-admins", clientId],
    enabled: enabled && !!clientId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("client_users")
        .select("user_id, invited_email, status")
        .eq("client_id", clientId)
        .eq("role", "client_admin");
      if (error) throw error;
      return (data ?? []) as ClientAdminRow[];
    },
  });
}

export function SubmitForApprovalDialog({
  open,
  onOpenChange,
  postId,
  clientId,
  clientSlug,
  clientName,
  workspaceName,
  isHealthcare,
  post,
  variants,
}: Props) {
  const navigate = useNavigate();
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState<ApprovalSendResponse | null>(null);

  const { data: mediaAssets = [], isLoading: assetsLoading } = useAssetsByUrls(
    isHealthcare && post.media_urls.length > 0 ? post.media_urls : [],
  );
  const { data: clientAdmins = [], isLoading: adminsLoading } = useClientAdmins(
    clientId,
    open,
  );

  useEffect(() => {
    if (!open) {
      setMessage("");
      setSuccess(null);
    }
  }, [open]);

  const submit = usePostSubmitForApproval();

  const preflight = useMemo(
    () =>
      runApprovalPreflight({
        post,
        variants,
        isHealthcare,
        mediaAssets,
        clientAdmins,
        clientSlug,
      }),
    [post, variants, isHealthcare, mediaAssets, clientAdmins, clientSlug],
  );

  const loading = adminsLoading || (isHealthcare && assetsLoading);
  const canSubmit = preflight.ok && !loading && !submit.isPending;

  const recipientEmails = useMemo(() => {
    return Array.from(
      new Set(
        clientAdmins
          .filter((a) => a.status === "active" || a.status === "invited")
          .map((a) => a.invited_email)
          .filter((e): e is string => !!e),
      ),
    );
  }, [clientAdmins]);

  const handleSubmit = async () => {
    try {
      const res = await submit.mutateAsync({
        postId,
        message: message.trim() || null,
        preflight: {
          post,
          variants,
          isHealthcare,
          mediaAssets,
          clientAdmins,
          clientSlug,
        },
      });
      setSuccess(res);
      if (res.emailed) {
        toast.success("Enviado al cliente");
      } else {
        toast.warning("Post listo, pero el email no se pudo enviar", {
          description: "Comparte el enlace manualmente desde la confirmación.",
        });
      }
    } catch (e: any) {
      if (e instanceof PreflightFailedError) {
        toast.error("Hay datos faltantes para enviar");
        return;
      }
      toast.error("No se pudo enviar", { description: e?.message });
    }
  };

  const goToAction = (path: string) => {
    onOpenChange(false);
    navigate(path);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        {success ? (
          <SubmitSuccessState
            response={success}
            clientName={clientName}
            workspaceName={workspaceName}
            message={message.trim() || null}
            onClose={() => onOpenChange(false)}
          />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Enviar a {clientName} para aprobación</DialogTitle>
              <DialogDescription>
                Se enviará un correo al cliente con un enlace al portal de aprobación.
              </DialogDescription>
            </DialogHeader>

            {loading ? (
              <div className="space-y-2 py-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : !preflight.ok ? (
              <div className="space-y-2 py-2">
                <p className="text-sm font-medium">
                  Antes de enviar, resuelve estos puntos:
                </p>
                <ul className="space-y-2">
                  {preflight.errors.map((err: PreflightError, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm"
                    >
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                      <div className="flex-1">
                        <p>{err.message}</p>
                        {err.action && (
                          <Button
                            variant="link"
                            size="sm"
                            className="h-auto p-0 text-xs"
                            onClick={() => goToAction(err.action!.path)}
                          >
                            {err.action.label} →
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="space-y-3 py-2">
                <div className="flex items-start gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <div className="flex-1">
                    <p className="font-medium">
                      Se enviará a {recipientEmails.length} admin
                      {recipientEmails.length === 1 ? "" : "s"} del cliente
                    </p>
                    {recipientEmails.length > 0 && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {recipientEmails.slice(0, 3).join(", ")}
                        {recipientEmails.length > 3 ? ` y ${recipientEmails.length - 3} más` : ""}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">
                    Mensaje al cliente <span className="text-muted-foreground">(opcional)</span>
                  </label>
                  <Textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value.slice(0, 300))}
                    placeholder="Ej: Este post es para la campaña de octubre, necesitamos aprobación antes del viernes."
                    rows={3}
                  />
                  <p className="text-right text-[11px] text-muted-foreground">
                    {message.length}/300
                  </p>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSubmit} disabled={!canSubmit}>
                {submit.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando…
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Enviar a cliente
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
