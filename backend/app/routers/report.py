import json

from fastapi import APIRouter, HTTPException

from app.db import get_session
from app.models.job import Job, JobStage
from app.models.report import FullReport
from app.services import storage

router = APIRouter()


@router.get("/report/{job_id}", response_model=FullReport)
def get_report(job_id: str) -> FullReport:
    session = get_session()
    try:
        job = session.get(Job, job_id)
    finally:
        session.close()

    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.stage != JobStage.DONE:
        raise HTTPException(status_code=409, detail=f"Job not finished (stage={job.stage.value})")

    path = storage.report_path(job_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Report not found")

    return FullReport.model_validate(json.loads(path.read_text()))
