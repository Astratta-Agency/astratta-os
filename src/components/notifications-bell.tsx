import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Bell, Check, CheckCheck, Inbox } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

import {
  useNotifications,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  type NotificationType,
} from "@/hooks/useNotifications";

const TYPE_DOT: Record<NotificationType, string> = {
  post_approved: "bg-emerald-500",
  post_rejected: "bg-destructive",
  post_changes_requested: "bg-amber-500",
  invite_accepted: "bg-sky-500",
  payment_received: "bg-emerald-500",
  contract_expiring: "bg-amber-500",
};

export function NotificationsBell() {
  const navigate = useNavigate();
  const { items, unreadCount, isLoading } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const handleClick = async (id: string, link: string | null, read: boolean) => {
    if (!read) {
      try {
        await markRead.mutateAsync(id);
      } catch {
        /* ignore */
      }
    }
    if (link) navigate(link);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label="Notificaciones"
        >
          <Bell className="h-5 w-5 text-muted-foreground" />
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold">Notificaciones</p>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                {unreadCount} sin leer
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            disabled={unreadCount === 0 || markAllRead.isPending}
            onClick={() => markAllRead.mutate()}
          >
            <CheckCheck className="mr-1 h-3.5 w-3.5" />
            Marcar todas
          </Button>
        </div>

        <ScrollArea className="max-h-[420px]">
          {isLoading ? (
            <div className="px-3 py-8 text-center text-xs text-muted-foreground">
              Cargando…
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-3 py-10 text-center text-muted-foreground">
              <Inbox className="h-8 w-8 opacity-50" />
              <p className="text-sm">No tienes notificaciones</p>
            </div>
          ) : (
            <ul>
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => handleClick(n.id, n.link, n.read)}
                    className={`flex w-full items-start gap-3 border-b px-3 py-3 text-left text-sm transition-colors hover:bg-muted/60 ${
                      n.read ? "opacity-70" : "bg-primary/[0.03]"
                    }`}
                  >
                    <span
                      className={`mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full ${
                        TYPE_DOT[n.type] ?? "bg-muted-foreground"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className={`truncate text-sm ${
                          n.read ? "font-normal" : "font-semibold"
                        }`}
                      >
                        {n.title}
                      </p>
                      {n.body && (
                        <p className="line-clamp-2 text-xs text-muted-foreground">
                          {n.body}
                        </p>
                      )}
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(n.created_at), {
                          addSuffix: true,
                          locale: es,
                        })}
                      </p>
                    </div>
                    {!n.read && <Check className="mt-1 h-3.5 w-3.5 text-primary" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>

        <div className="border-t px-3 py-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs"
            disabled
            title="Próximamente"
          >
            Ver todas
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
