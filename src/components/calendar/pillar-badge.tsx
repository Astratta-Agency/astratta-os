import { cn } from "@/lib/utils";

interface Props {
  name: string;
  color?: string | null;
  size?: "sm" | "md";
  className?: string;
}

export function PillarBadge({ name, color, size = "sm", className }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 truncate rounded-full border bg-muted/40 px-2 py-0.5 text-foreground/80",
        size === "sm" ? "text-[11px]" : "text-xs",
        className,
      )}
    >
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: color || "hsl(var(--muted-foreground))" }}
        aria-hidden
      />
      <span className="truncate">{name}</span>
    </span>
  );
}
