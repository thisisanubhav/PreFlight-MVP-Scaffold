from pydantic import BaseModel


class SegmentSignal(BaseModel):
    start: float
    end: float
    transcript_text: str
    scene_cut_count: int
    pacing_score: float
    energy_score: float
    silence_ratio: float
    quiet_score: float
    words_per_second: float
    pace_score: float
    disfluency_ratio: float
    fluency_score: float
    speech_score: float
    segment_risk: float
    drop_pct: float
    hook_adjusted: bool


class RetentionPoint(BaseModel):
    timestamp: float
    predicted_audience_pct: float


class HookAnalysis(BaseModel):
    window_seconds: float
    opening_text: str
    matched_strong_patterns: list[str]
    matched_weak_patterns: list[str]
    pattern_score_norm: float
    pace_score: float
    energy_score: float
    hook_strength_score: float


class TopRiskSegment(BaseModel):
    start: float
    end: float
    drop_pct: float
    retention_before: float
    retention_after: float
    transcript_excerpt: str
    contributing_factors: dict[str, float]


class RetentionAnalysis(BaseModel):
    duration_seconds: float
    segments: list[SegmentSignal]
    retention_curve: list[RetentionPoint]
    hook_analysis: HookAnalysis
    top_risk_segment: TopRiskSegment
