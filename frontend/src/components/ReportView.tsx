"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getReport, type FullReport, type ReadinessScore } from "@/lib/api";
import AppShell from "@/components/AppShell";
import ReadinessGauge from "@/components/ReadinessGauge";
import RetentionChart from "@/components/RetentionChart";
import ScoreBreakdown from "@/components/ScoreBreakdown";
import CreatorChecklist from "@/components/CreatorChecklist";
import { InfoIcon, MicIcon, SparkleIcon, WarningIcon, WrenchIcon } from "@/components/icons";

type State =
  | { status: "loading" }
  | { status: "ready"; report: FullReport }
  | { status: "error"; message: string };

// --- Presentation-only helpers -------------------------------------------
// Everything below re-labels numbers the backend already computed (see
// signals.py) into short UI copy. None of it derives new scores — it only
// picks which existing number is worst to decide what headline/tag to show.

function riskHeadline(score: number): string {
  if (score >= 80) return "Low Risk Detected";
  if (score >= 55) return "Moderate Risk Detected";
  return "High Risk Detected";
}

function deriveTags(readiness: ReadinessScore): string[] {
  return [
    { label: "Hook Optimization", value: readiness.hook_component },
    { label: "Pacing", value: readiness.curve_component },
    { label: "Audio Quality", value: readiness.audio_component },
  ]
    .sort((a, b) => a.value - b.value)
    .slice(0, 2)
    .map((t) => t.label);
}

const FACTOR_LABELS: Record<string, string> = {
  quiet_score: "Dead Air",
  energy_score: "Low Energy",
  speech_score: "Rambling Delivery",
  pacing_score: "Static Pacing",
};

function riskShortName(factors: Record<string, number>): string {
  const goodness = Object.entries(factors)
    .filter(([key]) => key !== "disfluency_ratio")
    .map(([key, value]) => [key, value] as const);
  const [worstKey] = goodness.sort((a, b) => a[1] - b[1])[0] ?? ["quiet_score", 0];
  return FACTOR_LABELS[worstKey] ?? "Pacing Dip";
}
// ---------------------------------------------------------------------------

export default function ReportView({ jobId }: { jobId: string }) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [showFix, setShowFix] = useState(false);
  const [showMethodology, setShowMethodology] = useState(false);

  useEffect(() => {
    getReport(jobId)
      .then((report) => setState({ status: "ready", report }))
      .catch((err) =>
        setState({
          status: "error",
          message: err instanceof Error ? err.message : "Failed to load report",
        }),
      );
  }, [jobId]);

  if (state.status === "loading") {
    return (
      <AppShell>
        <p className="pt-16 text-center text-sm text-neutral-500">Loading report...</p>
      </AppShell>
    );
  }

  if (state.status === "error") {
    return (
      <AppShell>
        <div className="flex flex-col items-center gap-3 pt-16 text-center">
          <p className="text-sm text-yt-red-dark">{state.message}</p>
          <Link href="/" className="text-sm underline">
            Back to upload
          </Link>
        </div>
      </AppShell>
    );
  }

  const { report } = state;
  const { retention_analysis, causal_explanation, hook_autopsy, readiness_score } = report;
  const tags = deriveTags(readiness_score);
  const riskName = riskShortName(retention_analysis.top_risk_segment.contributing_factors);

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Publish Readiness</h1>
          <p className="text-sm text-neutral-400">
            A heuristic pre-publish analysis of your draft.
          </p>
        </div>

        {/* Score card */}
        <section className="flex flex-col items-center gap-5 rounded-3xl border border-neutral-200 bg-gradient-to-b from-white to-neutral-50 p-6 shadow-sm sm:flex-row sm:justify-center sm:gap-10">
          <ReadinessGauge score={readiness_score.score} />

          <div className="w-full">
            <h2 className="text-base font-semibold text-neutral-900">
              {riskHeadline(readiness_score.score)}
            </h2>
            <p className="mt-1 text-sm text-neutral-500">
              Score is {readiness_score.score}/100. The biggest issue found is between{" "}
              {causal_explanation.start}s&ndash;{causal_explanation.end}s &mdash; see below for
              details.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {tags.map((tag, i) => (
                <span
                  key={tag}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    i === 0 ? "bg-yt-red-light text-yt-red-dark" : "bg-neutral-100 text-neutral-600"
                  }`}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </section>

        <CreatorChecklist report={report} />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.8fr)] lg:items-start">
        {/* Retention curve */}
        <section className="flex flex-col gap-2 rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-neutral-900">
              Predicted Audience Retention
            </h2>
            <button
              onClick={() => setShowMethodology((v) => !v)}
              className="flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-600"
            >
              <InfoIcon className="h-3.5 w-3.5" />
              Methodology
            </button>
          </div>
          {showMethodology && (
            <p className="rounded-lg bg-neutral-50 p-3 text-xs text-neutral-500">
              {report.heuristic_disclaimer}
            </p>
          )}
          <RetentionChart analysis={retention_analysis} />
          <p className="text-xs text-neutral-400">
            Hover the curve to see the transcript at that moment.
          </p>
        </section>
        <ScoreBreakdown readiness={readiness_score} />
        </div>

        {/* Top risk callout */}
        <section className="rounded-3xl border border-neutral-200 border-l-4 border-l-yt-red bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-yt-red-dark">
            <WarningIcon className="h-5 w-5" />
            <h2 className="text-sm font-semibold">Top Risk: {riskName}</h2>
          </div>
          <p className="mt-2 text-sm text-neutral-700">{causal_explanation.causal_explanation}</p>

          {!showFix ? (
            <button
              onClick={() => setShowFix(true)}
              className="mt-4 flex items-center gap-1.5 rounded-full bg-yt-red px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-yt-red-dark"
            >
              <WrenchIcon className="h-3.5 w-3.5" />
              View Fix Suggestions
            </button>
          ) : (
            <div className="mt-4 rounded-lg bg-neutral-50 p-3">
              <p className="text-xs font-medium text-neutral-400">Suggested fix</p>
              <p className="mt-1 text-sm text-neutral-800">{causal_explanation.concrete_fix}</p>
            </div>
          )}
        </section>

        {/* Hook autopsy */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-neutral-900">Hook Autopsy</h2>
            <span className="text-sm font-semibold tabular-nums text-neutral-900">
              {hook_autopsy.hook_strength_score}/100
            </span>
          </div>
          <p className="-mt-1 text-sm text-neutral-500">{hook_autopsy.assessment}</p>

          <div className="rounded-xl border border-neutral-200 p-4">
            <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-neutral-400">
              <MicIcon className="h-3.5 w-3.5" />
              Your transcript
            </div>
            <p className="mt-2 text-sm italic text-neutral-700">
              &ldquo;{hook_autopsy.original_opening_line}&rdquo;
            </p>
          </div>

          <div className="rounded-xl border border-green-200 bg-green-50 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-green-700">
                <SparkleIcon className="h-3.5 w-3.5" />
                Suggested rewrite
              </div>
              <span className="rounded-full bg-green-200 px-2 py-0.5 text-[10px] font-semibold text-green-800">
                OPTIMIZED
              </span>
            </div>
            <p className="mt-2 text-sm text-green-900">
              &ldquo;{hook_autopsy.rewritten_opening_line}&rdquo;
            </p>
          </div>
        </section>

        <p className="pb-2 text-center text-xs text-neutral-400">
          PreFlight uses a heuristic analysis, not a trained predictive model.
        </p>
      </div>
    </AppShell>
  );
}
