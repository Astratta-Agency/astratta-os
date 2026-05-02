interface LogoProps {
  variant?: "light" | "dark";
  className?: string;
}

export function Logo({ variant = "dark", className = "" }: LogoProps) {
  const src = variant === "light" ? "/astratta-logo-white.png" : "/astratta-logo.png";
  return (
    <div className={`flex items-center ${className}`}>
      <img
        src={src}
        alt="Astratta Agency"
        className="h-8 w-auto object-contain"
        loading="eager"
        decoding="async"
      />
    </div>
  );
}
