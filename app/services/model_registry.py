from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
from typing import Any

import joblib


MODELS_DIR = Path(__file__).resolve().parents[2] / "models"
METADATA_PATH = MODELS_DIR / "metadata.json"


@dataclass(frozen=True)
class RegistryMetadata:
    current_model: str | None
    algorithm: str
    trained_at: str | None
    training_samples: int
    model_hash: str | None
    model_version: int
    score_min: float
    score_max: float
    feature_names: list[str]
    feature_stats: dict[str, dict[str, float]]


class ModelRegistry:
    def __init__(self, base_dir: Path | None = None) -> None:
        self._base_dir = base_dir or MODELS_DIR
        self._metadata_path = self._base_dir / "metadata.json"
        self._base_dir.mkdir(parents=True, exist_ok=True)

    @property
    def metadata_path(self) -> Path:
        return self._metadata_path

    @property
    def base_dir(self) -> Path:
        return self._base_dir

    def load_metadata(self) -> RegistryMetadata:
        data = self._read_metadata_raw()
        return RegistryMetadata(
            current_model=data.get("current_model"),
            algorithm=str(data.get("algorithm") or "IsolationForest"),
            trained_at=data.get("trained_at"),
            training_samples=int(data.get("training_samples") or 0),
            model_hash=data.get("model_hash"),
            model_version=int(data.get("model_version") or 0),
            score_min=float(data.get("score_min") or -1.0),
            score_max=float(data.get("score_max") or 1.0),
            feature_names=[str(v) for v in data.get("feature_names") or []],
            feature_stats={
                str(k): {
                    "mean": float((v or {}).get("mean") or 0.0),
                    "std": max(float((v or {}).get("std") or 0.0), 1e-9),
                }
                for k, v in (data.get("feature_stats") or {}).items()
            },
        )

    def load_current_model(self) -> tuple[Any | None, RegistryMetadata]:
        metadata = self.load_metadata()
        if not metadata.current_model:
            return None, metadata

        model_path = self._resolve_model_path(metadata.current_model)
        if not model_path.exists():
            return None, metadata

        self._verify_hash(model_path=model_path, expected_hash=metadata.model_hash)
        model = joblib.load(model_path)
        return model, metadata

    def save_new_model(
        self,
        *,
        model: Any,
        algorithm: str,
        training_samples: int,
        score_min: float,
        score_max: float,
        feature_names: list[str],
        feature_stats: dict[str, dict[str, float]],
    ) -> dict[str, Any]:
        raw = self._read_metadata_raw()
        current_version = int(raw.get("model_version") or 0)
        next_version = current_version + 1
        model_name = f"anomaly_model_v{next_version}.pkl"
        model_path = self._base_dir / model_name

        joblib.dump(model, model_path)
        model_hash = self._sha256_file(model_path)

        updated = {
            "current_model": model_name,
            "algorithm": algorithm,
            "trained_at": datetime.now(timezone.utc).isoformat(),
            "training_samples": int(training_samples),
            "model_hash": model_hash,
            "model_version": next_version,
            "score_min": float(score_min),
            "score_max": float(score_max),
            "feature_names": [str(v) for v in feature_names],
            "feature_stats": feature_stats,
            "history": [
                *list(raw.get("history") or []),
                {
                    "model": model_name,
                    "version": next_version,
                    "trained_at": datetime.now(timezone.utc).isoformat(),
                    "training_samples": int(training_samples),
                    "model_hash": model_hash,
                },
            ],
        }
        self._metadata_path.write_text(json.dumps(updated, indent=2), encoding="utf-8")
        return updated

    def rollback(self, *, target_model: str) -> dict[str, Any]:
        raw = self._read_metadata_raw()
        target_path = self._resolve_model_path(target_model)
        if not target_path.exists():
            raise ValueError("Target model does not exist")

        history = list(raw.get("history") or [])
        selected = next((item for item in history if item.get("model") == target_model), None)
        if selected is None:
            selected = {
                "model": target_model,
                "version": int(raw.get("model_version") or 1),
                "trained_at": datetime.now(timezone.utc).isoformat(),
                "training_samples": int(raw.get("training_samples") or 0),
                "model_hash": self._sha256_file(target_path),
            }

        raw["current_model"] = target_model
        raw["model_version"] = int(selected.get("version") or raw.get("model_version") or 1)
        raw["trained_at"] = selected.get("trained_at")
        raw["training_samples"] = int(selected.get("training_samples") or 0)
        raw["model_hash"] = selected.get("model_hash") or self._sha256_file(target_path)

        self._metadata_path.write_text(json.dumps(raw, indent=2), encoding="utf-8")
        return raw

    def _read_metadata_raw(self) -> dict[str, Any]:
        if not self._metadata_path.exists():
            return {
                "current_model": None,
                "algorithm": "IsolationForest",
                "trained_at": None,
                "training_samples": 0,
                "model_hash": None,
                "model_version": 0,
                "score_min": -1.0,
                "score_max": 1.0,
                "feature_names": [],
                "feature_stats": {},
                "history": [],
            }

        return json.loads(self._metadata_path.read_text(encoding="utf-8"))

    def _verify_hash(self, *, model_path: Path, expected_hash: str | None) -> None:
        if not expected_hash:
            return
        actual_hash = self._sha256_file(model_path)
        if actual_hash != expected_hash:
            raise ValueError("Model hash verification failed")

    def _resolve_model_path(self, model_name: str) -> Path:
        candidate = (self._base_dir / model_name).resolve()
        base = self._base_dir.resolve()
        if candidate.parent != base:
            raise ValueError("Invalid model path")
        if candidate.suffix not in {".pkl", ".joblib"}:
            raise ValueError("Invalid model file type")
        return candidate

    @staticmethod
    def _sha256_file(path: Path) -> str:
        hasher = hashlib.sha256()
        with path.open("rb") as handle:
            while True:
                chunk = handle.read(1024 * 1024)
                if not chunk:
                    break
                hasher.update(chunk)
        return hasher.hexdigest()
