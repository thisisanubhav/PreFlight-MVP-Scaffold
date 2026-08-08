import { AudioWaveIcon, ClockIcon, LockIcon } from "@/components/icons";

const benefits = [
  { icon: LockIcon, title: "Private by default", text: "Your draft is analyzed on your local setup." },
  { icon: ClockIcon, title: "Built for quick decisions", text: "A focused report for short-form review cycles." },
  { icon: AudioWaveIcon, title: "More than a transcript", text: "Pacing, delivery, silence, and hook signals in one view." },
];

export default function AnalysisBenefits() {
  return (
    <section className="grid gap-3 sm:grid-cols-3" aria-label="What PreFlight analyzes">
      {benefits.map(({ icon: Icon, title, text }) => (
        <article key={title} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-yt-red-light text-yt-red-dark"><Icon className="h-4.5 w-4.5" /></span>
          <h2 className="mt-3 text-sm font-semibold text-neutral-900">{title}</h2>
          <p className="mt-1 text-xs leading-5 text-neutral-500">{text}</p>
        </article>
      ))}
    </section>
  );
}
