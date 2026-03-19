from functools import lru_cache

from pydantic import BaseSettings


class Settings(BaseSettings):
    project_name: str = "Infrasentinel"
    database_url: str
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    redis_url: str = "redis://localhost:6379/0"
    celery_broker_url: str = "redis://localhost:6379/1"
    celery_result_backend: str = "redis://localhost:6379/2"
    object_storage_backend: str = "local"
    object_storage_bucket: str = "infrasentinel"
    object_storage_base_url: str = "http://localhost:9000"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    return Settings()
