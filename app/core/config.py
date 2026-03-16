from functools import lru_cache

from pydantic import BaseSettings


class Settings(BaseSettings):
    project_name: str = "Infrasentinel"
    database_url: str
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    return Settings()
