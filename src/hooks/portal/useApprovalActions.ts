import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Base = { postId: string; clientId: string };

async function insertHistory(args: {
  postId: string;
  clientId: string;
  action: "approved" | "rejected" | "changes_requested";
  comment?: string | null;
  actorUserId: string;
}) {
  const { error } = await (supabase as any).from("content_approval_history").insert({
    post_id: args.postId,
    client_id: args.clientId,
    action: args.action,
    actor_user_id: args.actorUserId,
    comment: args.comment ?? null,
  });
  if (error) throw error;
}

export function useApprovalActions(clientId: string | undefined) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["portal-approvals", clientId] });
    qc.invalidateQueries({ queryKey: ["portal-kpis", clientId] });
    qc.invalidateQueries({ queryKey: ["content_approval_history"] });
  };

  const approvePost = useMutation({
    mutationFn: async ({ postId }: Base & { comment?: string }) => {
      if (!user) throw new Error("not_authenticated");
      const { error } = await (supabase as any)
        .from("social_posts")
        .update({ status: "approved" })
        .eq("id", postId);
      if (error) throw error;
      await insertHistory({
        postId,
        clientId: clientId!,
        action: "approved",
        actorUserId: user.id,
      });
    },
    onSuccess: invalidate,
  });

  const requestChanges = useMutation({
    mutationFn: async ({ postId, comment }: Base & { comment: string }) => {
      if (!user) throw new Error("not_authenticated");
      const { error } = await (supabase as any)
        .from("social_posts")
        .update({ status: "changes_requested" })
        .eq("id", postId);
      if (error) throw error;
      await insertHistory({
        postId,
        clientId: clientId!,
        action: "changes_requested",
        comment,
        actorUserId: user.id,
      });
    },
    onSuccess: invalidate,
  });

  const rejectPost = useMutation({
    mutationFn: async ({ postId, reason }: Base & { reason: string }) => {
      if (!user) throw new Error("not_authenticated");
      const { error } = await (supabase as any)
        .from("social_posts")
        .update({ status: "rejected", rejection_reason: reason })
        .eq("id", postId);
      if (error) throw error;
      await insertHistory({
        postId,
        clientId: clientId!,
        action: "rejected",
        comment: reason,
        actorUserId: user.id,
      });
    },
    onSuccess: invalidate,
  });

  return { approvePost, requestChanges, rejectPost };
}
