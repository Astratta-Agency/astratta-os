import { HEALTH_LEVEL, healthLevel } from "@/lib/health";

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
  const level = HEALTH_LEVEL[healthLevel(clamped)];

  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`} title={level.label}>
      <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
        <div className={`h-full ${level.bar}`} style={{ width: `${clamped}%` }} />
      </div>
      <span className="w-8 text-xs font-medium tabular-nums text-muted-foreground">{clamped}</span>
    </div>
  );
}
