import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface GoogleCalendarStatus {
  connected: boolean;
  google_email: string | null;
  last_synced_at: string | null;
  is_active: boolean | null;
  last_error: string | null;
}

export function useGoogleCalendarStatus(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["google_calendar_status", workspaceId],
    enabled: !!workspaceId,
    queryFn: async (): Promise<GoogleCalendarStatus> => {
      const { data, error } = await (supabase as any).rpc("get_my_google_calendar_status", {
        p_workspace_id: workspaceId,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) {
        return {
          connected: false,
          google_email: null,
          last_synced_at: null,
          is_active: null,
          last_error: null,
        };
      }
      return row as GoogleCalendarStatus;
    },
  });
}

export function useConnectGoogleCalendar() {
  return useMutation({
    mutationFn: async (workspaceId: string) => {
      const { data, error } = await supabase.functions.invoke("google-calendar-oauth-start", {
        body: { workspace_id: workspaceId },
      });
      if (error) throw error;
      if (!data?.url) throw new Error(data?.error ?? "No se pudo iniciar la conexión con Google");
      return data.url as string;
    },
    onSuccess: (url) => {
      window.location.href = url;
    },
  });
}

export function useDisconnectGoogleCalendar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (workspaceId: string) => {
      const { data, error } = await supabase.functions.invoke("google-calendar-disconnect", {
        body: { workspace_id: workspaceId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, workspaceId) => {
      queryClient.invalidateQueries({ queryKey: ["google_calendar_status", workspaceId] });
    },
  });
}
