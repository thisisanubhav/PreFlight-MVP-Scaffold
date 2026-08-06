import uuid

from fastapi import APIRouter, BackgroundTasks, HTTPException, UploadFile

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
