interface Props {
  score: number | null;
  size?: number;
  label?: string;
}

export function HealthScoreDial({ score, size = 64, label = "Health" }: Props) {
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const hasScore = score != null;
  const clamped = hasScore ? Math.max(0, Math.min(100, score)) : 0;
  const offset = c - (clamped / 100) * c;

  return (
    <div className="flex items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="hsl(var(--muted))"
            strokeWidth={stroke}
            fill="none"
          />
          {hasScore && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke="hsl(var(--primary))"
              strokeWidth={stroke}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={offset}
              className="transition-all duration-500"
            />
          )}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-foreground">
          {hasScore ? clamped : <span className="text-muted-foreground">—</span>}
        </div>
      </div>
      <div className="text-xs text-muted-foreground">
        <div>{label}</div>
        {!hasScore && <div className="text-[10px]">Sin datos aún</div>}
      </div>
    </div>
  );
}
