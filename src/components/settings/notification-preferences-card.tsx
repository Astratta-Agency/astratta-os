import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import {
  NOTIFICATION_EVENTS,
  useNotificationPreferences,
  useUpdateNotificationPreference,
  type NotificationEventType,
} from "@/hooks/useWorkspaceSettings";

interface Props {
  workspaceId: string | undefined;
}

export function NotificationPreferencesCard({ workspaceId }: Props) {
  const { user } = useAuth();
  const userId = user?.id;
  const { data: prefs, isLoading } = useNotificationPreferences(userId);
  const updateMut = useUpdateNotificationPreference();

  const onToggle = async (eventType: NotificationEventType, checked: boolean) => {
    if (!userId || !workspaceId) return;
    try {
      await updateMut.mutateAsync({
        userId,
        workspaceId,
        eventType,
        in_app_enabled: checked,
      });
    } catch (e: any) {
      toast.error("No se pudo actualizar la preferencia", { description: e?.message });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Preferencias de notificaciones</CardTitle>
        <CardDescription>
          Elegí para qué eventos querés recibir notificaciones en la campana. Email y Push llegarán
          pronto.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading || !prefs ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Evento</th>
                  <th className="py-2 px-4 text-center font-medium">
                    <div className="flex flex-col items-center gap-1">
                      Email
                      <Badge variant="secondary" className="text-[10px]">
                        Próximamente
                      </Badge>
                    </div>
                  </th>
                  <th className="py-2 px-4 text-center font-medium">
                    <div className="flex flex-col items-center gap-1">
                      Push
                      <Badge variant="secondary" className="text-[10px]">
                        Próximamente
                      </Badge>
                    </div>
                  </th>
                  <th className="py-2 pl-4 text-center font-medium">In-app</th>
                </tr>
              </thead>
              <tbody>
                {NOTIFICATION_EVENTS.map((ev) => (
                  <tr key={ev.key} className="border-b last:border-b-0">
                    <td className="py-3 pr-4">{ev.label}</td>
                    <td className="py-3 px-4 text-center">
                      <Switch checked={false} disabled />
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Switch checked={false} disabled />
                    </td>
                    <td className="py-3 pl-4 text-center">
                      <Switch
                        checked={prefs[ev.key] ?? true}
                        onCheckedChange={(v) => onToggle(ev.key, v)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
