from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.db import init_db
from app.routers.analyze import router as analyze_router
from app.routers.report import router as report_router
from app.routers.status import router as status_router

settings = get_settings()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="PreFlight API",
    description="AI pre-publish copilot backend: video processing, heuristic "
    "retention modeling, and AI-generated report synthesis.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(analyze_router)
app.include_router(status_router)
app.include_router(report_router)
