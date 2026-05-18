import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PostStatus } from "@/lib/post-states";

interface Props {
  status: PostStatus;
  onClick: () => void;
  disabled?: boolean;
}

const SUBMITTABLE: PostStatus[] = ["draft", "pending_internal_review", "rejected"];

export function PostSubmitForApprovalButton({ status, onClick, disabled }: Props) {
  if (!SUBMITTABLE.includes(status)) return null;
  const label = status === "rejected" ? "Reenviar a cliente" : "Enviar a cliente";

  return (
    <Button
      size="sm"
      onClick={onClick}
      disabled={disabled}
      className="bg-secondary text-secondary-foreground hover:bg-secondary/90"
    >
      <Send className="mr-2 h-4 w-4" />
      {label}
    </Button>
  );
}
