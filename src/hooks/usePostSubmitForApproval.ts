import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  runApprovalPreflight,
  type PreflightError,
  type PreflightInput,
} from "@/lib/preflight-approval";

export type ApprovalSendResponse = {
  emailed: boolean;
  sent?: number;
  failed?: number;
  skipped?: boolean;
  portalUrl?: string;
  recipientEmails?: string[];
  error?: string;
  results?: { email: string; messageId: string | null; error?: string }[];
};

export class PreflightFailedError extends Error {
  errors: PreflightError[];
  constructor(errors: PreflightError[]) {
    super("preflight_failed");
    this.errors = errors;
  }
}

export type SubmitInput = {
  postId: string;
  preflight: PreflightInput;
  message?: string | null;
};

export function usePostSubmitForApproval() {
  const qc = useQueryClient();
  return useMutation<ApprovalSendResponse, Error, SubmitInput>({
    mutationFn: async (input) => {
      const result = runApprovalPreflight(input.preflight);
      if (!result.ok) throw new PreflightFailedError(result.errors);

      const { data, error } = await supabase.functions.invoke(
        "send-content-approval-request",
        {
          body: {
            post_id: input.postId,
            source: "manual",
            message: input.message ?? null,
          },
        },
      );
      if (error) throw error;
      return (data ?? {}) as ApprovalSendResponse;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["social-posts"] });
      qc.invalidateQueries({ queryKey: ["post", vars.postId] });
      qc.invalidateQueries({ queryKey: ["post-approval-history", vars.postId] });
    },
  });
}
