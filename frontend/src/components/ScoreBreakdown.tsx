import type { ReadinessScore } from "@/lib/api";

const items: { key: keyof Omit<ReadinessScore, "score">; label: string; detail: string }[] = [
  { key: "hook_component", label: "Opening hook", detail: "First 15 seconds" },
  { key: "curve_component", label: "Retention curve", detail: "Across the draft" },
  { key: "audio_component", label: "Audio clarity", detail: "Energy and dead air" },
];

export default function ScoreBreakdown({ readiness }: { readiness: ReadinessScore }) {
  return (
    <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex items-baseline justify-between"><div><h2 className="text-base font-semibold text-neutral-900">Score breakdown</h2><p className="mt-1 text-xs text-neutral-400">The signals behind this readiness estimate.</p></div><span className="text-xs font-medium text-neutral-400">/100</span></div>
      <div className="mt-5 space-y-4">
        {items.map(({ key, label, detail }) => {
          const value = readiness[key];
          return <div key={key}><div className="mb-1.5 flex items-center justify-between gap-3 text-sm"><span className="font-medium text-neutral-700">{label}</span><span className="text-xs text-neutral-400">{detail} · <b className="font-semibold text-neutral-700">{Math.round(value)}</b></span></div><div className="h-2 overflow-hidden rounded-full bg-neutral-100"><div className="h-full rounded-full bg-neutral-800 transition-[width] duration-700" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div></div>;
        })}
      </div>
    </section>
  );
}
