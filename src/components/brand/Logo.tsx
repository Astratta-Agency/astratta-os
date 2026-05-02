interface LogoProps {
  variant?: "light" | "dark";
  className?: string;
  /** Render only the iconic "A" mark (for collapsed/compact contexts) */
  mark?: boolean;
}

export function Logo({ variant = "dark", className = "", mark = false }: LogoProps) {
  if (mark) {
    return (
      <div
        className={`relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-primary to-[hsl(245,87%,72%)] shadow-[0_4px_14px_-2px_hsl(245_87%_60%/0.55)] ${className}`}
        aria-label="Astratta"
      >
        <span className="font-display text-[20px] font-extrabold leading-none tracking-tight text-primary-foreground">
          A
        </span>
        <span aria-hidden className="absolute -right-1 -bottom-1 h-3 w-3 rounded-full bg-secondary/90" />
      </div>
    );
  }

  const src = variant === "light" ? "/astratta-logo-white.png" : "/astratta-logo.png";
  return (
    <div className={`flex items-center ${className}`}>
      <img
        src={src}
        alt="Astratta Agency"
        className="h-7 w-auto select-none object-contain"
        loading="eager"
        decoding="async"
        draggable={false}
      />
    </div>
  );
}
