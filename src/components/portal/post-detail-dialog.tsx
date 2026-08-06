import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ApprovalCard } from "@/components/portal/approval-card";
import { usePortalPostDetail } from "@/hooks/portal/usePendingApprovals";

interface Props {
  postId: string | null;
  clientId: string;
  role: "client_admin" | "client_viewer";
  onOpenChange: (open: boolean) => void;
}

/**
 * Read/act-on-a-post dialog used wherever a post is clicked outside the
 * Aprobaciones tabs (currently: Calendario). Reuses ApprovalCard so the
 * detail view — media, variants, comments, and (for pending posts, when
 * the viewer is a client_admin) approve/reject actions — stays identical
 * to what's shown in Aprobaciones.
 */
export function PostDetailDialog({ postId, clientId, role, onOpenChange }: Props) {
  const { data: post, isLoading } = usePortalPostDetail(postId ?? undefined);

  return (
    <Dialog open={!!postId} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto p-0 gap-0">
        <DialogTitle className="sr-only">
          {post?.title ?? "Detalle del post"}
        </DialogTitle>
        {isLoading || !post ? (
          <div className="space-y-3 p-6">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : (
          <ApprovalCard
            post={post}
            clientId={clientId}
            role={role}
            readonly={post.status !== "pending_approval"}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
