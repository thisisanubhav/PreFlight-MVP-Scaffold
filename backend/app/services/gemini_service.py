"""Gemini text synthesis: causal explanation + fix for the top-risk segment,
and a hook autopsy (assessment + rewritten opening line) for the first 15s.

Both calls share SYSTEM_INSTRUCTION, which enforces two hard constraints
requested explicitly for this project:
  1. Never claim this is a trained ML model / learned from real viewer data
     -- PreFlight is a heuristic formula (see signals.py), and every piece
     of generated copy must say so or at least not contradict it.
  2. Never use "recovery" language. The retention curve is mathematically
     monotonically non-increasing (see signals.py section 3 "MONOTONICITY")
     -- a strong segment can only slow/flatten the decline rate, it cannot
     make retention go up. Generated copy must reflect that.

No numeric score in this file is AI-generated -- hook_strength_score and
the Publish Readiness Score are pure heuristic output from signals.py.
Gemini only writes the natural-language explanation, fix, assessment, and
rewritten line around numbers that already exist.
"""

from google import genai
from google.genai import types

from app.config import get_settings
from app.models.report import GeminiCausalExplanation, GeminiHookAssessment
from app.models.signals import HookAnalysis, TopRiskSegment

SYSTEM_INSTRUCTION = """You are PreFlight's report-writing assistant. PreFlight analyzes a draft \
YouTube video using a hand-tuned HEURISTIC formula (pacing, audio energy, silence, speech pace/\
fluency, and simple hook pattern-matching) -- it is NOT a trained machine-learning model and has \
NOT learned from real viewer behavior data. Never write or imply that this is a trained/AI-\
predicted result, a data-backed prediction, or anything learned from actual audience data. Always \
frame findings as estimates from a heuristic analysis.

The predicted retention curve can only ever decline or stay flat -- it is mathematically \
monotonically non-increasing, because viewers who drop off within a single view cannot "come \
back." When describing a segment with comparatively strong signals, say the decline rate SLOWS \
or FLATTENS there. NEVER say retention "recovers," "improves," "goes up," or that "viewers come \
back" -- none of those are things this model (or a real retention curve) can show.

Be concrete and specific to the actual transcript and signal values given to you. Do not give \
generic creator advice ("keep pacing tight," "hook your audience," "add more energy") that could \
apply to any video. Reference what is actually said/happening at that timestamp.

Write in plain, direct language a creator would read in a short report card, not academic or \
hedgy language."""


def _causal_explanation_prompt(top_risk: TopRiskSegment) -> str:
    factors = top_risk.contributing_factors
    return f"""Video segment {top_risk.start}s-{top_risk.end}s is PreFlight's single largest \
predicted drop-off point in this draft video.

Predicted audience remaining just before this segment: {top_risk.retention_before}%
Predicted audience remaining just after this segment: {top_risk.retention_after}%
(a heuristic-estimated drop of {top_risk.drop_pct} percentage points -- the steepest of any \
segment in this video)

What was said in this segment (transcribed; may be empty if it's mostly silence):
"{top_risk.transcript_excerpt}"

Heuristic signal readings for this segment (0=worst, 1=best, except disfluency_ratio which is \
0=best, 1=worst):
- pacing_score (visual cut frequency): {factors.get("pacing_score")}
- energy_score (relative audio loudness vs. this video's own baseline): {factors.get("energy_score")}
- quiet_score (inverse of dead-air/silence ratio): {factors.get("quiet_score")}
- speech_score (speaking pace + fluency): {factors.get("speech_score")}
- disfluency_ratio (fraction of words that are filler words like "um," "uh," "like," "so"): \
{factors.get("disfluency_ratio")}

Task: Return JSON with two fields:
- "causal_explanation": 1-2 plain-language sentences explaining WHY this specific segment likely \
loses viewers, grounded in the actual transcript text and signal readings above (e.g. call out \
dead air, filler-word rambling, or low energy -- whichever the numbers actually show).
- "concrete_fix": ONE specific, actionable fix a creator could actually apply to this segment \
before publishing (e.g. "Cut the {top_risk.end - top_risk.start:.0f}-second pause down to under a \
second" or "Cut the filler words down to a single clean sentence"). Not generic advice -- it must \
reference the actual content/timing above."""


def _hook_autopsy_prompt(hook: HookAnalysis) -> str:
    strong = ", ".join(hook.matched_strong_patterns) or "none"
    weak = ", ".join(hook.matched_weak_patterns) or "none"
    return f"""This is a "hook autopsy" of the first {hook.window_seconds:.0f} seconds of a draft \
YouTube video -- the single most important window for retention, since most early drop-off \
happens if viewers aren't hooked immediately.

Opening transcript (first {hook.window_seconds:.0f}s):
"{hook.opening_text}"

Heuristic hook_strength_score for this opening: {hook.hook_strength_score}/100
Matched strong hook patterns: {strong}
Matched weak/generic-opener patterns: {weak}
Speaking pace score (0=too slow/silent, 1=brisk): {hook.pace_score}
Audio energy score (0=flat, 1=energetic, relative to this video's own baseline): {hook.energy_score}

Task: Return JSON with two fields:
- "assessment": 1-2 plain-language sentences assessing why this opening scored what it did, \
grounded in the actual opening line and the pattern matches / pace / energy above. If \
hook_strength_score is comparatively strong, describe it as buying goodwill or softening the \
early decline rate -- never claim it makes retention "go up" or "recover."
- "rewritten_opening_line": ONE rewritten version of the opening line that would score as a \
stronger hook (more specific, more curiosity-driving, punchier) while staying truthful to the \
video's actual topic as shown in the transcript above."""


_client: genai.Client | None = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        settings = get_settings()
        _client = genai.Client(api_key=settings.gemini_api_key)
    return _client


def _generate_structured(prompt: str, response_schema: type) -> types.GenerateContentResponse:
    settings = get_settings()
    client = _get_client()
    return client.models.generate_content(
        model=settings.gemini_model,
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_INSTRUCTION,
            response_mime_type="application/json",
            response_schema=response_schema,
            temperature=0.4,
        ),
    )


def generate_causal_explanation(top_risk: TopRiskSegment) -> GeminiCausalExplanation:
    response = _generate_structured(_causal_explanation_prompt(top_risk), GeminiCausalExplanation)
    return response.parsed


def generate_hook_autopsy(hook: HookAnalysis) -> GeminiHookAssessment:
    response = _generate_structured(_hook_autopsy_prompt(hook), GeminiHookAssessment)
    return response.parsed
