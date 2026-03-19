from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.bim_material_estimate import BIMMaterialEstimate
from app.models.material_entry import MaterialEntry


class BIMValidationService:
    def __init__(self, session: Session) -> None:
        self._session = session

    def validate_project(self, *, project_id: UUID, discrepancy_threshold: float = 0.30) -> list[dict[str, object]]:
        estimate_rows = self._session.execute(
            select(BIMMaterialEstimate).where(BIMMaterialEstimate.project_id == project_id)
        ).scalars().all()

        reported_entries = self._session.execute(
            select(MaterialEntry.material_name, MaterialEntry.quantity)
            .where(MaterialEntry.project_id == project_id)
        ).all()

        reported_map: dict[str, float] = {}
        for material_name, quantity in reported_entries:
            normalized = _normalize_material_name(str(material_name))
            if normalized is None:
                continue
            reported_map[normalized] = reported_map.get(normalized, 0.0) + float(quantity)

        flagged: list[dict[str, object]] = []
        summaries: list[dict[str, object]] = []
        for estimate in estimate_rows:
            material_key = estimate.material_type.lower()
            reported_quantity = reported_map.get(material_key, 0.0)
            estimated_quantity = float(estimate.estimated_quantity)
            baseline = estimated_quantity if estimated_quantity > 0 else 1.0
            discrepancy_ratio = abs(estimated_quantity - reported_quantity) / baseline
            status = _status_for_ratio(discrepancy_ratio)

            summaries.append(
                {
                    "project_id": project_id,
                    "material_type": estimate.material_type,
                    "estimated_quantity": estimated_quantity,
                    "reported_quantity": reported_quantity,
                    "discrepancy_ratio": round(discrepancy_ratio, 4),
                    "status": status,
                }
            )

            if discrepancy_ratio >= discrepancy_threshold:
                flagged.append(
                    {
                        "project_id": project_id,
                        "material_type": estimate.material_type,
                        "estimated_quantity": estimated_quantity,
                        "reported_quantity": reported_quantity,
                        "discrepancy_ratio": round(discrepancy_ratio, 4),
                        "status": status,
                    }
                )

        self._apply_entry_flags(project_id=project_id, discrepancies=summaries)
        return flagged

    def summarize_project(self, *, project_id: UUID) -> list[dict[str, object]]:
        estimate_rows = self._session.execute(
            select(BIMMaterialEstimate).where(BIMMaterialEstimate.project_id == project_id)
        ).scalars().all()

        reported_entries = self._session.execute(
            select(MaterialEntry.material_name, MaterialEntry.quantity)
            .where(MaterialEntry.project_id == project_id)
        ).all()
        reported_map: dict[str, float] = {}
        for material_name, quantity in reported_entries:
            normalized = _normalize_material_name(str(material_name))
            if normalized is None:
                continue
            reported_map[normalized] = reported_map.get(normalized, 0.0) + float(quantity)

        summaries: list[dict[str, object]] = []
        for estimate in estimate_rows:
            material_key = estimate.material_type.lower()
            estimated_quantity = float(estimate.estimated_quantity)
            reported_quantity = reported_map.get(material_key, 0.0)
            baseline = estimated_quantity if estimated_quantity > 0 else 1.0
            discrepancy_ratio = abs(estimated_quantity - reported_quantity) / baseline
            summaries.append(
                {
                    "material": material_key,
                    "estimated": estimated_quantity,
                    "reported": reported_quantity,
                    "discrepancy": round(discrepancy_ratio * 100.0, 2),
                    "status": _status_for_ratio(discrepancy_ratio),
                }
            )

        self._apply_entry_flags(project_id=project_id, discrepancies=[
            {
                "material_type": item["material"],
                "discrepancy_ratio": float(item["discrepancy"]) / 100.0,
            }
            for item in summaries
        ])
        return summaries

    def _apply_entry_flags(self, *, project_id: UUID, discrepancies: list[dict[str, object]]) -> None:
        ratio_by_material = {
            item["material_type"].lower(): float(item["discrepancy_ratio"])
            for item in discrepancies
        }
        entries = self._session.execute(
            select(MaterialEntry).where(MaterialEntry.project_id == project_id)
        ).scalars().all()

        for entry in entries:
            normalized_entry_material = _normalize_material_name(entry.material_name)
            if normalized_entry_material is None:
                continue
            ratio = ratio_by_material.get(normalized_entry_material)
            if ratio is None:
                continue
            entry.bim_discrepancy_score = ratio
            entry.bim_validation_status = _status_for_ratio(ratio)


def _normalize_material_name(raw: str) -> str | None:
    lowered = raw.lower()
    if "concrete" in lowered or "cement" in lowered:
        return "concrete"
    if "steel" in lowered or "rebar" in lowered:
        return "steel"
    if "glass" in lowered:
        return "glass"
    return None


def _status_for_ratio(ratio: float) -> str:
    if ratio > 0.30:
        return "HIGH"
    if ratio > 0.15:
        return "WARNING"
    return "OK"
