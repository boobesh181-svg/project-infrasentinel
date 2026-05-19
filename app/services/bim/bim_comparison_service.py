from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.bim_material import BIMMaterial
from app.models.bim_model import BIMModel, BIMProcessingStatus
from app.models.material_entry import MaterialEntry


@dataclass
class MaterialComparisonResult:
    material: str
    expected: float
    reported: float
    difference: float
    difference_ratio: float
    risk_score: float
    risk_level: str


class BIMComparisonService:
    def __init__(self, session: Session) -> None:
        self._session = session

    def compare_project_materials(
        self,
        *,
        project_id: UUID,
        risk_threshold: float = 0.25,
    ) -> dict[str, object]:
        model = self._session.execute(
            select(BIMModel)
            .where(
                BIMModel.project_id == project_id,
                BIMModel.processing_status == BIMProcessingStatus.PROCESSED,
            )
            .order_by(BIMModel.created_at.desc())
            .limit(1)
        ).scalar_one_or_none()

        if model is None:
            return {
                "project_id": str(project_id),
                "bim_model_id": None,
                "comparisons": [],
                "anomalies": [],
            }

        bim_materials = self._session.execute(
            select(BIMMaterial).where(BIMMaterial.bim_model_id == model.id)
        ).scalars().all()

        expected: dict[str, float] = {}
        for material in bim_materials:
            key = self._normalize_material_name(material.material_name)
            expected[key] = expected.get(key, 0.0) + float(material.quantity)

        reported_entries = self._session.execute(
            select(MaterialEntry.material_name, MaterialEntry.quantity).where(MaterialEntry.project_id == project_id)
        ).all()

        reported: dict[str, float] = {}
        for material_name, quantity in reported_entries:
            key = self._normalize_material_name(str(material_name))
            reported[key] = reported.get(key, 0.0) + float(quantity)

        materials = sorted(set(expected.keys()) | set(reported.keys()))
        comparisons: list[dict[str, object]] = []
        anomalies: list[dict[str, object]] = []

        for material in materials:
            expected_value = expected.get(material, 0.0)
            reported_value = reported.get(material, 0.0)
            difference = expected_value - reported_value
            baseline = expected_value if expected_value > 0 else max(reported_value, 1.0)
            difference_ratio = abs(difference) / baseline
            risk_score = min(1.0, difference_ratio)
            risk_level = "HIGH_RISK" if difference_ratio > risk_threshold else "OK"

            row = {
                "material": material,
                "expected": round(expected_value, 6),
                "reported": round(reported_value, 6),
                "difference": round(difference, 6),
                "difference_ratio": round(difference_ratio, 6),
                "risk_score": round(risk_score, 6),
                "risk_level": risk_level,
            }
            comparisons.append(row)
            if risk_level == "HIGH_RISK":
                anomalies.append(row)

        return {
            "project_id": str(project_id),
            "bim_model_id": str(model.id),
            "comparisons": comparisons,
            "anomalies": anomalies,
        }

    def _normalize_material_name(self, value: str) -> str:
        lowered = value.strip().lower()
        if "concrete" in lowered or "cement" in lowered:
            return "concrete"
        if "steel" in lowered or "rebar" in lowered or "reinforcement" in lowered:
            return "steel"
        if "glass" in lowered:
            return "glass"
        return lowered or "unknown"
