from pathlib import Path

from app.config import get_settings

settings = get_settings()


def job_dir(job_id: str) -> Path:
    path = Path(settings.storage_dir) / "jobs" / job_id
    path.mkdir(parents=True, exist_ok=True)
    return path


def frames_dir(job_id: str) -> Path:
    path = job_dir(job_id) / "frames"
    path.mkdir(parents=True, exist_ok=True)
    return path


def input_video_path(job_id: str, original_filename: str) -> Path:
    suffix = Path(original_filename).suffix or ".mp4"
    return job_dir(job_id) / f"input{suffix}"


def audio_path(job_id: str) -> Path:
    return job_dir(job_id) / "audio.wav"


def transcript_path(job_id: str) -> Path:
    return job_dir(job_id) / "transcript.json"


def frame_index_path(job_id: str) -> Path:
    return job_dir(job_id) / "frames.json"


def retention_path(job_id: str) -> Path:
    return job_dir(job_id) / "retention.json"


def report_path(job_id: str) -> Path:
    return job_dir(job_id) / "report.json"
