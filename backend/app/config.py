from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central app config, loaded from environment variables / .env."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # CORS: the Next.js dev server origin(s) allowed to call this API.
    cors_origins: list[str] = ["http://localhost:3000"]

    # Gemini text synthesis: causal explanation, top-fix, hook autopsy rewrite.
    gemini_api_key: str | None = None
    # "-latest" alias so this doesn't go stale as Google deprecates dated
    # model snapshots (gemini-2.5-flash, current at code-authoring time,
    # was already rejected as "no longer available to new users" by the
    # time this was tested against a live key).
    gemini_model: str = "gemini-flash-latest"

    # Local filesystem storage root for uploads/frames/transcripts (hackathon scope).
    storage_dir: str = "storage"

    # Phase 6: serve a pre-computed cached result instead of running the live pipeline.
    demo_mode: bool = False


@lru_cache
def get_settings() -> Settings:
    return Settings()
