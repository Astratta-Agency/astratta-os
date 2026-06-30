interface Props {
  score: number | null;
  className?: string;
}

export function HealthScoreBar({ score, className }: Props) {
  if (score == null) {
    return (
      <div className={`flex items-center gap-2 ${className ?? ""}`}>
        <div className="h-2 w-24 overflow-hidden rounded-full bg-muted" />
        <span className="text-xs text-muted-foreground">Sin datos</span>
      </div>
    );
  }
  const clamped = Math.max(0, Math.min(100, score));
  const color =
    clamped >= 70
      ? "bg-emerald-500"
      : clamped >= 40
      ? "bg-amber-500"
      : "bg-rose-500";

  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
        <div className={`h-full ${color}`} style={{ width: `${clamped}%` }} />
      </div>
      <span className="w-8 text-xs font-medium tabular-nums text-muted-foreground">{clamped}</span>
    </div>
  );
}
