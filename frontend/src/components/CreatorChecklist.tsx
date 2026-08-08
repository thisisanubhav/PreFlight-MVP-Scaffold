"use client";

import { useState } from "react";
import type { FullReport } from "@/lib/api";
import { CheckIcon, ClipboardIcon, DownloadIcon } from "@/components/icons";

function makeChecklist(report: FullReport): string {
  const { readiness_score, causal_explanation, hook_autopsy, retention_analysis } = report;
  return `PREFLIGHT · CREATOR CHECKLIST\n\nPublish readiness: ${readiness_score.score}/100\nTop risk: ${causal_explanation.start}s–${causal_explanation.end}s (${retention_analysis.top_risk_segment.drop_pct}% estimated drop)\n\nBEFORE YOU PUBLISH\n[ ] Fix the top-risk moment: ${causal_explanation.concrete_fix}\n[ ] Review your first 15 seconds: ${hook_autopsy.assessment}\n[ ] Test this opening: “${hook_autopsy.rewritten_opening_line}”\n\nNote: PreFlight is a heuristic analysis, not a trained predictive model.`;
}

export default function CreatorChecklist({ report }: { report: FullReport }) {
  const [copied, setCopied] = useState(false);
  const checklist = makeChecklist(report);

  async function copyChecklist() {
    await navigator.clipboard.writeText(checklist);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function downloadChecklist() {
    const file = new Blob([checklist], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = "preflight-creator-checklist.txt";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="rounded-3xl border border-neutral-200 bg-neutral-900 p-5 text-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-neutral-400">Take it with you</p><h2 className="mt-1 text-lg font-bold">Creator checklist</h2></div>
        <span className="rounded-full bg-yt-red px-3 py-1 text-xs font-semibold">{report.readiness_score.score}/100 readiness</span>
      </div>
      <p className="mt-3 text-sm leading-6 text-neutral-300">Your three highest-value edits, condensed into a shareable pre-publish checklist.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={() => void copyChecklist()} className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-bold text-neutral-900 transition-colors hover:bg-neutral-200"><ClipboardIcon className="h-3.5 w-3.5" />{copied ? "Copied" : "Copy checklist"}</button>
        <button onClick={downloadChecklist} className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-white/10"><DownloadIcon className="h-3.5 w-3.5" />Download .txt</button>
      </div>
      {copied && <p className="mt-3 flex items-center gap-1.5 text-xs text-green-300"><CheckIcon className="h-3.5 w-3.5" />Checklist copied to your clipboard.</p>}
    </section>
  );
}
