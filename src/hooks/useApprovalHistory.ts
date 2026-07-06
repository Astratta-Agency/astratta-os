import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ApprovalHistoryAction =
  | "sent_for_approval"
  | "approved"
  | "rejected"
  | "changes_requested"
  | "resent"
  | "auto_expired";

export type ApprovalHistoryEntry = {
  id: string;
  post_id: string;
  client_id: string;
  action: ApprovalHistoryAction;
  comment: string | null;
  actor_user_id: string | null;
  actor_name: string | null;
  created_at: string;
};

/**
 * Approval timeline for a post (sent, approved, rejected, changes requested)
 * including the comments the client wrote. Works on both sides:
 * - Agency: RLS policy approval_history_workspace_select
 * - Portal: RLS policy approval_history_client_users_select
 */
export function useApprovalHistory(postId: string | undefined) {
  return useQuery<ApprovalHistoryEntry[]>({
    queryKey: ["content_approval_history", postId],
    enabled: !!postId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("content_approval_history")
        .select("id, post_id, client_id, action, comment, actor_user_id, created_at")
        .eq("post_id", postId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const rows = (data ?? []) as any[];

      // Resolve actor names (best effort — RLS may hide some profiles)
      const actorIds = Array.from(new Set(rows.map((r) => r.actor_user_id).filter(Boolean)));
      const nameMap = new Map<string, string>();
      if (actorIds.length > 0) {
        const { data: profs } = await (supabase as any)
          .from("profiles")
          .select("id, full_name, first_name, email")
          .in("id", actorIds);
        for (const p of (profs ?? []) as any[]) {
          const name = p.full_name || p.first_name || p.email?.split("@")[0];
          if (name) nameMap.set(p.id, name);
        }
      }

      return rows.map((r) => ({
        id: r.id,
        post_id: r.post_id,
        client_id: r.client_id,
        action: r.action as ApprovalHistoryAction,
        comment: r.comment ?? null,
        actor_user_id: r.actor_user_id ?? null,
        actor_name: r.actor_user_id ? nameMap.get(r.actor_user_id) ?? null : null,
        created_at: r.created_at,
      }));
    },
  });
}
