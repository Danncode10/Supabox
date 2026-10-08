import { cn } from "@/lib/utils";

interface Props {
  /** 0..1 */
  value: number;
  size?: number;
  className?: string;
}

/** Compact circular progress with the percentage in the middle. Decorative: the surrounding text carries the numbers. */
export function ProgressRing({ value, size = 36, className }: Props) {
  const stroke = 3;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.min(1, Math.max(0, value));
  return (
    <span className={cn("relative inline-flex shrink-0 items-center justify-center", className)} style={{ width: size, height: size }} aria-hidden="true">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-border" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          className="stroke-primary transition-[stroke-dashoffset] duration-300 ease-out-strong motion-reduce:transition-none"
        />
      </svg>
      <span className="absolute font-mono text-[10px] font-medium tabular-nums text-foreground">{Math.round(v * 100)}</span>
    </span>
  );
}
