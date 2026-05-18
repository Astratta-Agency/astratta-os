import { cn } from "@/lib/utils";
import { POST_STATE_META, type PostStatus } from "@/lib/post-states";

interface Props {
  status: PostStatus;
  size?: "sm" | "md";
  className?: string;
}

export function StateBadgePost({ status, size = "sm", className }: Props) {
  const m = POST_STATE_META[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-medium",
        size === "sm" ? "text-[11px]" : "text-xs",
        className,
      )}
      style={{ borderColor: `${m.color}55`, color: m.color, backgroundColor: `${m.color}14` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: m.color }} aria-hidden />
      {m.label}
    </span>
  );
}
