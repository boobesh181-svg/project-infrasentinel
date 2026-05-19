from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace

import numpy as np
from sklearn.ensemble import IsolationForest

from app.services.ai_risk_service import AIRiskService, FEATURE_COLUMNS
from app.services.model_monitoring import ModelMonitoringService
from app.services.model_registry import ModelRegistry


def _entry(**overrides):
    payload = {
        "id": "entry-1",
        "project_id": "project-1",
        "material_name": "Concrete",
        "quantity": 100.0,
        "calculated_emission": 50.0,
        "supplier_name": "Supplier A",
        "submitted_at": datetime.now(timezone.utc),
        "temporal_anomaly": False,
        "audit_required": False,
    }
    payload.update(overrides)
    return SimpleNamespace(**payload)


def test_anomaly_scoring_uses_registered_model(tmp_path: Path):
    registry = ModelRegistry(base_dir=tmp_path)

    train_matrix = np.array(
        [
            [95.0, 95.0, 0.0, 49.0, 0.2, 5.0, 0.3, 12.0, 0.1],
            [100.0, 98.0, 0.02, 50.0, 0.2, 6.0, 0.3, 11.0, 0.11],
            [102.0, 100.0, 0.02, 52.0, 0.3, 6.0, 0.3, 10.0, 0.12],
            [98.0, 97.0, 0.01, 49.5, 0.2, 7.0, 0.3, 9.0, 0.1],
            [101.0, 100.0, 0.01, 51.0, 0.2, 8.0, 0.3, 13.0, 0.11],
            [99.0, 98.0, 0.01, 50.0, 0.25, 7.0, 0.3, 11.0, 0.1],
            [100.0, 99.0, 0.01, 50.5, 0.2, 6.0, 0.3, 10.0, 0.1],
            [97.0, 96.0, 0.01, 48.0, 0.2, 6.0, 0.3, 12.0, 0.09],
            [103.0, 101.0, 0.02, 53.0, 0.2, 7.0, 0.3, 11.0, 0.13],
            [96.0, 95.0, 0.01, 48.5, 0.2, 8.0, 0.3, 14.0, 0.09],
        ],
        dtype=float,
    )
    model = IsolationForest(n_estimators=100, contamination=0.1, random_state=42)
    model.fit(train_matrix)

    scores = model.score_samples(train_matrix)
    feature_stats = {
        name: {
            "mean": float(np.mean(train_matrix[:, idx])),
            "std": float(max(np.std(train_matrix[:, idx]), 1e-9)),
        }
        for idx, name in enumerate(FEATURE_COLUMNS)
    }

    registry.save_new_model(
        model=model,
        algorithm="IsolationForest",
        training_samples=len(train_matrix),
        score_min=float(np.min(scores)),
        score_max=float(np.max(scores)),
        feature_names=FEATURE_COLUMNS,
        feature_stats=feature_stats,
    )

    service = AIRiskService(session=None)
    service._registry = registry

    result = service.calculate_risk(entry=_entry())
    assert 0.0 <= result.anomaly_score <= 1.0
    assert 0.0 <= result.combined_score <= 1.0
    assert result.risk_level in {"LOW", "MEDIUM", "HIGH"}


def test_rule_scoring_fallback_without_session():
    service = AIRiskService(session=None)
    result = service.calculate_risk(
        entry=_entry(
            temporal_anomaly=True,
            audit_required=True,
            quantity=120.0,
            calculated_emission=90.0,
        )
    )

    assert result.rule_score >= 0.6
    assert "Temporal anomaly detected" in result.explanation


def test_combined_scoring_is_weighted(monkeypatch):
    service = AIRiskService(session=None)

    monkeypatch.setattr(service, "_anomaly_score", lambda features: (0.8, {"difference_ratio": 1.0}, 1))
    monkeypatch.setattr(service, "_rule_score", lambda entry: (0.2, ["rule factor"]))

    result = service.calculate_risk(entry=_entry())
    expected = (0.55 * 0.8) + (0.45 * 0.2)

    assert abs(result.combined_score - expected) < 1e-6
    assert result.risk_level == "MEDIUM"


def test_model_registry_load_and_hash_verification(tmp_path: Path):
    registry = ModelRegistry(base_dir=tmp_path)

    matrix = np.array([[1.0], [2.0], [3.0], [4.0], [5.0], [6.0], [7.0], [8.0], [9.0], [10.0]])
    model = IsolationForest(n_estimators=50, contamination=0.1, random_state=42)
    model.fit(matrix)
    scores = model.score_samples(matrix)

    registry.save_new_model(
        model=model,
        algorithm="IsolationForest",
        training_samples=10,
        score_min=float(np.min(scores)),
        score_max=float(np.max(scores)),
        feature_names=["quantity"],
        feature_stats={"quantity": {"mean": 5.5, "std": 2.87}},
    )

    loaded_model, metadata = registry.load_current_model()
    assert loaded_model is not None
    assert metadata.current_model is not None
    assert metadata.model_version == 1


def test_fallback_behavior_when_model_missing(tmp_path: Path):
    service = AIRiskService(session=None)
    service._registry = ModelRegistry(base_dir=tmp_path)

    result = service.calculate_risk(entry=_entry(quantity=200.0))
    assert 0.0 <= result.anomaly_score <= 1.0
    assert result.model_version == 0


def test_drift_detection_recommendation():
    monitor = ModelMonitoringService(max_samples=200, drift_threshold=0.2)

    for _ in range(100):
        monitor.record(anomaly_score=0.85, predicted_high_risk=True)

    drift = monitor.detect_drift(training_distribution=[0.1] * 100)
    assert drift.drift_detected is True
    assert drift.recommendation == "retrain_recommended"
