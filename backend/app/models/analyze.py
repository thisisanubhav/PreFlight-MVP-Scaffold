from pydantic import BaseModel

from app.models.job import JobStage


class AnalyzeResponse(BaseModel):
    job_id: str


class JobStatusResponse(BaseModel):
    job_id: str
    stage: JobStage
    error_message: str | None = None
