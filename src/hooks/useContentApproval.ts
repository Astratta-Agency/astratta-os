import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ApprovalSendResult = {
  emailed: boolean;
  sent: number;
  failed: number;
  skipped: boolean;
  reason?: string;
  results?: Array<{ email: string; messageId: string | null; error?: string }>;
  error?: string;
  recipient_count?: number;
  last_sent_at?: string;
};

/**
 * Requests approval for a social_posts row.
 *
 * Flow:
 *  1. If status != 'pending_approval', flip it (which fires the DB trigger
 *     and automatically calls send-content-approval-request).
 *  2. Call send-content-approval-request directly from the UI for immediate
 *     feedback. The 4h-window idempotency guard inside the Edge Function
 *     prevents duplicate sends from the trigger + manual call.
 *  3. Pass `force: true` to bypass the idempotency window (manual resend).
 */
export function useRequestContentApproval() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: { post_id: string; force?: boolean }): Promise<ApprovalSendResult> => {
      const { post_id, force = false } = input;

      // Read current status
      const { data: post, error: readErr } = await supabase
        .from("social_posts" as any)
        .select("id, status")
        .eq("id", post_id)
        .maybeSingle();
      if (readErr) throw readErr;
      if (!post) throw new Error("post_not_found");

      // Flip status if needed (DB trigger will also fire the Edge Function)
      if ((post as any).status !== "pending_approval") {
        const { error: updErr } = await supabase
          .from("social_posts" as any)
          .update({ status: "pending_approval" })
          .eq("id", post_id);
        if (updErr) throw updErr;
      }

      // Invoke for immediate feedback (idempotency-protected on the server)
      const { data, error } = await supabase.functions.invoke("send-content-approval-request", {
        body: { post_id, source: "manual", force },
      });
      if (error) {
        return {
          emailed: false,
          sent: 0,
          failed: 0,
          skipped: false,
          error: error.message,
        };
      }
      return data as ApprovalSendResult;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["social_posts", vars.post_id] });
      qc.invalidateQueries({ queryKey: ["content_approval_history", vars.post_id] });
    },
  });
}
