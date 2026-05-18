import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";

/**
 * Ambient subscription: listens to social_posts UPDATE events in the active
 * workspace and invalidates calendar queries so all open views refresh in
 * real time when the client portal changes a post status.
 */
export function usePostStatusChanges(workspaceId: string | undefined) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!isSupabaseConfigured || !workspaceId) return;
    const channel = supabase
      .channel(`social_posts:ws:${workspaceId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "social_posts",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload: any) => {
          qc.invalidateQueries({ queryKey: ["social-posts"] });
          const id = payload?.new?.id;
          if (id) qc.invalidateQueries({ queryKey: ["post", id] });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [workspaceId, qc]);
}
