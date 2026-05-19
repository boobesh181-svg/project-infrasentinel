import io
import asyncio
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from starlette.datastructures import Headers, UploadFile

from app.api.evidence import _save_upload
from app.core.observability import setup_observability
from app.storage.local_storage import LocalStorage


def test_save_upload_uses_storage_abstraction(tmp_path):
    storage = LocalStorage(root_dir=tmp_path)
    upload = UploadFile(
        filename="evidence.pdf",
        file=io.BytesIO(b"sample-evidence-bytes"),
        headers=Headers({"content-type": "application/pdf"}),
    )

    uri, file_hash, file_size, original_name = asyncio.run(
        _save_upload(file=upload, storage=storage, max_bytes=1024)
    )

    assert original_name == "evidence.pdf"
    assert file_size == len(b"sample-evidence-bytes")
    assert file_hash
    assert storage.exists(uri=uri)
    assert Path(uri).read_bytes() == b"sample-evidence-bytes"


def test_save_upload_rejects_oversized_payload(tmp_path):
    storage = LocalStorage(root_dir=tmp_path)
    upload = UploadFile(
        filename="large.pdf",
        file=io.BytesIO(b"x" * 32),
        headers=Headers({"content-type": "application/pdf"}),
    )

    with pytest.raises(ValueError, match="File too large"):
        asyncio.run(_save_upload(file=upload, storage=storage, max_bytes=8))


def test_observability_exposes_metrics_endpoint():
    app = FastAPI()

    @app.get("/ping")
    def ping():
        return {"ok": True}

    setup_observability(app)

    with TestClient(app) as client:
        ping_response = client.get("/ping")
        assert ping_response.status_code == 200

        metrics_response = client.get("/metrics")
        assert metrics_response.status_code == 200
        assert "http_requests_total" in metrics_response.text
        assert "http_request_duration_seconds" in metrics_response.text
