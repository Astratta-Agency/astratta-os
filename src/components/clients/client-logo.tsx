import { cn } from "@/lib/utils";

interface Props {
  name: string;
  logoUrl?: string | null;
  brandColor?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  sm: "h-8 w-8 text-xs",
  md: "h-12 w-12 text-sm",
  lg: "h-20 w-20 text-lg",
};

export function ClientLogo({ name, logoUrl, brandColor, size = "md", className }: Props) {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={`${name} logo`}
        className={cn("rounded-md object-cover", sizeMap[size], className)}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-md font-semibold text-white",
        sizeMap[size],
        className,
      )}
      style={{ backgroundColor: brandColor || "hsl(var(--primary))" }}
      aria-label={`${name} logo placeholder`}
    >
      {initials || "?"}
    </div>
  );
}
