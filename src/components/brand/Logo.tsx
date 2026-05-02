interface LogoProps {
  variant?: "light" | "dark";
  className?: string;
}

export function Logo({ variant = "dark", className = "" }: LogoProps) {
  const color = variant === "light" ? "text-white" : "text-foreground";
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
        <span className="font-display text-lg font-extrabold leading-none text-primary-foreground">A</span>
      </div>
      <span className={`font-display text-lg font-extrabold tracking-tight ${color}`}>
        Astratta<span className="text-secondary">.</span>
      </span>
    </div>
  );
}
