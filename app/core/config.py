from functools import lru_cache

from pydantic import BaseSettings


class Settings(BaseSettings):
    project_name: str = "Infrasentinel"
    environment: str = "development"
    database_url: str
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    jwt_issuer: str = "infrasentinel"
    jwt_audience: str = "api"
    access_token_expire_minutes: int = 60
    redis_url: str = "redis://localhost:6379/0"
    celery_broker_url: str = "redis://localhost:6379/1"
    celery_result_backend: str = "redis://localhost:6379/2"
    object_storage_backend: str = "local"
    object_storage_bucket: str = "infrasentinel"
    object_storage_base_url: str = "http://localhost:9000"
    object_storage_local_root: str = "storage"
    cors_allowed_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    cors_allowed_origin_regex: str | None = r"https?://(localhost|127\.0\.0\.1)(:\d+)?$"
    sentry_dsn: str | None = None
    sentry_traces_sample_rate: float = 0.0
    enable_opentelemetry: bool = False
    rate_limit_enabled: bool = False

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    return Settings()
