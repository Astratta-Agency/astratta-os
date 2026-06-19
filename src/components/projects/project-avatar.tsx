import { cn } from "@/lib/utils";

interface Props {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  sm: "h-8 w-8 text-xs",
  md: "h-12 w-12 text-sm",
  lg: "h-20 w-20 text-lg",
};

export function ProjectAvatar({ name, size = "lg", className }: Props) {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-md bg-foreground font-semibold text-background",
        sizeMap[size],
        className,
      )}
      aria-label={`${name} avatar`}
    >
      {initials || "?"}
    </div>
  );
}
