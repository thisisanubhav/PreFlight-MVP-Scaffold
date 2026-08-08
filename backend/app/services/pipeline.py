"""Orchestrates the Phase 2/3 processing pipeline as a FastAPI background task.

Each stage updates the job's `stage` column so the frontend can poll
GET /status/{job_id} and show progress.
"""

import json
import logging
import subprocess
import wave
from pathlib import Path

import numpy as np
from google.genai import errors as genai_errors

from app.db import get_session
from app.models.job import Job, JobStage
from app.models.report import CausalExplanation, FullReport, HookAutopsy, ReadinessScore
from app.services import ffmpeg_service, gemini_service, signals, storage, whisper_service

logger = logging.getLogger(__name__)


def _user_facing_error(exc: Exception) -> str:
    """Maps an internal exception to a short, safe message for the frontend.

    The full exception + traceback is always logged server-side (see the
    except block in run_pipeline) -- this function controls only what the
    client is allowed to see. Previously the raw Python traceback (file
    paths, library internals) was sent straight to the frontend and
    rendered verbatim in the UI.
    """
    if isinstance(exc, genai_errors.ClientError) and exc.code == 429:
        return (
            "The AI analysis service is temporarily rate-limited. "
            "Please try again in a few minutes."
        )
    if isinstance(exc, genai_errors.ServerError):
        return "The AI analysis service is temporarily unavailable. Please try again shortly."
    if isinstance(exc, genai_errors.APIError):
        return "The AI analysis service returned an error. Please try again."
    if isinstance(exc, subprocess.CalledProcessError):
        return "Failed to process the video file. Please check it's a valid video and try again."
    return "Something went wrong while analyzing your video. Please try again."


def _set_stage(job_id: str, stage: JobStage, error_message: str | None = None) -> None:
    session = get_session()
    try:
        job = session.get(Job, job_id)
        if job is None:
            return
        job.stage = stage
        job.error_message = error_message
        session.commit()
    finally:
        session.close()


def _load_wav(path: Path) -> tuple[np.ndarray, int]:
    with wave.open(str(path), "rb") as wf:
        framerate = wf.getframerate()
        raw = wf.readframes(wf.getnframes())
    samples = np.frombuffer(raw, dtype=np.int16)
    return samples, framerate


def run_pipeline(job_id: str, original_filename: str) -> None:
    try:
        video_path = storage.input_video_path(job_id, original_filename)

        _set_stage(job_id, JobStage.EXTRACTING_AUDIO)
        ffmpeg_service.extract_audio(video_path, storage.audio_path(job_id))

        _set_stage(job_id, JobStage.EXTRACTING_FRAMES)
        frames = ffmpeg_service.extract_keyframes(video_path, storage.frames_dir(job_id))
        storage.frame_index_path(job_id).write_text(json.dumps(frames, indent=2))

        _set_stage(job_id, JobStage.TRANSCRIBING)
        segments = whisper_service.transcribe(storage.audio_path(job_id))
        storage.transcript_path(job_id).write_text(json.dumps(segments, indent=2))

        _set_stage(job_id, JobStage.ANALYZING_SIGNALS)
        audio_samples, framerate = _load_wav(storage.audio_path(job_id))
        duration_seconds = len(audio_samples) / framerate if framerate else 0.0
        retention_analysis = signals.compute_retention_analysis(
            transcript=segments,
            frames=frames,
            audio_samples=audio_samples,
            framerate=framerate,
            duration_seconds=duration_seconds,
        )
        storage.retention_path(job_id).write_text(retention_analysis.model_dump_json(indent=2))

        _set_stage(job_id, JobStage.GENERATING_REPORT)
        top_risk = retention_analysis.top_risk_segment
        gemini_causal = gemini_service.generate_causal_explanation(top_risk)
        causal_explanation = CausalExplanation(
            start=top_risk.start,
            end=top_risk.end,
            transcript_excerpt=top_risk.transcript_excerpt,
            causal_explanation=gemini_causal.causal_explanation,
            concrete_fix=gemini_causal.concrete_fix,
        )

        hook = retention_analysis.hook_analysis
        gemini_hook = gemini_service.generate_hook_autopsy(hook)
        hook_autopsy = HookAutopsy(
            hook_strength_score=hook.hook_strength_score,
            original_opening_line=hook.opening_text,
            assessment=gemini_hook.assessment,
            rewritten_opening_line=gemini_hook.rewritten_opening_line,
        )

        score, hook_component, curve_component, audio_component = signals.compute_readiness_score(
            retention_analysis
        )
        readiness_score = ReadinessScore(
            score=score,
            hook_component=hook_component,
            curve_component=curve_component,
            audio_component=audio_component,
        )

        report = FullReport(
            retention_analysis=retention_analysis,
            causal_explanation=causal_explanation,
            hook_autopsy=hook_autopsy,
            readiness_score=readiness_score,
        )
        storage.report_path(job_id).write_text(report.model_dump_json(indent=2))

        _set_stage(job_id, JobStage.DONE)
    except Exception as exc:
        logger.exception("Pipeline failed for job %s", job_id)
        _set_stage(job_id, JobStage.ERROR, error_message=_user_facing_error(exc))
