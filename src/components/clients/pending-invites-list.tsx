import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Copy, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePendingInvites, useRevokeInvite } from "@/hooks/useClientDetail";
import { toast } from "@/hooks/use-toast";

export function PendingInvitesList({ clientId }: { clientId: string }) {
  const { data: invites } = usePendingInvites(clientId);
  const revoke = useRevokeInvite(clientId);

  if (!invites || invites.length === 0) return null;

  const portalUrl = `${window.location.origin}/portal/login`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(portalUrl);
      toast({ title: "Enlace copiado" });
    } catch {
      toast({ title: "No se pudo copiar", variant: "destructive" });
    }
  };

  return (
    <div className="mt-4 border-t border-border/50 pt-4">
      <div className="mb-2 flex items-center gap-2">
        <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Invitaciones pendientes
        </h4>
        <Badge variant="secondary" className="text-[10px]">{invites.length}</Badge>
      </div>
      <ul className="space-y-2">
        {invites.map((inv) => (
          <li key={inv.id} className="flex items-center justify-between gap-2 text-sm">
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{inv.invited_email}</div>
              <div className="text-xs text-muted-foreground">
                {inv.role === "client_admin" ? "Admin" : "Viewer"}
                {inv.invited_at && ` · ${formatDistanceToNow(new Date(inv.invited_at), { addSuffix: true, locale: es })}`}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" onClick={copyLink} title="Copiar enlace">
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => revoke.mutate(inv.id, { onSuccess: () => toast({ title: "Invitación revocada" }) })}
                title="Revocar"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
