const SIZE = 140;
const STROKE = 12;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// Presentation-only tiering of the existing 0-100 readiness_score for a
// human-readable label under the gauge. Doesn't change or re-derive the
// score itself (that's computed heuristically on the backend).
function tierLabel(score: number): string {
  if (score >= 80) return "Ready to Publish";
  if (score >= 55) return "Needs Polish";
  return "High Risk";
}

export default function ReadinessGauge({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, score));
  const offset = CIRCUMFERENCE * (1 - clamped / 100);

  return (
    <div className="relative flex flex-col items-center">
      <svg width={SIZE} height={SIZE} className="-rotate-90">
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="#e5e5e5"
          strokeWidth={STROKE}
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="#262626"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold tabular-nums text-neutral-900">
          {Math.round(clamped)}
          <span className="text-base font-medium text-neutral-400">/100</span>
        </span>
      </div>
      <span className="mt-2 text-sm font-medium text-neutral-500">{tierLabel(clamped)}</span>
    </div>
  );
}
