from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings

settings = get_settings()

_db_path = Path(settings.storage_dir) / "preflight.db"
_db_path.parent.mkdir(parents=True, exist_ok=True)

engine = create_engine(f"sqlite:///{_db_path}", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def init_db() -> None:
    from app.models import job as _job  # noqa: F401  (register models on Base)

    Base.metadata.create_all(bind=engine)


def get_session() -> Session:
    return SessionLocal()
