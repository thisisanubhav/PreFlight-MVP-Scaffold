"use client";

import { useEffect, useMemo, useState } from "react";
import StageProgress from "@/components/StageProgress";
import type { JobStage } from "@/lib/api";

const STAGE_DETAILS: Partial<Record<JobStage, { description: string; eta: number }>> = {
  queued: { description: "Preparing a private workspace for your draft.", eta: 55 },
  extracting_audio: { description: "Separating the audio track to measure energy and silence.", eta: 48 },
  extracting_frames: { description: "Sampling visual moments to check pacing and scene changes.", eta: 38 },
  transcribing: { description: "Turning the spoken track into timestamped text.", eta: 26 },
  analyzing_signals: { description: "Scoring delivery, pacing, hook strength, and likely drop-offs.", eta: 15 },
  generating_report: { description: "Writing your focused pre-publish checklist.", eta: 7 },
};

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return minutes ? `${minutes}m ${remainder}s` : `${remainder}s`;
}

export default function ProcessingCard({
  stage,
  onCancel,
}: {
  stage: JobStage;
  onCancel: () => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  const detail = STAGE_DETAILS[stage] ?? STAGE_DETAILS.queued;
  const remaining = useMemo(() => Math.max(3, (detail?.eta ?? 45) - Math.min(elapsed, 20)), [detail, elapsed]);

  useEffect(() => {
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm">
      <div className="relative overflow-hidden bg-neutral-900 px-6 py-7 text-center text-white">
        <div className="absolute -right-8 -top-10 h-28 w-28 rounded-full border-[14px] border-yt-red/80" />
        <p className="relative text-xs font-bold uppercase tracking-[0.18em] text-neutral-400">Analysis in progress</p>
        <h1 className="relative mt-2 text-2xl font-black">Building your PreFlight report</h1>
        <p className="relative mx-auto mt-2 max-w-sm text-sm leading-6 text-neutral-300">{detail?.description}</p>
        <div className="relative mt-5 flex items-center justify-center gap-3 text-xs">
          <span className="rounded-full bg-white/10 px-3 py-1.5 text-neutral-200">{formatDuration(elapsed)} elapsed</span>
          <span className="rounded-full bg-yt-red px-3 py-1.5 font-semibold text-white">~{formatDuration(remaining)} remaining</span>
        </div>
      </div>

      <div className="p-6">
        <StageProgress currentStage={stage} />

      <div className="mt-5 flex items-center justify-between border-t border-neutral-100 pt-4">
        <span className="text-xs text-neutral-400">You can keep working — we’ll finish the report here.</span>
        <button
          onClick={onCancel}
          className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:border-neutral-400 hover:bg-neutral-50"
        >
          Cancel Processing
        </button>
      </div>
      </div>
    </div>
  );
}
