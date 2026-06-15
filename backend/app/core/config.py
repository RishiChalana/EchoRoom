from __future__ import annotations

import json
from typing import Literal
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Application ───────────────────────────────────────────────────────────
    APP_NAME: str = "EchoRoom API"
    APP_VERSION: str = "0.1.0"
    ENVIRONMENT: Literal["development", "staging", "production"] = "development"
    DEBUG: bool = True

    # ── Server ────────────────────────────────────────────────────────────────
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    WORKERS: int = 1

    # ── Database ──────────────────────────────────────────────────────────────
    DATABASE_URL: str = "postgresql+asyncpg://echoroom:echoroom_dev_pass@localhost:5432/echoroom"
    DATABASE_POOL_SIZE: int = 10
    DATABASE_MAX_OVERFLOW: int = 20
    DATABASE_ECHO: bool = False

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def fix_database_url_driver(cls, v: str) -> str:
        """Normalize Railway's postgres:// / postgresql:// to postgresql+asyncpg://."""
        if not isinstance(v, str):
            return v
        # Already has a driver suffix — leave it alone
        if "+asyncpg" in v or "+psycopg2" in v:
            return v
        # Railway gives "postgres://host/db"
        if v.startswith("postgres://"):
            return "postgresql+asyncpg://" + v[len("postgres://"):]
        # Some providers give "postgresql://host/db" (no driver)
        if v.startswith("postgresql://"):
            return "postgresql+asyncpg://" + v[len("postgresql://"):]
        return v

    # ── Redis ─────────────────────────────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_MAX_CONNECTIONS: int = 50

    # ── CORS ──────────────────────────────────────────────────────────────────
    # Override via CORS_ORIGINS env var (JSON array): '["https://yourapp.com"]'
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://localhost:8000",
    ]
    CORS_ALLOW_CREDENTIALS: bool = True

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors(cls, v: object) -> object:
        """Accept a JSON string or a plain URL string from env vars."""
        if isinstance(v, str):
            try:
                return json.loads(v)
            except json.JSONDecodeError:
                return [v]
        return v

    # ── Security ──────────────────────────────────────────────────────────────
    SECRET_KEY: str = "change-me-in-production-use-openssl-rand-hex-32"

    # ── LLM providers ─────────────────────────────────────────────────────────
    GEMINI_API_KEY: str = ""

    # ── Properties ────────────────────────────────────────────────────────────
    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"

    @property
    def is_development(self) -> bool:
        return self.ENVIRONMENT == "development"

    @property
    def database_url_sync(self) -> str:
        """Synchronous DB URL for Alembic / Celery workers (psycopg2)."""
        return self.DATABASE_URL.replace("+asyncpg", "+psycopg2")


# Singleton — import and use throughout the app
settings = Settings()
