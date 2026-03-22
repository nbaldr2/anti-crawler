# Configuration for detection engine
from pydantic_settings import BaseSettings
from typing import List
import os

class Settings(BaseSettings):
    # Database
    DB_URL: str = "postgresql+asyncpg://postgres:postgres@postgres:5432/antibot"
    REDIS_URL: str = "redis://redis:6379/0"
    # API authentication (simple token for admin endpoints)
    API_TOKEN: str = "dev-admin-token"
    # Scoring thresholds (can be overridden by DB settings)
    SCORING_THRESHOLDS: dict = {"low": 20, "medium": 50, "high": 80}
    # Weights (must sum to 100)
    WEIGHTS: dict = {"ip_rep": 30, "user_agent": 20, "request_pattern": 20, "behavioral": 15, "tls": 10, "headless": 5}
    # Rate limiting defaults
    RATE_LIMIT_DEFAULT_RPS: int = 10
    RATE_LIMIT_BURST: int = 20
    RATE_LIMIT_KEY_TTL: int = 60
    # PoW defaults
    POW_INITIAL_BITS: int = 18
    POW_MAX_BITS: int = 24
    POW_WINDOW_SECONDS: int = 3600
    POW_MAX_ATTEMPTS: int = 3
    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    class Config:
        env_file = ".env"

settings = Settings()
