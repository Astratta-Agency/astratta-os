import { Fragment, useState } from "react";
import { toast } from "sonner";
import { Bell, Mail, Monitor } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/hooks/useAuth";
import {
  NOTIFICATION_EVENT_GROUPS,
  NOTIFICATION_EVENTS,
  useNotificationPreferences,
  useUpdateNotificationPreferences,
  type NotificationChannel,
  type NotificationChannelPrefs,
  type NotificationEventType,
  type NotificationPreferencesMap,
} from "@/hooks/useWorkspaceSettings";
import {
  getDesktopPermission,
  requestDesktopPermission,
  type DesktopPermission,
} from "@/lib/desktop-notifications";
import { applyChannelChange } from "@/lib/notification-preferences";

interface Props {
  workspaceId: string | undefined;
}

const CHANNELS: { key: NotificationChannel; label: string; icon: typeof Bell }[] = [
  { key: "in_app", label: "In-app", icon: Bell },
  { key: "email", label: "Email", icon: Mail },
  { key: "push", label: "Escritorio", icon: Monitor },
];

export function NotificationPreferencesCard({ workspaceId }: Props) {
  const { user } = useAuth();
  const userId = user?.id;
  const { data: prefs, isLoading } = useNotificationPreferences(userId);
  const updateMut = useUpdateNotificationPreferences();
  const [permission, setPermission] = useState<DesktopPermission>(() => getDesktopPermission());

  const save = async (changes: { eventType: NotificationEventType; prefs: NotificationChannelPrefs }[]) => {
    if (!userId || !workspaceId || changes.length === 0) return;
    try {
      await updateMut.mutateAsync({ userId, workspaceId, changes });
    } catch (e: any) {
      toast.error("No se pudo guardar la preferencia", { description: e?.message });
    }
  };

  /** Makes sure the browser lets us show desktop alerts before turning them on. */
  const ensureDesktopPermission = async (): Promise<boolean> => {
    const result = await requestDesktopPermission();
    setPermission(result);
    if (result === "granted") return true;
    if (result === "unsupported") {
      toast.error("Este navegador no admite notificaciones de escritorio");
    } else {
      toast.error("El navegador bloqueó las notificaciones", {
        description: "Permitilas desde el candado de la barra de direcciones y volvé a intentarlo.",
      });
    }
    return false;
  };

  const onToggle = async (eventType: NotificationEventType, channel: NotificationChannel, value: boolean) => {
    if (!prefs) return;
    if (channel === "push" && value && !(await ensureDesktopPermission())) return;
    await save([{ eventType, prefs: applyChannelChange(prefs[eventType], channel, value) }]);
  };

  const onToggleColumn = async (channel: NotificationChannel, value: boolean) => {
    if (!prefs) return;
    if (channel === "push" && value && !(await ensureDesktopPermission())) return;
    await save(
      NOTIFICATION_EVENTS.map((ev) => ({
        eventType: ev.key,
        prefs: applyChannelChange(prefs[ev.key], channel, value),
      })),
    );
  };

  const columnState = (map: NotificationPreferencesMap, channel: NotificationChannel) => {
    const on = NOTIFICATION_EVENTS.filter((ev) => map[ev.key][channel]).length;
    return { all: on === NOTIFICATION_EVENTS.length, none: on === 0 };
  };

  const anyPush = prefs ? !columnState(prefs, "push").none : false;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Preferencias de notificaciones</CardTitle>
        <CardDescription>
          Elegí por dónde querés enterarte de cada evento. Los cambios se guardan al instante.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
          <li className="flex gap-2">
            <Bell className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <strong className="text-foreground">In-app:</strong> aparece en la campana.
            </span>
          </li>
          <li className="flex gap-2">
            <Mail className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <strong className="text-foreground">Email:</strong> llega a{" "}
              <span className="break-all">{user?.email ?? "tu email"}</span> en ~1 minuto.
            </span>
          </li>
          <li className="flex gap-2">
            <Monitor className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <strong className="text-foreground">Escritorio:</strong> aviso del sistema mientras
              Astratta OS está abierto en otra pestaña o ventana.
            </span>
          </li>
        </ul>

        {anyPush && permission !== "granted" && (
          <Alert>
            <Monitor className="h-4 w-4" />
            <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
              <span>
                {permission === "denied"
                  ? "El navegador bloqueó las notificaciones de escritorio. Permitilas desde el candado de la barra de direcciones."
                  : permission === "unsupported"
                    ? "Este navegador no admite notificaciones de escritorio."
                    : "Falta darle permiso al navegador para mostrar notificaciones de escritorio."}
              </span>
              {permission === "default" && (
                <Button size="sm" variant="outline" onClick={() => void ensureDesktopPermission()}>
                  Permitir
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}

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
                  <th className="py-2 pr-2 font-medium sm:pr-4">Evento</th>
                  {CHANNELS.map((ch) => {
                    const state = columnState(prefs, ch.key);
                    return (
                      <th key={ch.key} className="w-14 px-1 py-2 text-center font-medium sm:w-auto sm:px-3">
                        <div className="flex flex-col items-center gap-1.5">
                          <ch.icon className="h-4 w-4 sm:hidden" aria-label={ch.label} />
                          <span className="hidden sm:inline">{ch.label}</span>
                          <Switch
                            aria-label={`${ch.label}: activar o desactivar todos`}
                            checked={state.all}
                            className={!state.all && !state.none ? "opacity-60" : undefined}
                            onCheckedChange={(v) => void onToggleColumn(ch.key, v)}
                          />
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {NOTIFICATION_EVENT_GROUPS.map((group) => (
                  <Fragment key={group.label}>
                    <tr>
                      <td
                        colSpan={CHANNELS.length + 1}
                        className="pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                      >
                        {group.label}
                      </td>
                    </tr>
                    {group.events.map((ev) => (
                      <tr key={ev.key} className="border-b last:border-b-0">
                        <td className="py-3 pr-2 sm:pr-4">{ev.label}</td>
                        {CHANNELS.map((ch) => (
                          <td key={ch.key} className="px-1 py-3 text-center sm:px-3">
                            <Switch
                              aria-label={`${ev.label} — ${ch.label}`}
                              checked={prefs[ev.key][ch.key]}
                              onCheckedChange={(v) => void onToggle(ev.key, ch.key, v)}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-muted-foreground">
              Los avisos de escritorio necesitan In-app activo para ese evento: si apagás In-app,
              también se apaga Escritorio.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
