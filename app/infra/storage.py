from pathlib import Path

from app.core.config import get_settings

settings = get_settings()


class StorageService:
    def save_text(self, key: str, content: str) -> str:
        if settings.object_storage_backend == "local":
            path = Path("storage") / key
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content, encoding="utf-8")
            return str(path)
        return f"{settings.object_storage_base_url}/{settings.object_storage_bucket}/{key}"
