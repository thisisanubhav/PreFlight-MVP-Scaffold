"""
signals.py -- Heuristic signal extraction and predicted retention curve.

THIS IS A HEURISTIC MODEL, NOT A TRAINED ML MODEL. Every formula below is a
hand-tuned rule of thumb based on common creator advice about pacing,
delivery, and hooks -- none of it is learned from real viewer-behavior data.
Treat every number this module produces as a rough, explainable estimate,
never as a prediction backed by actual audience data. This distinction must
stay explicit in any user-facing copy that surfaces these numbers.

================================================================================
1. SEGMENTATION
================================================================================
The video timeline is divided into fixed SEGMENT_SECONDS (5s) windows,
aligned with the periodic keyframe sampling interval in ffmpeg_service.py.
Segment i covers [i * SEGMENT_SECONDS, (i+1) * SEGMENT_SECONDS).

================================================================================
2. PER-SEGMENT SIGNALS
================================================================================
Four component scores are computed per segment, each normalized to 0..1
where 1 = "healthy" (low risk) and 0 = "unhealthy" (high risk):

  a) pacing_score -- visual cut frequency
     scene_cut_count = number of `scene_cut` keyframes (see
     ffmpeg_service.extract_keyframes) whose timestamp falls in the segment.
     pacing_score = min(scene_cut_count / 1, 1.0)
     i.e. one or more cuts in a 5s segment scores the max (1.0); zero cuts
     scores 0.0. IMPORTANT: a 0.0 pacing_score does NOT mean "bad video" --
     many good talking-head videos have zero cuts throughout. This is why
     pacing gets the SMALLEST weight (WEIGHT_PACING) of the four signals.

  b) energy_score -- relative loudness
     The audio waveform is chunked into SUBFRAME_MS (100ms) windows; each
     window's RMS amplitude is computed and normalized to 0..1 of int16
     full-scale. A per-video reference loudness is the 90th percentile RMS
     across the WHOLE clip, so the score is relative to this speaker's own
     mic gain/room, not an absolute loudness threshold.
     energy_score = clamp(mean(subframe RMS in segment) / reference_p90, 0, 1)

  c) silence_ratio / quiet_score -- dead air
     silence_ratio = fraction of subframes in the segment whose RMS is below
     SILENCE_RMS_THRESHOLD (0.02, roughly -34 dBFS on a normalized scale).
     quiet_score = 1 - silence_ratio  (1 = no dead air, 0 = entirely silent)

  d) speech_score -- pace + fluency of delivery
     Whisper runs with word_timestamps=True, so every word carries its own
     real start/end time (not interpolated). Each segment's words are
     selected by exact per-word start time falling in [seg_start, seg_end)
     -- NOT by bucketing a whole multi-word Whisper entry into whichever
     segment contains its midpoint. A single Whisper entry routinely spans
     10+ seconds of uncut speech; midpoint bucketing would credit all of it
     (including the displayed transcript text) to one segment while making
     the segments on either side look like silent dead air and duplicating
     the same sentence into multiple segments' text -- both wrong. Per-word
     timing means a sentence spanning a segment boundary is split cleanly
     at the boundary, with no duplication and no approximation needed.
     words_per_second = (word count in this segment) / SEGMENT_SECONDS.
     pace_score = clamp((words_per_second - MIN_WPS) / (MAX_WPS - MIN_WPS), 0, 1)
       MIN_WPS = 0.3 (near-total silence -> 0), MAX_WPS = 2.5 (brisk
       conversational pace -> 1), linearly interpolated and clamped.
     disfluency_ratio = (filler-word/phrase count in this segment) /
       (word count in this segment). Filler set: {um, uh, like, so,
       actually, basically, literally, "kind of", "sort of", "i guess",
       "you know"} -- a crude, text-only heuristic; real disfluency
       detection needs prosody (pauses, pitch), not just word matching.
       Cheap and directionally useful for a hackathon demo, not a precise
       measurement.
     fluency_score = 1 - min(disfluency_ratio * DISFLUENCY_PENALTY_SCALE, 1.0)
       DISFLUENCY_PENALTY_SCALE = 2.0, so a disfluency_ratio of 0.5+ (half
       the words in a segment being filler) maxes out the penalty.
     speech_score = 0.6 * pace_score + 0.4 * fluency_score

================================================================================
3. SEGMENT RISK -> RETENTION DROP
================================================================================
segment_risk = 1 - (
    WEIGHT_PACING * pacing_score +
    WEIGHT_ENERGY * energy_score +
    WEIGHT_QUIET  * quiet_score  +
    WEIGHT_SPEECH * speech_score
)
  WEIGHT_PACING = 0.15   (visual cuts matter least -- many good videos are
                          entirely static shots, e.g. this test clip)
  WEIGHT_ENERGY = 0.25
  WEIGHT_QUIET  = 0.25
  WEIGHT_SPEECH = 0.35   (delivery pace/fluency matters most -- it is the
                          dominant signal for talking-head content with no
                          cuts at all)
  (weights sum to 1.0; segment_risk lands in [0, 1])

predicted_drop_pct for the segment:
  drop_pct = (BASE_DROP_PCT + segment_risk * MAX_EXTRA_DROP_PCT) * duration_fraction
    BASE_DROP_PCT = 0.4       (a small drop every full segment -- even a
                                great video leaks a few viewers over time)
    MAX_EXTRA_DROP_PCT = 4.5  (worst-case additional drop when every signal
                                is maximally bad, for a full segment)
    duration_fraction = (segment_end - segment_start) / SEGMENT_SECONDS
      Only the final segment of a video is ever shorter than
      SEGMENT_SECONDS (duration isn't always a multiple of 5s). Without
      this scaling, a 1-second trailing sliver of silence would be scored
      as if it were a full 5 seconds of dead air and could dominate the
      "top risk" finding despite representing very little actual video
      time -- duration_fraction keeps a segment's drop proportional to how
      much of the timeline it actually covers.
  -> drop_pct ranges from 0.4 (perfect full segment) to 4.9 (worst full
     segment), scaled down for any shorter trailing segment.

HOOK ADJUSTMENT (first HOOK_WINDOW_SECONDS = 15s only): segments starting
before 15s have their drop_pct multiplied by a factor derived from
hook_strength_score (section 4):
  hook_multiplier = 1.8 - (hook_strength_score / 100) * 1.3
    hook_strength_score = 100 -> multiplier 0.5 (drop halved: a strong hook
                                                   buys forgiveness)
    hook_strength_score = 0   -> multiplier 1.8 (drop nearly doubled: the
                                                   classic 15-second cliff)
  This models the well-known steep early drop-off when a video's opening
  fails to hook viewers, and the softer decline when it succeeds.

retention[0] = 100.0
retention[i+1] = max(0.0, retention[i] - drop_pct_i)

MONOTONICITY (by design, not a bug): drop_pct has a floor of
BASE_DROP_PCT * duration_fraction and there is no term anywhere that adds
audience back, so retention_curve is guaranteed monotonically
non-increasing -- exactly like a real YouTube Audience Retention graph,
where viewers who drop off within a view do not un-drop. A "good" segment
(e.g. strong energy, fluent, on-pace) still produces a small positive
drop_pct -- it just flattens the slope relative to a worse segment. Any
copy generated from this data (including the Phase 4 Gemini prompts) must
describe strong segments as "the decline rate slows/flattens here", never
as "retention recovers" or "viewers come back" -- the latter is not a
behavior this model can produce and would misrepresent what the curve
shows.

================================================================================
4. HOOK STRENGTH (first HOOK_WINDOW_SECONDS = 15s)
================================================================================
hook_strength_score (0-100) = round(100 * (
    0.5  * pattern_score_norm +
    0.25 * pace_score_first15 +
    0.25 * energy_score_first15
))
  pattern_score_norm: the opening transcript text is checked against a
  hardcoded set of STRONG_HOOK_PATTERNS (contrarian openers like "most
  people think X, it's not", direct questions, "stop doing X", numbered-list
  hooks, "here's why/how") and WEAK_HOOK_PATTERNS (generic "hey guys",
  "welcome back", "so today", "in this video I'm going to..." throat-
  clearing). Each strong match adds +1, each weak match subtracts 1; the
  raw sum is clamped to [-2, 2] then normalized to 0..1 via (raw + 2) / 4.
  pace_score_first15 / energy_score_first15 reuse the per-segment
  pace_score / energy_score formulas above, computed over the whole 0-15s
  window instead of a single 5s segment.

================================================================================
5. TOP RISK SEGMENT
================================================================================
top_risk_segment = the segment with the single largest (retention[i] -
retention[i+1]), i.e. the steepest drop in the curve. Ties are broken by
earliest timestamp, since an earlier drop-off costs more viewers (more of
the audience is still around to lose).

================================================================================
6. PUBLISH READINESS SCORE (0-100)
================================================================================
Also a pure heuristic combination -- no AI/Gemini call is involved in this
number, only the signals already computed above.

readiness_score = round(
    WEIGHT_READINESS_HOOK  * hook_component  +
    WEIGHT_READINESS_CURVE * curve_component +
    WEIGHT_READINESS_AUDIO * audio_component
)
  hook_component  = hook_strength_score (0-100, section 4, as-is)
  curve_component = retention_curve[-1].predicted_audience_pct
    (the final predicted audience remaining, 0-100 -- the single most
    intuitive summary of "how bad was the overall decline")
  audio_component = 50 * mean(segment.energy_score for all segments)
                   + 50 * mean(segment.quiet_score for all segments)
    (average loudness consistency and lack of dead air across the whole
    video, both already 0..1 per segment; decoupled from speech CONTENT so
    it doesn't just re-measure what curve_component already captures)

  WEIGHT_READINESS_HOOK  = 0.30 (the single biggest lever on early
                                  drop-off, but only covers 15 of the video's
                                  seconds)
  WEIGHT_READINESS_CURVE = 0.45 (largest weight -- it's the only component
                                  that reflects the ENTIRE video's outcome)
  WEIGHT_READINESS_AUDIO = 0.25 (supporting signal: raw recording quality,
                                  independent of what's actually being said)
  (weights sum to 1.0)
================================================================================
"""

import re

import numpy as np

from app.models.signals import (
    HookAnalysis,
    RetentionAnalysis,
    RetentionPoint,
    SegmentSignal,
    TopRiskSegment,
)

SEGMENT_SECONDS = 5.0
HOOK_WINDOW_SECONDS = 15.0

SUBFRAME_MS = 100
SILENCE_RMS_THRESHOLD = 0.02
ENERGY_REFERENCE_PERCENTILE = 90

MIN_WPS = 0.3
MAX_WPS = 2.5
DISFLUENCY_PENALTY_SCALE = 2.0

WEIGHT_PACING = 0.15
WEIGHT_ENERGY = 0.25
WEIGHT_QUIET = 0.25
WEIGHT_SPEECH = 0.35

BASE_DROP_PCT = 0.4
MAX_EXTRA_DROP_PCT = 4.5

WEIGHT_READINESS_HOOK = 0.30
WEIGHT_READINESS_CURVE = 0.45
WEIGHT_READINESS_AUDIO = 0.25

FILLER_TOKENS = {
    "um", "uh", "like", "so", "actually", "basically", "literally",
}
FILLER_PHRASES = ["kind of", "sort of", "i guess", "you know"]

STRONG_HOOK_PATTERNS: list[tuple[str, str]] = [
    (r"\b(most|everyone|nobody|no one)\b.*\b(thinks?|believes?|assumes?)\b", "contrarian opener"),
    (r"\bhere'?s (why|how)\b", "here's why/how"),
    (r"^\s*(why|what|how|who|when)\b.*\?", "opening question"),
    (r"\bstop\b.*\b(doing|using|thinking)\b", "stop-doing-X"),
    (r"\b\d+\s+(ways|reasons|mistakes|things|tips|secrets)\b", "numbered list hook"),
    (r"\byou('re| are)\b.*\bwrong\b", "you're wrong framing"),
]
WEAK_HOOK_PATTERNS: list[tuple[str, str]] = [
    (r"^\s*(hey|hi|what'?s up|yo)\b.*\b(guys|everyone|everybody)\b", "generic greeting"),
    (r"\bwelcome back\b", "welcome back"),
    (r"^\s*so today\b", "so today opener"),
    (r"\bin this video\b.*\b(i'?m going to|we'?re going to|i will)\b", "throat-clearing preview"),
    (r"^\s*(um|uh)\b", "starts with filler"),
]


def _subframe_rms(samples: np.ndarray, framerate: int) -> tuple[np.ndarray, float]:
    """RMS amplitude per SUBFRAME_MS window, normalized to 0..1 of int16 full-scale."""
    subframe_samples = max(1, int(framerate * SUBFRAME_MS / 1000))
    n_subframes = max(1, len(samples) // subframe_samples)
    trimmed = samples[: n_subframes * subframe_samples].astype(np.float64)
    chunks = trimmed.reshape(n_subframes, subframe_samples)
    rms = np.sqrt(np.mean(chunks**2, axis=1)) / 32768.0
    return rms, SUBFRAME_MS / 1000.0


def _segment_audio_scores(
    rms: np.ndarray, subframe_seconds: float, reference_p90: float, start: float, end: float
) -> tuple[float, float]:
    start_idx = int(start / subframe_seconds)
    end_idx = min(len(rms), max(start_idx + 1, int(end / subframe_seconds)))
    window = rms[start_idx:end_idx]
    if len(window) == 0:
        return 0.0, 1.0
    energy_score = float(np.clip(np.mean(window) / reference_p90, 0.0, 1.0)) if reference_p90 > 0 else 0.0
    silence_ratio = float(np.mean(window < SILENCE_RMS_THRESHOLD))
    return energy_score, silence_ratio


def _count_filler_words(text: str) -> tuple[int, int]:
    lowered = text.lower()
    words = re.findall(r"[a-z']+", lowered)
    filler_count = sum(1 for w in words if w in FILLER_TOKENS)
    for phrase in FILLER_PHRASES:
        filler_count += lowered.count(phrase)
    return filler_count, len(words)


def _pace_and_fluency(
    word_count: int, filler_count: int, duration: float
) -> tuple[float, float, float, float]:
    """Returns (words_per_second, pace_score, disfluency_ratio, fluency_score)."""
    wps = word_count / duration if duration > 0 else 0.0
    pace_score = float(np.clip((wps - MIN_WPS) / (MAX_WPS - MIN_WPS), 0.0, 1.0))
    disfluency_ratio = filler_count / word_count if word_count > 0 else 0.0
    fluency_score = 1.0 - min(disfluency_ratio * DISFLUENCY_PENALTY_SCALE, 1.0)
    return wps, pace_score, disfluency_ratio, fluency_score


def _match_hook_patterns(text: str) -> tuple[list[str], list[str], float]:
    lowered = text.lower()
    strong = [label for pattern, label in STRONG_HOOK_PATTERNS if re.search(pattern, lowered)]
    weak = [label for pattern, label in WEAK_HOOK_PATTERNS if re.search(pattern, lowered)]
    raw = np.clip(len(strong) - len(weak), -2, 2)
    pattern_score_norm = (raw + 2) / 4
    return strong, weak, float(pattern_score_norm)


def _flatten_words(transcript: list[dict]) -> list[dict]:
    """Flattens Whisper's sentence/phrase-level entries into a single,
    time-ordered list of individual words using their real per-word
    timestamps (whisper_service.transcribe runs with word_timestamps=True).

    Falls back to splitting an entry's text evenly across its [start, end)
    span only if that entry has no "words" field -- e.g. a transcript.json
    cached before this fallback was added -- so older cached jobs still
    degrade gracefully instead of crashing.
    """
    flat: list[dict] = []
    for entry in transcript:
        words = entry.get("words")
        if words:
            flat.extend(words)
            continue
        tokens = entry["text"].split()
        if not tokens:
            continue
        span = entry["end"] - entry["start"]
        step = span / len(tokens)
        for i, token in enumerate(tokens):
            flat.append(
                {"word": token, "start": entry["start"] + i * step, "end": entry["start"] + (i + 1) * step}
            )
    return flat


def _segment_transcript_stats(words: list[dict], start: float, end: float) -> tuple[str, int, int]:
    """Selects the words whose own start timestamp falls in [start, end).
    Because this operates on real per-word timing rather than whole
    sentence-level entries, a sentence spanning a segment boundary is
    correctly split between the two segments instead of being duplicated
    into both (word-level timing eliminates the need for any time-overlap
    apportionment approximation).

    Returns (display_text, word_count, filler_count).
    """
    in_range = [w["word"].strip() for w in words if start <= w["start"] < end]
    text = " ".join(w for w in in_range if w)
    filler_count, word_count = _count_filler_words(text)
    return text, word_count, filler_count


def _scene_cut_count_in_range(frames: list[dict], start: float, end: float) -> int:
    return sum(
        1
        for frame in frames
        if frame["type"] == "scene_cut" and start <= frame["timestamp"] < end
    )


def compute_hook_analysis(
    words: list[dict], rms: np.ndarray, subframe_seconds: float, reference_p90: float
) -> HookAnalysis:
    opening_text, word_count, filler_count = _segment_transcript_stats(
        words, 0.0, HOOK_WINDOW_SECONDS
    )
    strong, weak, pattern_score_norm = _match_hook_patterns(opening_text)
    energy_score, _silence_ratio = _segment_audio_scores(
        rms, subframe_seconds, reference_p90, 0.0, HOOK_WINDOW_SECONDS
    )
    _wps, pace_score, _disfluency_ratio, _fluency_score = _pace_and_fluency(
        word_count, filler_count, HOOK_WINDOW_SECONDS
    )
    hook_strength_score = round(
        100 * (0.5 * pattern_score_norm + 0.25 * pace_score + 0.25 * energy_score)
    )
    return HookAnalysis(
        window_seconds=HOOK_WINDOW_SECONDS,
        opening_text=opening_text,
        matched_strong_patterns=strong,
        matched_weak_patterns=weak,
        pattern_score_norm=round(pattern_score_norm, 3),
        pace_score=round(pace_score, 3),
        energy_score=round(energy_score, 3),
        hook_strength_score=float(hook_strength_score),
    )


def compute_retention_analysis(
    transcript: list[dict],
    frames: list[dict],
    audio_samples: np.ndarray,
    framerate: int,
    duration_seconds: float,
) -> RetentionAnalysis:
    rms, subframe_seconds = _subframe_rms(audio_samples, framerate)
    reference_p90 = float(np.percentile(rms, ENERGY_REFERENCE_PERCENTILE)) if len(rms) else 0.0
    words = _flatten_words(transcript)

    hook_analysis = compute_hook_analysis(words, rms, subframe_seconds, reference_p90)
    hook_multiplier = 1.8 - (hook_analysis.hook_strength_score / 100) * 1.3

    n_segments = max(1, int(np.ceil(duration_seconds / SEGMENT_SECONDS)))

    segments: list[SegmentSignal] = []
    retention_curve = [RetentionPoint(timestamp=0.0, predicted_audience_pct=100.0)]
    audience = 100.0

    for i in range(n_segments):
        start = i * SEGMENT_SECONDS
        end = min(duration_seconds, start + SEGMENT_SECONDS)

        scene_cut_count = _scene_cut_count_in_range(frames, start, end)
        pacing_score = min(scene_cut_count / 1.0, 1.0)

        energy_score, silence_ratio = _segment_audio_scores(
            rms, subframe_seconds, reference_p90, start, end
        )
        quiet_score = 1.0 - silence_ratio

        segment_text, word_count, filler_count = _segment_transcript_stats(words, start, end)
        wps, pace_score, disfluency_ratio, fluency_score = _pace_and_fluency(
            word_count, filler_count, end - start
        )
        speech_score = 0.6 * pace_score + 0.4 * fluency_score

        segment_risk = 1.0 - (
            WEIGHT_PACING * pacing_score
            + WEIGHT_ENERGY * energy_score
            + WEIGHT_QUIET * quiet_score
            + WEIGHT_SPEECH * speech_score
        )

        duration_fraction = (end - start) / SEGMENT_SECONDS
        drop_pct = (BASE_DROP_PCT + segment_risk * MAX_EXTRA_DROP_PCT) * duration_fraction
        hook_adjusted = start < HOOK_WINDOW_SECONDS
        if hook_adjusted:
            drop_pct *= hook_multiplier

        audience = max(0.0, audience - drop_pct)

        segments.append(
            SegmentSignal(
                start=start,
                end=end,
                transcript_text=segment_text,
                scene_cut_count=scene_cut_count,
                pacing_score=round(pacing_score, 3),
                energy_score=round(energy_score, 3),
                silence_ratio=round(silence_ratio, 3),
                quiet_score=round(quiet_score, 3),
                words_per_second=round(wps, 3),
                pace_score=round(pace_score, 3),
                disfluency_ratio=round(disfluency_ratio, 3),
                fluency_score=round(fluency_score, 3),
                speech_score=round(speech_score, 3),
                segment_risk=round(segment_risk, 3),
                drop_pct=round(drop_pct, 3),
                hook_adjusted=hook_adjusted,
            )
        )
        retention_curve.append(
            RetentionPoint(timestamp=round(end, 2), predicted_audience_pct=round(audience, 2))
        )

    steepest_idx = max(
        range(len(segments)),
        key=lambda i: retention_curve[i].predicted_audience_pct
        - retention_curve[i + 1].predicted_audience_pct,
    )
    steepest = segments[steepest_idx]
    top_risk_segment = TopRiskSegment(
        start=steepest.start,
        end=steepest.end,
        drop_pct=steepest.drop_pct,
        retention_before=retention_curve[steepest_idx].predicted_audience_pct,
        retention_after=retention_curve[steepest_idx + 1].predicted_audience_pct,
        transcript_excerpt=steepest.transcript_text,
        contributing_factors={
            "pacing_score": steepest.pacing_score,
            "energy_score": steepest.energy_score,
            "quiet_score": steepest.quiet_score,
            "speech_score": steepest.speech_score,
            "disfluency_ratio": steepest.disfluency_ratio,
        },
    )

    return RetentionAnalysis(
        duration_seconds=round(duration_seconds, 2),
        segments=segments,
        retention_curve=retention_curve,
        hook_analysis=hook_analysis,
        top_risk_segment=top_risk_segment,
    )


def compute_readiness_score(retention_analysis: RetentionAnalysis) -> tuple[float, float, float, float]:
    """Publish Readiness Score (section 6). Pure heuristic, no AI call.

    Returns (score, hook_component, curve_component, audio_component).
    """
    segments = retention_analysis.segments
    hook_component = retention_analysis.hook_analysis.hook_strength_score
    curve_component = retention_analysis.retention_curve[-1].predicted_audience_pct

    avg_energy = float(np.mean([s.energy_score for s in segments])) if segments else 0.0
    avg_quiet = float(np.mean([s.quiet_score for s in segments])) if segments else 0.0
    audio_component = 50 * avg_energy + 50 * avg_quiet

    score = round(
        WEIGHT_READINESS_HOOK * hook_component
        + WEIGHT_READINESS_CURVE * curve_component
        + WEIGHT_READINESS_AUDIO * audio_component
    )
    return float(score), round(hook_component, 2), round(curve_component, 2), round(audio_component, 2)
