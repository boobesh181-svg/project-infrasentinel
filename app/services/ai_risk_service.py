from __future__ import annotations

from dataclasses import dataclass
from datetime import timezone
import hashlib
import logging
from typing import Any

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.observability import set_ai_anomaly_rate
from app.models.evidence_acknowledgement import EvidenceAcknowledgement
from app.models.evidence_file import EvidenceFile
from app.models.material_entry import MaterialEntry
from app.services.model_monitoring import ModelMonitoringService
from app.services.model_registry import ModelRegistry
from app.services.risk_engine import RiskEngine


FEATURE_COLUMNS = [
    "quantity",
    "expected_quantity",
    "difference_ratio",
    "emission_value",
    "supplier_frequency",
    "historical_entry_count",
    "material_type_encoding",
    "time_since_last_submission",
    "emission_deviation_from_project_average",
]


@dataclass(frozen=True)
class AIRiskResult:
    anomaly_score: float
    rule_score: float
    combined_score: float
    risk_level: str
    explanation: list[str]
    top_contributing_features: list[str]
    deviation_details: dict[str, float]
    model_version: int


_MONITOR = ModelMonitoringService()
logger = logging.getLogger("infrasentinel")


class AIRiskService:
    def __init__(self, session: Session | None) -> None:
        self._session = session
        self._registry = ModelRegistry()

    def calculate_risk(self, *, entry: MaterialEntry) -> AIRiskResult:
        features = self._extract_features(entry)
        anomaly_score, feature_impacts, model_version = self._anomaly_score(features)
        rule_score, rule_explanations = self._rule_score(entry)

        combined = float(np.clip((0.55 * anomaly_score) + (0.45 * rule_score), 0.0, 1.0))
        risk_level = self._risk_level(combined)

        sorted_features = sorted(feature_impacts.items(), key=lambda item: abs(item[1]), reverse=True)
        top_features = [name for name, _ in sorted_features[:3]]
        deviation_details = {
            name: round(float(value), 4)
            for name, value in sorted_features[:5]
        }

        explanations = list(rule_explanations)
        if anomaly_score >= 0.6:
            explanations.append("ML anomaly score exceeded threshold")
        if features["difference_ratio"] >= 0.25:
            explanations.append("Quantity deviates from historical expectation")
        if not explanations:
            explanations.append("No significant anomalies detected")

        _MONITOR.record(anomaly_score=anomaly_score, predicted_high_risk=risk_level == "HIGH")
        monitor_snapshot = _MONITOR.summary()
        set_ai_anomaly_rate(anomaly_rate=float(monitor_snapshot.get("anomaly_rate") or 0.0))

        return AIRiskResult(
            anomaly_score=round(anomaly_score, 4),
            rule_score=round(rule_score, 4),
            combined_score=round(combined, 4),
            risk_level=risk_level,
            explanation=explanations,
            top_contributing_features=top_features,
            deviation_details=deviation_details,
            model_version=model_version,
        )

    def train_from_historical_entries(self) -> dict[str, Any]:
        if self._session is None:
            raise ValueError("Database session is required for training")

        entries = self._session.execute(select(MaterialEntry)).scalars().all()
        if len(entries) < 15:
            raise ValueError("At least 15 material entries are required for training")

        rows = [self._extract_features(entry) for entry in entries]
        frame = pd.DataFrame(rows, columns=FEATURE_COLUMNS).fillna(0.0)

        matrix = frame[FEATURE_COLUMNS].to_numpy(dtype=float)
        model = IsolationForest(
            n_estimators=200,
            contamination=0.08,
            random_state=42,
        )
        model.fit(matrix)

        train_scores = model.score_samples(matrix)
        score_min = float(np.min(train_scores))
        score_max = float(np.max(train_scores))

        feature_stats = {
            col: {
                "mean": float(frame[col].mean()),
                "std": float(max(frame[col].std(ddof=0), 1e-9)),
            }
            for col in FEATURE_COLUMNS
        }

        metadata = self._registry.save_new_model(
            model=model,
            algorithm="IsolationForest",
            training_samples=len(frame),
            score_min=score_min,
            score_max=score_max,
            feature_names=FEATURE_COLUMNS,
            feature_stats=feature_stats,
        )
        return metadata

    def model_status(self) -> dict[str, Any]:
        model, metadata = self._registry.load_current_model()
        monitoring = _MONITOR.summary()

        training_distribution: list[float] = []
        if metadata.feature_stats and "difference_ratio" in metadata.feature_stats:
            baseline = metadata.feature_stats["difference_ratio"]["mean"]
            training_distribution = [float(np.clip(baseline, 0.0, 1.0))] * 50

        drift = _MONITOR.detect_drift(training_distribution=training_distribution)
        return {
            "model_loaded": model is not None,
            "current_model": metadata.current_model,
            "algorithm": metadata.algorithm,
            "trained_at": metadata.trained_at,
            "training_samples": metadata.training_samples,
            "model_version": metadata.model_version,
            "monitoring": monitoring,
            "drift": {
                "drift_score": drift.drift_score,
                "threshold": drift.threshold,
                "drift_detected": drift.drift_detected,
                "recommendation": drift.recommendation,
            },
        }

    def rollback_model(self, *, target_model: str) -> dict[str, Any]:
        return self._registry.rollback(target_model=target_model)

    def monitoring_snapshot(self) -> dict[str, Any]:
        status = self.model_status()
        return {
            "anomaly_rate": status["monitoring"]["anomaly_rate"],
            "false_positive_rate": status["monitoring"]["false_positive_rate"],
            "score_distribution": status["monitoring"]["score_distribution"],
            "drift_detection": status["drift"],
        }

    def _anomaly_score(self, features: dict[str, float]) -> tuple[float, dict[str, float], int]:
        feature_vector = np.array([[features[name] for name in FEATURE_COLUMNS]], dtype=float)
        model, metadata = self._registry.load_current_model()

        if model is None:
            heuristic, impacts = self._heuristic_anomaly(features)
            return heuristic, impacts, 0

        try:
            raw_score = float(model.score_samples(feature_vector)[0])
            score_min = metadata.score_min
            score_max = metadata.score_max
            if np.isclose(score_min, score_max):
                anomaly_score = 0.0
            else:
                anomaly_score = float(np.clip((score_max - raw_score) / (score_max - score_min), 0.0, 1.0))

            impacts: dict[str, float] = {}
            for col in FEATURE_COLUMNS:
                stats = metadata.feature_stats.get(col, {"mean": 0.0, "std": 1.0})
                mean = float(stats.get("mean") or 0.0)
                std = max(float(stats.get("std") or 1.0), 1e-9)
                impacts[col] = (features[col] - mean) / std

            return anomaly_score, impacts, int(metadata.model_version)
        except Exception:
            logger.warning("AI model scoring failed; falling back to heuristic anomaly scoring", exc_info=True)
            heuristic, impacts = self._heuristic_anomaly(features)
            return heuristic, impacts, 0

    def _heuristic_anomaly(self, features: dict[str, float]) -> tuple[float, dict[str, float]]:
        heuristic = min(1.0, float(features["difference_ratio"]))
        impacts = {
            "difference_ratio": heuristic,
            "emission_deviation_from_project_average": float(features["emission_deviation_from_project_average"]),
            "time_since_last_submission": float(features["time_since_last_submission"]),
        }
        return heuristic, impacts

    def _rule_score(self, entry: MaterialEntry) -> tuple[float, list[str]]:
        if self._session is None:
            base = 0.0
            explanations: list[str] = []
            if bool(getattr(entry, "temporal_anomaly", False)):
                base += 0.3
                explanations.append("Temporal anomaly detected")
            if bool(getattr(entry, "audit_required", False)):
                base += 0.3
                explanations.append("Audit requirement flag is active")
            return min(base, 1.0), explanations

        risk_record = RiskEngine(self._session).score_entry(entry=entry)
        explanations = self._collect_rule_explanations(entry)
        return float(risk_record.risk_score) / 100.0, explanations

    def _risk_level(self, score: float) -> str:
        if score < 0.35:
            return "LOW"
        if score < 0.65:
            return "MEDIUM"
        return "HIGH"

    def _collect_rule_explanations(self, entry: MaterialEntry) -> list[str]:
        reasons: list[str] = []

        duplicate_exists_stmt = select(EvidenceFile.id).where(
            EvidenceFile.material_entry_id == entry.id,
            EvidenceFile.duplicate_flag.is_(True),
        )
        if self._session.execute(duplicate_exists_stmt).first() is not None:
            reasons.append("Duplicate evidence detected")

        if bool(entry.temporal_anomaly):
            reasons.append("Temporal anomaly detected")

        ack_count = int(
            self._session.execute(
                select(func.count(EvidenceAcknowledgement.id)).where(
                    EvidenceAcknowledgement.material_entry_id == entry.id
                )
            ).scalar_one()
            or 0
        )
        if ack_count == 0:
            reasons.append("Missing evidence acknowledgement")

        emissions = [
            float(value)
            for value in self._session.execute(
                select(MaterialEntry.calculated_emission).where(
                    MaterialEntry.project_id == entry.project_id
                )
            ).scalars().all()
        ]
        if emissions:
            mean = float(np.mean(emissions))
            std = float(np.std(emissions))
            threshold = mean + (2 * std)
            if float(entry.calculated_emission) > threshold:
                reasons.append("Emission value unusually high")

        return reasons

    def _extract_features(self, entry: MaterialEntry) -> dict[str, float]:
        quantity = float(entry.quantity)
        expected_quantity = self._expected_quantity(entry)
        difference_ratio = 0.0
        if expected_quantity > 0:
            difference_ratio = abs(quantity - expected_quantity) / expected_quantity

        emission_value = float(entry.calculated_emission)
        supplier_frequency = self._supplier_frequency(entry)
        historical_entry_count = self._historical_entry_count(entry)
        material_type_encoding = _material_hash(entry.material_name)
        time_since_last_submission = self._time_since_last_submission_hours(entry)
        emission_deviation = self._emission_deviation(entry)

        return {
            "quantity": quantity,
            "expected_quantity": expected_quantity,
            "difference_ratio": difference_ratio,
            "emission_value": emission_value,
            "supplier_frequency": supplier_frequency,
            "historical_entry_count": historical_entry_count,
            "material_type_encoding": material_type_encoding,
            "time_since_last_submission": time_since_last_submission,
            "emission_deviation_from_project_average": emission_deviation,
        }

    def _expected_quantity(self, entry: MaterialEntry) -> float:
        if self._session is None:
            return float(entry.quantity)

        stmt = select(MaterialEntry.quantity).where(
            MaterialEntry.project_id == entry.project_id,
            MaterialEntry.material_name == entry.material_name,
            MaterialEntry.id != entry.id,
        )
        values = [float(value) for value in self._session.execute(stmt).scalars().all()]
        if not values:
            return float(entry.quantity)
        return float(np.median(np.array(values, dtype=float)))

    def _supplier_frequency(self, entry: MaterialEntry) -> float:
        if self._session is None or not entry.supplier_name:
            return 0.0

        total_count = int(
            self._session.execute(
                select(func.count(MaterialEntry.id)).where(MaterialEntry.project_id == entry.project_id)
            ).scalar_one()
            or 0
        )
        if total_count == 0:
            return 0.0

        supplier_count = int(
            self._session.execute(
                select(func.count(MaterialEntry.id)).where(
                    MaterialEntry.project_id == entry.project_id,
                    MaterialEntry.supplier_name == entry.supplier_name,
                )
            ).scalar_one()
            or 0
        )
        return float(supplier_count) / float(total_count)

    def _historical_entry_count(self, entry: MaterialEntry) -> float:
        if self._session is None:
            return 0.0

        count = int(
            self._session.execute(
                select(func.count(MaterialEntry.id)).where(
                    MaterialEntry.project_id == entry.project_id,
                    MaterialEntry.id != entry.id,
                )
            ).scalar_one()
            or 0
        )
        return float(count)

    def _time_since_last_submission_hours(self, entry: MaterialEntry) -> float:
        if self._session is None or entry.submitted_at is None:
            return 0.0

        latest_previous = self._session.execute(
            select(func.max(MaterialEntry.submitted_at)).where(
                MaterialEntry.project_id == entry.project_id,
                MaterialEntry.id != entry.id,
                MaterialEntry.submitted_at.is_not(None),
            )
        ).scalar_one_or_none()
        if latest_previous is None:
            return 0.0

        current_submitted = entry.submitted_at
        if current_submitted.tzinfo is None:
            current_submitted = current_submitted.replace(tzinfo=timezone.utc)
        if latest_previous.tzinfo is None:
            latest_previous = latest_previous.replace(tzinfo=timezone.utc)

        delta_hours = (current_submitted - latest_previous).total_seconds() / 3600.0
        return max(0.0, float(delta_hours))

    def _emission_deviation(self, entry: MaterialEntry) -> float:
        if self._session is None:
            return 0.0

        avg_emission = self._session.execute(
            select(func.avg(MaterialEntry.calculated_emission)).where(MaterialEntry.project_id == entry.project_id)
        ).scalar_one_or_none()
        if avg_emission in (None, 0):
            return 0.0

        avg_val = float(avg_emission)
        return abs(float(entry.calculated_emission) - avg_val) / max(avg_val, 1e-9)


def _material_hash(material_name: str) -> float:
    digest = hashlib.sha256(material_name.lower().encode("utf-8")).hexdigest()
    bucket = int(digest[:8], 16) % 1000
    return float(bucket) / 1000.0


def calculate_ai_risk(session: Session | None, entry: MaterialEntry) -> dict[str, Any]:
    service = AIRiskService(session)
    result = service.calculate_risk(entry=entry)
    return {
        "anomaly_score": result.anomaly_score,
        "rule_score": result.rule_score,
        "combined_score": result.combined_score,
        "risk_level": result.risk_level,
        "explanation": result.explanation,
        "top_contributing_features": result.top_contributing_features,
        "deviation_details": result.deviation_details,
        "model_version": result.model_version,
    }


def get_ai_monitoring_snapshot() -> dict[str, Any]:
    return AIRiskService(session=None).monitoring_snapshot()
