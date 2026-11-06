import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNotificationPreferences, type NotificationEventType } from "@/hooks/useWorkspaceSettings";
import {
  getDesktopPermission,
  shouldShowDesktopNotification,
  showDesktopNotification,
} from "@/lib/desktop-notifications";

export type NotificationType =
  | "post_approved"
  | "post_rejected"
  | "post_changes_requested"
  | "invite_accepted"
  | "payment_received"
  | "contract_expiring"
  | "invoice_sent"
  | "invoice_paid"
  | "invoice_overdue"
  | "invoice_payment_failed"
  | "new_lead"
  | "proposal_signed"
  | "task_assigned"
  | "contract_signed";

export type NotificationRow = {
  id: string;
  workspace_id: string;
  recipient_user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  read_at: string | null;
  metadata: Record<string, any>;
  created_at: string;
};

export function useNotifications() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: prefs } = useNotificationPreferences(user?.id);

  // Read inside the realtime callback without resubscribing on every change.
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  const query = useQuery<NotificationRow[]>({
    queryKey: ["notifications", user?.id],
    enabled: !!user?.id && isSupabaseConfigured,
    staleTime: 15_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) {
        // Table may not exist yet (migration 011 not applied) — fail soft.
        return [];
      }
      return (data ?? []) as NotificationRow[];
    },
  });

  useEffect(() => {
    if (!isSupabaseConfigured || !user?.id) return;
    const channel = supabase
      .channel(`notifications:user:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `recipient_user_id=eq.${user.id}`,
        },
        (payload) => {
          qc.invalidateQueries({ queryKey: ["notifications", user.id] });
          const row = payload.new as NotificationRow | undefined;
          if (!row) return;
          const pushEnabled =
            prefsRef.current?.[row.type as NotificationEventType]?.push ?? false;
          if (
            shouldShowDesktopNotification({
              pushEnabled,
              permission: getDesktopPermission(),
              documentHidden: document.hidden,
            })
          ) {
            showDesktopNotification({
              id: row.id,
              title: row.title,
              body: row.body,
              onClick: row.link ? () => navigateRef.current(row.link!) : undefined,
            });
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id, qc]);

  const items = query.data ?? [];
  const unreadCount = items.filter((n) => !n.read).length;

  return { ...query, items, unreadCount };
}

export function useMarkNotificationRead() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("notifications")
        .update({ read: true, read_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications", user?.id] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!user?.id) return;
      const { error } = await (supabase as any)
        .from("notifications")
        .update({ read: true, read_at: new Date().toISOString() })
        .eq("recipient_user_id", user.id)
        .eq("read", false);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications", user?.id] });
    },
  });
}
