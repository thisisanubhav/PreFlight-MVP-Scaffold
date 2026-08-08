import json
from functools import lru_cache
from typing import Annotated

from pydantic import BeforeValidator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


def _parse_origins(v: object) -> object:
    if isinstance(v, str):
        stripped = v.strip()
        if stripped.startswith("["):
            return json.loads(stripped)
        return [origin.strip() for origin in stripped.split(",") if origin.strip()]
    return v


class Settings(BaseSettings):
    """Central app config, loaded from environment variables / .env."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # CORS: origins allowed to call this API (Next.js dev server locally,
    # the deployed Vercel domain in prod). Accepts either a JSON array
    # (CORS_ORIGINS=["https://x.vercel.app"]) or, easier to type into a
    # hosting dashboard, a comma-separated string
    # (CORS_ORIGINS=https://x.vercel.app,http://localhost:3000). NoDecode
    # stops pydantic-settings from JSON-decoding the raw env string itself
    # (which errors on non-JSON input) before our validator ever sees it.
    cors_origins: Annotated[list[str], NoDecode, BeforeValidator(_parse_origins)] = [
        "http://localhost:3000"
    ]

    # Gemini text synthesis: causal explanation, top-fix, hook autopsy rewrite.
    gemini_api_key: str | None = None
    # Pinned, not the "gemini-flash-latest" alias: an alias can repoint to a
    # different underlying model at any time (it already moved once during
    # this project), which risks a behavior/latency shift right before or
    # during a demo. Pinned to whatever "-latest" resolved to as of
    # 2026-08-07 (confirmed live against this project's API key). Bump
    # deliberately, not silently, if a newer model is wanted later.
    gemini_model: str = "gemini-3.6-flash"

    # Local filesystem storage root for uploads/frames/transcripts (hackathon scope).
    storage_dir: str = "storage"

    # Phase 6: serve a pre-computed cached result instead of running the live pipeline.
    demo_mode: bool = False


@lru_cache
def get_settings() -> Settings:
    return Settings()
