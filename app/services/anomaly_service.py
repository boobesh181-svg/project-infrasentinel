from __future__ import annotations

import hashlib
import logging
from pathlib import Path
from typing import Any

import joblib
import numpy as np
from sklearn.ensemble import IsolationForest

from app.services.model_registry import ModelRegistry

logger = logging.getLogger("infrasentinel")


MODEL_DIR = Path(__file__).resolve().parents[2] / "storage" / "models"
MODEL_PATH = MODEL_DIR / "material_anomaly_iforest.joblib"
MODEL_HASH_PATH = MODEL_DIR / "material_anomaly_iforest.sha256"


def train_anomaly_model(dataset: list[dict[str, Any]]) -> dict[str, Any]:
    """Train and persist an IsolationForest model from historical material quantities.

    Expected input is historical material quantities per building. Supported formats:
    - [{"building_id": "B1", "material": "Concrete", "quantity": 9000}, ...]
    - [{"building_id": "B1", "materials": [{"name": "Concrete", "quantity": 9000}, ...]}, ...]
    """
    rows = _flatten_dataset(dataset)
    if len(rows) < 10:
        raise ValueError("At least 10 historical quantity rows are required to train anomaly model")

    quantities = np.array([float(row["quantity"]) for row in rows], dtype=float).reshape(-1, 1)
    model = IsolationForest(
        n_estimators=200,
        contamination=0.1,
        random_state=42,
    )
    model.fit(quantities)

    train_scores = model.score_samples(quantities)
    score_min = float(np.min(train_scores))
    score_max = float(np.max(train_scores))

    registry = ModelRegistry()
    registry.save_new_model(
        model=model,
        algorithm="IsolationForest",
        training_samples=len(rows),
        score_min=score_min,
        score_max=score_max,
        feature_names=["quantity"],
        feature_stats={
            "quantity": {
                "mean": float(np.mean(quantities)),
                "std": float(max(np.std(quantities), 1e-9)),
            }
        },
    )

    payload = {
        "model": model,
        "score_min": score_min,
        "score_max": score_max,
    }
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    with MODEL_PATH.open("wb") as handle:
        joblib.dump(payload, handle)

    _legacy_hash_path(MODEL_PATH).write_text(_sha256_file(MODEL_PATH), encoding="utf-8")

    logger.info("Material anomaly model trained and persisted at %s", MODEL_PATH)
    return {
        "trained_rows": len(rows),
        "model_path": str(MODEL_PATH),
    }


def detect_anomalies(materials: list[dict[str, Any]]) -> dict[str, Any]:
    if not materials:
        raise ValueError("materials must not be empty")

    quantities = np.array([float(item.get("quantity", 0.0)) for item in materials], dtype=float).reshape(-1, 1)

    risk_scores: np.ndarray
    try:
        registry = ModelRegistry()
        model, metadata = registry.load_current_model()
        if model is None:
            raise ValueError("No model in registry")

        raw_scores = model.score_samples(quantities)
        risk_scores = _normalize_scores(
            raw_scores,
            score_min=float(metadata.score_min),
            score_max=float(metadata.score_max),
        )
    except Exception:
        if MODEL_PATH.exists():
            _assert_safe_model_path(MODEL_PATH)
            _verify_legacy_model_hash(MODEL_PATH)
            payload = joblib.load(MODEL_PATH)
            model = payload["model"]
            raw_scores = model.score_samples(quantities)
            risk_scores = _normalize_scores(
                raw_scores,
                score_min=float(payload.get("score_min", -1.0)),
                score_max=float(payload.get("score_max", 1.0)),
            )
        else:
            logger.warning("Anomaly model not found; using deterministic fallback scoring")
            risk_scores = _fallback_risk_scores(quantities=quantities)

    overall_risk = float(np.clip(np.max(risk_scores), 0.0, 1.0))
    flags: list[dict[str, Any]] = []

    mean_quantity = float(np.mean(quantities))
    for idx, material in enumerate(materials):
        risk = float(risk_scores[idx])
        if risk >= 0.6:
            quantity = float(material.get("quantity", 0.0))
            deviation = abs(quantity - mean_quantity)
            flags.append(
                {
                    "material": str(material.get("name", "unknown")),
                    "deviation": round(float(deviation), 4),
                }
            )

    result = {
        "risk_score": round(overall_risk, 4),
        "flags": flags,
    }
    logger.info("Anomaly detection completed with risk_score=%s flags=%s", result["risk_score"], len(flags))
    return result


def _flatten_dataset(dataset: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for record in dataset:
        if "materials" in record and isinstance(record["materials"], list):
            building_id = record.get("building_id")
            for material in record["materials"]:
                if not isinstance(material, dict):
                    continue
                if "quantity" not in material:
                    continue
                rows.append(
                    {
                        "building_id": building_id,
                        "material": material.get("name") or material.get("material") or "unknown",
                        "quantity": float(material["quantity"]),
                    }
                )
        elif "quantity" in record:
            rows.append(
                {
                    "building_id": record.get("building_id"),
                    "material": record.get("material") or record.get("name") or "unknown",
                    "quantity": float(record["quantity"]),
                }
            )
    return rows


def _normalize_scores(raw_scores: np.ndarray, *, score_min: float, score_max: float) -> np.ndarray:
    if np.isclose(score_min, score_max):
        return np.zeros_like(raw_scores, dtype=float)
    risk = (score_max - raw_scores) / (score_max - score_min)
    return np.clip(risk, 0.0, 1.0)


def _fallback_risk_scores(*, quantities: np.ndarray) -> np.ndarray:
    values = quantities.reshape(-1)
    mean = float(np.mean(values))
    std = float(np.std(values))
    if std <= 1e-9:
        return np.zeros_like(values, dtype=float)
    z = np.abs(values - mean) / std
    return np.clip(z / 3.0, 0.0, 1.0)


def _sha256_file(path: Path) -> str:
    hasher = hashlib.sha256()
    with path.open("rb") as handle:
        while True:
            chunk = handle.read(1024 * 1024)
            if not chunk:
                break
            hasher.update(chunk)
    return hasher.hexdigest()


def _verify_legacy_model_hash(path: Path) -> None:
    hash_path = _legacy_hash_path(path)
    if not hash_path.exists():
        raise ValueError("Missing legacy model hash file")
    expected = hash_path.read_text(encoding="utf-8").strip()
    if not expected:
        raise ValueError("Invalid legacy model hash")
    actual = _sha256_file(path)
    if expected != actual:
        raise ValueError("Legacy model hash verification failed")


def _assert_safe_model_path(path: Path) -> None:
    resolved = path.resolve()
    model_root = MODEL_DIR.resolve()
    if resolved.parent != model_root:
        raise ValueError("Invalid legacy model path")


def _legacy_hash_path(model_path: Path) -> Path:
    return model_path.with_suffix(".sha256")
