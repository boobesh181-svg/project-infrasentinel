from __future__ import annotations

from dataclasses import dataclass
import logging
import threading
from typing import Any

import numpy as np
import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.material_entry import MaterialEntry
from app.services.ai_risk_service import AIRiskService

try:
    from sklearn.ensemble import IsolationForest
except Exception:  # pragma: no cover - graceful fallback if sklearn is unavailable
    IsolationForest = None  # type: ignore[assignment]


logger = logging.getLogger("infrasentinel")


FEATURE_COLUMNS = ["quantity", "expected_quantity", "difference_ratio", "emission_value"]


@dataclass(frozen=True)
class AnomalyResult:
    risk_score: float
    risk_level: str
    reason: str


class MaterialAnomalyDetector:
    def __init__(self, contamination: float = 0.08, random_state: int = 42) -> None:
        self._contamination = contamination
        self._random_state = random_state
        self._model: object | None = None
        self._score_min: float = -1.0
        self._score_max: float = 1.0
        self._trained = False
        self._lock = threading.Lock()

    @property
    def is_trained(self) -> bool:
        return self._trained and self._model is not None

    def train_from_session(self, session: Session) -> bool:
        rows = session.execute(select(MaterialEntry)).scalars().all()
        records = [self._entry_to_record(entry, session=session) for entry in rows]
        return self.train(records)

    def train(self, records: list[dict[str, Any]]) -> bool:
        if IsolationForest is None:
            logger.warning("scikit-learn unavailable; anomaly detector will run in heuristic mode")
            self._trained = False
            self._model = None
            return False

        frame = self._records_to_frame(records)
        if len(frame) < 15:
            logger.info("Insufficient history for IsolationForest training; falling back to heuristic mode")
            self._trained = False
            self._model = None
            return False

        model = IsolationForest(
            n_estimators=200,
            contamination=self._contamination,
            random_state=self._random_state,
        )
        data = frame[FEATURE_COLUMNS].to_numpy(dtype=float)
        model.fit(data)

        train_scores = model.score_samples(data)
        self._score_min = float(np.min(train_scores))
        self._score_max = float(np.max(train_scores))
        if np.isclose(self._score_min, self._score_max):
            self._score_min -= 1e-6

        self._model = model
        self._trained = True
        return True

    def detect(self, material_entry: dict[str, Any] | MaterialEntry, session: Session | None = None) -> AnomalyResult:
        record = self._normalize_record(material_entry, session=session)

        with self._lock:
            if self.is_trained:
                score = float(self._model.score_samples(np.array([[record[col] for col in FEATURE_COLUMNS]], dtype=float))[0])
                model_risk = (self._score_max - score) / (self._score_max - self._score_min)
                model_risk = float(np.clip(model_risk, 0.0, 1.0))
            else:
                model_risk = min(1.0, float(record["difference_ratio"]))

        # Bias toward quantity mismatch so obvious under-reporting is not missed.
        quantity_risk = float(np.clip(record["difference_ratio"], 0.0, 1.0))
        risk_score = max(model_risk, quantity_risk)
        risk_level = _risk_level_from_score(risk_score)

        reason = "material quantity anomaly" if risk_level in {"MEDIUM", "HIGH"} else "within expected range"
        return AnomalyResult(
            risk_score=round(float(risk_score), 4),
            risk_level=risk_level,
            reason=reason,
        )

    def _entry_to_record(self, entry: MaterialEntry, session: Session) -> dict[str, float]:
        expected_quantity = self._estimate_expected_quantity(
            quantity=float(entry.quantity),
            material_name=entry.material_name,
            project_id=entry.project_id,
            session=session,
            exclude_id=entry.id,
        )

        return {
            "quantity": float(entry.quantity),
            "expected_quantity": expected_quantity,
            "difference_ratio": _difference_ratio(float(entry.quantity), expected_quantity),
            "emission_value": float(entry.calculated_emission),
        }

    def _normalize_record(
        self,
        material_entry: dict[str, Any] | MaterialEntry,
        session: Session | None,
    ) -> dict[str, float]:
        if isinstance(material_entry, MaterialEntry):
            quantity = float(material_entry.quantity)
            emission_value = float(material_entry.calculated_emission)
            expected_quantity = self._estimate_expected_quantity(
                quantity=quantity,
                material_name=material_entry.material_name,
                project_id=material_entry.project_id,
                session=session,
                exclude_id=material_entry.id,
            )
        else:
            quantity = float(material_entry.get("quantity", 0.0))
            emission_value = float(material_entry.get("emission", material_entry.get("emission_value", 0.0)))
            expected_quantity = float(material_entry.get("expected_quantity", quantity))

        return {
            "quantity": quantity,
            "expected_quantity": expected_quantity,
            "difference_ratio": _difference_ratio(quantity, expected_quantity),
            "emission_value": emission_value,
        }

    def _estimate_expected_quantity(
        self,
        *,
        quantity: float,
        material_name: str,
        project_id: Any,
        session: Session | None,
        exclude_id: Any,
    ) -> float:
        if session is None:
            return quantity

        stmt = select(MaterialEntry.quantity).where(
            MaterialEntry.project_id == project_id,
            MaterialEntry.material_name == material_name,
            MaterialEntry.id != exclude_id,
        )
        historical = [float(row) for row in session.execute(stmt).scalars().all()]
        if not historical:
            return quantity
        return float(np.median(np.array(historical, dtype=float)))

    def _records_to_frame(self, records: list[dict[str, Any]]) -> pd.DataFrame:
        if not records:
            return pd.DataFrame(columns=FEATURE_COLUMNS)

        frame = pd.DataFrame.from_records(records)
        if "emission" in frame.columns and "emission_value" not in frame.columns:
            frame["emission_value"] = frame["emission"]

        for col in ("quantity", "expected_quantity", "emission_value"):
            frame[col] = pd.to_numeric(frame.get(col), errors="coerce")

        if "difference_ratio" not in frame.columns:
            frame["difference_ratio"] = (
                (frame["quantity"] - frame["expected_quantity"]).abs()
                / frame["expected_quantity"].replace(0, np.nan)
            )

        frame["difference_ratio"] = pd.to_numeric(frame["difference_ratio"], errors="coerce")
        frame = frame.replace([np.inf, -np.inf], np.nan)
        frame = frame.fillna(0.0)
        return frame[FEATURE_COLUMNS]


_DETECTOR = MaterialAnomalyDetector()


def train_material_anomaly_model(session: Session) -> bool:
    """Train the global IsolationForest model from historical material entries."""
    with _DETECTOR._lock:
        return _DETECTOR.train_from_session(session)


def detect_material_anomaly(
    material_entry: dict[str, Any] | MaterialEntry,
    session: Session | None = None,
) -> dict[str, Any]:
    """Predict anomaly risk for a material entry.

    Returns a dictionary with keys: risk_score, risk_level, reason.
    """
    if session is not None and isinstance(material_entry, MaterialEntry):
        unified = AIRiskService(session).calculate_risk(entry=material_entry)
        return {
            "risk_score": unified.combined_score,
            "risk_level": unified.risk_level,
            "reason": "; ".join(unified.explanation[:2]),
        }

    if session is not None and not _DETECTOR.is_trained:
        try:
            train_material_anomaly_model(session)
        except Exception:
            logger.exception("Failed to train anomaly model; continuing in heuristic mode")

    result = _DETECTOR.detect(material_entry, session=session)
    return {
        "risk_score": result.risk_score,
        "risk_level": result.risk_level,
        "reason": result.reason,
    }


def _difference_ratio(quantity: float, expected_quantity: float) -> float:
    if expected_quantity <= 0:
        return 0.0
    return abs(quantity - expected_quantity) / expected_quantity


def _risk_level_from_score(score: float) -> str:
    if score < 0.3:
        return "LOW"
    if score < 0.6:
        return "MEDIUM"
    return "HIGH"
