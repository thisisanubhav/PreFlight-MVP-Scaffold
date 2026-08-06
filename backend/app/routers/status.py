from fastapi import APIRouter, HTTPException

from app.db import get_session
from app.models.analyze import JobStatusResponse
from app.models.job import Job

router = APIRouter()


@router.get("/status/{job_id}", response_model=JobStatusResponse)
def get_status(job_id: str) -> JobStatusResponse:
    session = get_session()
    try:
        job = session.get(Job, job_id)
        if job is None:
            raise HTTPException(status_code=404, detail="Job not found")
        return JobStatusResponse(job_id=job.id, stage=job.stage, error_message=job.error_message)
    finally:
        session.close()
