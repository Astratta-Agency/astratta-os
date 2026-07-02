import { useState } from "react";
import { CalendarSync, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import {
  useGoogleCalendarStatus,
  useConnectGoogleCalendar,
  useDisconnectGoogleCalendar,
} from "@/hooks/useGoogleCalendar";
import { toast } from "sonner";

export function GoogleCalendarCard() {
  const { workspace } = useActiveWorkspace();
  const workspaceId = workspace?.id;
  const { data: status, isLoading } = useGoogleCalendarStatus(workspaceId);
  const connectMutation = useConnectGoogleCalendar();
  const disconnectMutation = useDisconnectGoogleCalendar();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleConnect = () => {
    if (!workspaceId) return;
    connectMutation.mutate(workspaceId, {
      onError: (e: any) => toast.error(e?.message ?? "No se pudo iniciar la conexión"),
    });
  };

  const handleDisconnect = () => {
    if (!workspaceId) return;
    disconnectMutation.mutate(workspaceId, {
      onSuccess: () => toast.success("Google Calendar desconectado"),
      onError: (e: any) => toast.error(e?.message ?? "No se pudo desconectar"),
    });
    setConfirmOpen(false);
  };

  const connected = !!status?.connected;
  const isActive = status?.is_active === true;
  const needsReconnect = connected && status?.is_active === false;

  return (
    <>
      <Card>
        <CardContent className="flex flex-col gap-3 p-5">
          <div className="flex items-start justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-md border bg-muted">
              <CalendarSync className="h-5 w-5" />
            </div>
            {isLoading ? (
              <Skeleton className="h-5 w-24" />
            ) : needsReconnect ? (
              <Badge variant="destructive">Reconexión necesaria</Badge>
            ) : connected && isActive ? (
              <Badge>Conectado</Badge>
            ) : (
              <Badge variant="secondary">No conectado</Badge>
            )}
          </div>

          <div>
            <h3 className="font-semibold text-foreground">Google Calendar</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Sincroniza tus tareas asignadas y el calendario de contenido con tu Google Calendar
              personal.
            </p>
          </div>

          {isLoading ? (
            <Skeleton className="h-9 w-32" />
          ) : needsReconnect ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Perdimos acceso a tu cuenta de Google. Reconectá para seguir sincronizando.
              </p>
              <Button
                size="sm"
                onClick={handleConnect}
                disabled={connectMutation.isPending || !workspaceId}
              >
                {connectMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Reconectar
              </Button>
            </div>
          ) : connected && isActive ? (
            <div className="space-y-2">
              {status?.google_email && (
                <p className="text-sm text-foreground">{status.google_email}</p>
              )}
              <p className="text-xs text-muted-foreground">
                {status?.last_synced_at
                  ? `Última sincronización: ${formatDistanceToNow(new Date(status.last_synced_at), {
                      addSuffix: true,
                      locale: es,
                    })}`
                  : "Aún no sincronizado — puede tardar hasta 5 minutos"}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="hover:bg-destructive hover:text-destructive-foreground hover:border-destructive"
                onClick={() => setConfirmOpen(true)}
                disabled={disconnectMutation.isPending}
              >
                {disconnectMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Desconectar
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handleConnect}
              disabled={connectMutation.isPending || !workspaceId}
              className="w-fit"
            >
              {connectMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Conectar
            </Button>
          )}

          <p className="text-xs text-muted-foreground border-t pt-3 mt-1">
            Los eventos se crean en un calendario secundario llamado "Astratta OS – Contenido y
            Tareas" dentro de tu cuenta de Google, no en tu calendario principal. La sincronización
            corre cada 5 minutos en ambas direcciones: si movés la fecha de un evento en Google
            Calendar, se refleja en Astratta OS.
          </p>
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desconectar Google Calendar?</AlertDialogTitle>
            <AlertDialogDescription>
              Dejaremos de sincronizar tus tareas y publicaciones con Google Calendar. Los eventos
              ya creados en tu calendario no se eliminan automáticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDisconnect}>Desconectar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
