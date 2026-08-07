import uuid

from fastapi import APIRouter, BackgroundTasks, HTTPException, UploadFile

from app.config import get_settings
from app.db import get_session
from app.models.analyze import AnalyzeResponse
from app.models.job import Job, JobStage
from app.services import storage
from app.services.pipeline import run_pipeline

router = APIRouter()

MAX_UPLOAD_BYTES = 500 * 1024 * 1024  # 500 MB — generous for a short demo video

CHUNK_SIZE = 1024 * 1024


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze(file: UploadFile, background_tasks: BackgroundTasks) -> AnalyzeResponse:
    # Demo mode: skip the real pipeline (ffmpeg/Whisper/Gemini) entirely and
    # hand back the pre-computed fixture job, so judging isn't at the mercy of
    # live processing speed or API availability. The uploaded file is never
    # even read/saved — GET /status and /report special-case DEMO_JOB_ID too.
    if get_settings().demo_mode:
        return AnalyzeResponse(job_id=storage.DEMO_JOB_ID)

    job_id = uuid.uuid4().hex
    original_filename = file.filename or "upload.mp4"

    video_path = storage.input_video_path(job_id, original_filename)
    size = 0
    with open(video_path, "wb") as out:
        while chunk := await file.read(CHUNK_SIZE):
            size += len(chunk)
            if size > MAX_UPLOAD_BYTES:
                out.close()
                video_path.unlink(missing_ok=True)
                raise HTTPException(status_code=413, detail="File too large")
            out.write(chunk)

    session = get_session()
    try:
        session.add(Job(id=job_id, original_filename=original_filename, stage=JobStage.QUEUED))
        session.commit()
    finally:
        session.close()

    background_tasks.add_task(run_pipeline, job_id, original_filename)

    return AnalyzeResponse(job_id=job_id)
