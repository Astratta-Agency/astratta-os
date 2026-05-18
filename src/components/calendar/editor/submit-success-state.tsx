import { useState } from "react";
import { CheckCircle2, Copy, Mail, Link2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ApprovalSendResponse } from "@/hooks/usePostSubmitForApproval";

interface Props {
  response: ApprovalSendResponse;
  clientName: string;
  workspaceName?: string;
  message: string | null;
  onClose: () => void;
}

export function SubmitSuccessState({
  response,
  clientName,
  workspaceName,
  message,
  onClose,
}: Props) {
  const { emailed, sent, portalUrl, recipientEmails } = response;
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState(false);

  const fullMessage = portalUrl
    ? [
        `Hola ${clientName},`,
        "",
        "Tienes un nuevo post pendiente de aprobación en el portal:",
        "",
        portalUrl,
        "",
        message ?? "",
        message ? "" : null,
        `— ${workspaceName ?? "Astratta Agency"}`,
      ]
        .filter((l) => l !== null)
        .join("\n")
    : "";

  const copyLink = async () => {
    if (!portalUrl) return;
    try {
      await navigator.clipboard.writeText(portalUrl);
      setCopiedLink(true);
      toast.success("Enlace copiado");
      setTimeout(() => setCopiedLink(false), 1800);
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(fullMessage);
      setCopiedMsg(true);
      toast.success("Mensaje copiado");
      setTimeout(() => setCopiedMsg(false), 1800);
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  if (emailed) {
    return (
      <>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            Enviado correctamente
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2 text-sm">
          <p>
            Se notificó por correo a {sent} admin{sent === 1 ? "" : "s"} del cliente.
          </p>
          {recipientEmails && recipientEmails.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {recipientEmails.join(", ")}
            </p>
          )}
          <p className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
            El correo puede tardar 1-2 minutos en llegar. El estado del post pasó a{" "}
            <strong>Esperando cliente</strong>.
          </p>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </>
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          Post listo, pero el email no se envió
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-3 py-2 text-sm">
        <p className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
          El estado del post pasó a <strong>Esperando cliente</strong>, pero el correo
          automático falló. Comparte el enlace manualmente con tu cliente.
        </p>

        {portalUrl && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Enlace al portal</label>
            <div className="flex gap-2">
              <Input value={portalUrl} readOnly className="font-mono text-xs" />
              <Button size="sm" variant="outline" onClick={copyLink}>
                {copiedLink ? <CheckCircle2 className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        )}

        {portalUrl && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Mensaje completo</label>
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-md border bg-muted/40 p-3 text-xs">
              {fullMessage}
            </pre>
            <Button size="sm" variant="outline" onClick={copyMessage} className="w-full">
              {copiedMsg ? (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              ) : (
                <Copy className="mr-2 h-4 w-4" />
              )}
              Copiar mensaje completo
            </Button>
          </div>
        )}
      </div>
      <DialogFooter>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogFooter>
    </>
  );
}
