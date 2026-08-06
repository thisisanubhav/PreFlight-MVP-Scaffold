"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getReport, type FullReport } from "@/lib/api";
import RetentionChart from "@/components/RetentionChart";

type State =
  | { status: "loading" }
  | { status: "ready"; report: FullReport }
  | { status: "error"; message: string };

function scoreColor(score: number): string {
  if (score >= 70) return "text-green-600";
  if (score >= 40) return "text-amber-600";
  return "text-red-600";
}

export default function ReportView({ jobId }: { jobId: string }) {
  const [state, setState] = useState<State>({ status: "loading" });

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
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-neutral-500">Loading report...</p>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-sm text-red-600">{state.message}</p>
        <Link href="/" className="text-sm underline">
          Back to upload
        </Link>
      </div>
    );
  }

  const { report } = state;
  const { retention_analysis, causal_explanation, hook_autopsy, readiness_score } = report;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">PreFlight Report</h1>
        <Link href="/" className="text-sm text-neutral-500 underline">
          Analyze another video
        </Link>
      </div>

      {/* Readiness score */}
      <section className="flex flex-col items-center gap-1 rounded-xl border border-neutral-200 py-8 text-center">
        <span className="text-xs font-medium uppercase tracking-wide text-neutral-400">
          Publish Readiness Score
        </span>
        <span className={`text-6xl font-bold tabular-nums ${scoreColor(readiness_score.score)}`}>
          {readiness_score.score}
        </span>
        <span className="text-xs text-neutral-400">out of 100</span>
        <div className="mt-4 flex gap-6 text-xs text-neutral-500">
          <span>Hook {readiness_score.hook_component}</span>
          <span>Curve {readiness_score.curve_component}</span>
          <span>Audio {readiness_score.audio_component}</span>
        </div>
      </section>

      {/* Retention curve */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-neutral-700">
          Predicted Retention Curve ({retention_analysis.duration_seconds}s video)
        </h2>
        <RetentionChart analysis={retention_analysis} />
        <p className="text-xs text-neutral-400">
          Hover the curve to see the transcript at that moment. Shaded region marks the biggest
          predicted drop-off.
        </p>
      </section>

      {/* Top risk callout */}
      <section className="rounded-xl border border-red-200 bg-red-50 p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-red-700">
          Biggest Predicted Risk &middot; {causal_explanation.start}s&ndash;{causal_explanation.end}s
        </p>
        {causal_explanation.transcript_excerpt && (
          <p className="mt-2 text-sm italic text-red-900">
            &ldquo;{causal_explanation.transcript_excerpt}&rdquo;
          </p>
        )}
        <p className="mt-3 text-sm text-neutral-800">{causal_explanation.causal_explanation}</p>
        <div className="mt-3 rounded-lg bg-white/70 p-3">
          <p className="text-xs font-medium text-neutral-500">Fix</p>
          <p className="text-sm text-neutral-800">{causal_explanation.concrete_fix}</p>
        </div>
      </section>

      {/* Hook autopsy */}
      <section className="flex flex-col gap-3 rounded-xl border border-neutral-200 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-neutral-700">Hook Autopsy (first 15s)</h2>
          <span className="text-sm font-semibold tabular-nums">
            {hook_autopsy.hook_strength_score}/100
          </span>
        </div>
        <p className="text-sm text-neutral-600">{hook_autopsy.assessment}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-neutral-200 p-3">
            <p className="text-xs font-medium text-neutral-400">Original opening line</p>
            <p className="mt-1 text-sm">{hook_autopsy.original_opening_line}</p>
          </div>
          <div className="rounded-lg border border-green-200 bg-green-50 p-3">
            <p className="text-xs font-medium text-green-700">Suggested rewrite</p>
            <p className="mt-1 text-sm text-green-900">{hook_autopsy.rewritten_opening_line}</p>
          </div>
        </div>
      </section>

      <p className="text-center text-xs text-neutral-400">{report.heuristic_disclaimer}</p>
    </div>
  );
}
