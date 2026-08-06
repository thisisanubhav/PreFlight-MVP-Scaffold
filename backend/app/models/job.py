import enum
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class JobStage(str, enum.Enum):
    QUEUED = "queued"
    EXTRACTING_AUDIO = "extracting_audio"
    EXTRACTING_FRAMES = "extracting_frames"
    TRANSCRIBING = "transcribing"
    ANALYZING_SIGNALS = "analyzing_signals"
    GENERATING_REPORT = "generating_report"
    DONE = "done"
    ERROR = "error"


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    original_filename: Mapped[str] = mapped_column(String)
    stage: Mapped[JobStage] = mapped_column(Enum(JobStage), default=JobStage.QUEUED)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
