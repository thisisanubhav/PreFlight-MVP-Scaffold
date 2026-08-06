from pydantic import BaseModel

from app.models.signals import RetentionAnalysis

HEURISTIC_DISCLAIMER = (
    "PreFlight's scores and predictions come from a hand-tuned heuristic "
    "formula (pacing, audio energy, silence, speech pace/fluency, and hook "
    "pattern-matching), not a trained machine-learning model. Treat every "
    "number here as a rough, explainable estimate, not a data-backed "
    "prediction of real viewer behavior."
)


class GeminiCausalExplanation(BaseModel):
    """Raw structured output from the causal-explanation Gemini call."""

    causal_explanation: str
    concrete_fix: str


class GeminiHookAssessment(BaseModel):
    """Raw structured output from the hook-autopsy Gemini call."""

    assessment: str
    rewritten_opening_line: str


class CausalExplanation(BaseModel):
    start: float
    end: float
    transcript_excerpt: str
    causal_explanation: str
    concrete_fix: str


class HookAutopsy(BaseModel):
    hook_strength_score: float
    original_opening_line: str
    assessment: str
    rewritten_opening_line: str


class ReadinessScore(BaseModel):
    score: float
    hook_component: float
    curve_component: float
    audio_component: float


class FullReport(BaseModel):
    retention_analysis: RetentionAnalysis
    causal_explanation: CausalExplanation
    hook_autopsy: HookAutopsy
    readiness_score: ReadinessScore
    heuristic_disclaimer: str = HEURISTIC_DISCLAIMER
