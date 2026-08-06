export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8001";

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/health`, { cache: "no-store" });
    if (!res.ok) return false;
    const data: { status: string } = await res.json();
    return data.status === "ok";
  } catch {
    return false;
  }
}

export interface AnalyzeResponse {
  job_id: string;
}

export async function uploadVideo(file: File): Promise<AnalyzeResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE_URL}/analyze`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    throw new Error(`Upload failed: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

export type JobStage =
  | "queued"
  | "extracting_audio"
  | "extracting_frames"
  | "transcribing"
  | "analyzing_signals"
  | "generating_report"
  | "done"
  | "error";

export interface JobStatusResponse {
  job_id: string;
  stage: JobStage;
  error_message: string | null;
}

export async function getJobStatus(jobId: string): Promise<JobStatusResponse> {
  const res = await fetch(`${API_BASE_URL}/status/${jobId}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Status check failed: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

export const STAGE_LABELS: Record<JobStage, string> = {
  queued: "Queued",
  extracting_audio: "Extracting audio",
  extracting_frames: "Extracting keyframes",
  transcribing: "Transcribing",
  analyzing_signals: "Analyzing pacing and predicting retention",
  generating_report: "Generating report",
  done: "Done",
  error: "Error",
};

// Ordered, user-facing subset of stages for the step indicator (queued/error
// are shown separately, not as steps in this progression).
export const STAGE_STEPS: { stage: JobStage; label: string }[] = [
  { stage: "extracting_audio", label: "Extracting audio" },
  { stage: "extracting_frames", label: "Extracting keyframes" },
  { stage: "transcribing", label: "Transcribing" },
  { stage: "analyzing_signals", label: "Analyzing pacing" },
  { stage: "generating_report", label: "Generating report" },
];

export interface SegmentSignal {
  start: number;
  end: number;
  transcript_text: string;
  scene_cut_count: number;
  pacing_score: number;
  energy_score: number;
  silence_ratio: number;
  quiet_score: number;
  words_per_second: number;
  pace_score: number;
  disfluency_ratio: number;
  fluency_score: number;
  speech_score: number;
  segment_risk: number;
  drop_pct: number;
  hook_adjusted: boolean;
}

export interface RetentionPoint {
  timestamp: number;
  predicted_audience_pct: number;
}

export interface HookAnalysis {
  window_seconds: number;
  opening_text: string;
  matched_strong_patterns: string[];
  matched_weak_patterns: string[];
  pattern_score_norm: number;
  pace_score: number;
  energy_score: number;
  hook_strength_score: number;
}

export interface TopRiskSegment {
  start: number;
  end: number;
  drop_pct: number;
  retention_before: number;
  retention_after: number;
  transcript_excerpt: string;
  contributing_factors: Record<string, number>;
}

export interface RetentionAnalysis {
  duration_seconds: number;
  segments: SegmentSignal[];
  retention_curve: RetentionPoint[];
  hook_analysis: HookAnalysis;
  top_risk_segment: TopRiskSegment;
}

export interface CausalExplanation {
  start: number;
  end: number;
  transcript_excerpt: string;
  causal_explanation: string;
  concrete_fix: string;
}

export interface HookAutopsy {
  hook_strength_score: number;
  original_opening_line: string;
  assessment: string;
  rewritten_opening_line: string;
}

export interface ReadinessScore {
  score: number;
  hook_component: number;
  curve_component: number;
  audio_component: number;
}

export interface FullReport {
  retention_analysis: RetentionAnalysis;
  causal_explanation: CausalExplanation;
  hook_autopsy: HookAutopsy;
  readiness_score: ReadinessScore;
  heuristic_disclaimer: string;
}

export async function getReport(jobId: string): Promise<FullReport> {
  const res = await fetch(`${API_BASE_URL}/report/${jobId}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Report fetch failed: ${res.status} ${res.statusText}`);
  }

  return res.json();
}
