from __future__ import annotations

import logging
from uuid import UUID

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.models.evidence_file import EvidenceFile
from app.models.material_entry import MaterialEntry, MaterialStatus

logger = logging.getLogger("infrasentinel")


class IntegrityScoringService:
    """Compute infrastructure integrity score from project material records."""

    def __init__(self, session: Session) -> None:
        self.session = session

    def calculate_project_score(self, project_id: UUID) -> dict[str, object]:
        material_verification = self._material_verification_score(project_id)
        emission_accuracy = self._emission_accuracy_score(project_id)
        anomaly_risk = self._anomaly_risk_score(project_id)
        evidence_completeness = self._evidence_completeness_score(project_id)

        weights = {
            "material_verification": 0.35,
            "emission_accuracy": 0.25,
            "anomaly_risk": 0.20,
            "evidence_completeness": 0.20,
        }

        weighted = (
            material_verification * weights["material_verification"]
            + emission_accuracy * weights["emission_accuracy"]
            + anomaly_risk * weights["anomaly_risk"]
            + evidence_completeness * weights["evidence_completeness"]
        )
        integrity_score = int(round(weighted))

        result = {
            "integrity_score": integrity_score,
            "breakdown": {
                "material_verification": material_verification,
                "emission_accuracy": emission_accuracy,
                "anomaly_risk": anomaly_risk,
                "evidence_completeness": evidence_completeness,
            },
        }
        logger.info(
            "Integrity score calculated for project_id=%s score=%s breakdown=%s",
            str(project_id),
            integrity_score,
            result["breakdown"],
        )
        return result

    def _material_verification_score(self, project_id: UUID) -> int:
        query = select(
            func.count(MaterialEntry.id),
            func.sum(
                case(
                    (
                        MaterialEntry.status.in_(
                            [
                                MaterialStatus.VERIFIED,
                                MaterialStatus.APPROVED,
                                MaterialStatus.LOCKED,
                            ]
                        ),
                        1,
                    ),
                    else_=0,
                )
            ),
        ).where(MaterialEntry.project_id == project_id)
        total_entries, verified_entries = self.session.execute(query).one()
        total = int(total_entries or 0)
        verified = int(verified_entries or 0)
        if total == 0:
            return 0
        return int(round((verified / total) * 100))

    def _emission_accuracy_score(self, project_id: UUID) -> int:
        query = select(
            func.avg(
                func.abs(
                    MaterialEntry.calculated_emission
                    - (MaterialEntry.quantity * MaterialEntry.factor_value_snapshot)
                )
                / func.nullif(func.abs(MaterialEntry.calculated_emission), 0)
            )
        ).where(MaterialEntry.project_id == project_id)
        avg_relative_error = self.session.execute(query).scalar_one_or_none()
        if avg_relative_error is None:
            return 0
        error = float(avg_relative_error)
        normalized_error = min(max(error, 0.0), 1.0)
        return int(round((1.0 - normalized_error) * 100))

    def _anomaly_risk_score(self, project_id: UUID) -> int:
        query = select(
            func.avg(MaterialEntry.ai_risk_score),
            func.avg(
                case(
                    (MaterialEntry.temporal_anomaly.is_(True), 100.0),
                    else_=0.0,
                )
            ),
            func.avg(func.coalesce(MaterialEntry.bim_discrepancy_score, 0.0)),
        ).where(MaterialEntry.project_id == project_id)
        avg_ai_risk, temporal_anomaly_penalty, bim_discrepancy_avg = self.session.execute(query).one()

        if avg_ai_risk is not None and float(avg_ai_risk) <= 1.0:
            avg_ai_risk = float(avg_ai_risk) * 100.0
        if bim_discrepancy_avg is not None and float(bim_discrepancy_avg) <= 1.0:
            bim_discrepancy_avg = float(bim_discrepancy_avg) * 100.0

        risk_sources = [
            float(value)
            for value in (avg_ai_risk, temporal_anomaly_penalty, bim_discrepancy_avg)
            if value is not None
        ]
        if not risk_sources:
            return 100

        avg_risk = sum(risk_sources) / len(risk_sources)
        normalized_risk = min(max(avg_risk, 0.0), 100.0)
        return int(round(100.0 - normalized_risk))

    def _evidence_completeness_score(self, project_id: UUID) -> int:
        entries_cte = (
            select(MaterialEntry.id)
            .where(MaterialEntry.project_id == project_id)
            .cte("project_entries")
        )

        query = (
            select(
                func.count(entries_cte.c.id),
                func.count(func.distinct(EvidenceFile.material_entry_id)),
            )
            .select_from(entries_cte)
            .join(
                EvidenceFile,
                EvidenceFile.material_entry_id == entries_cte.c.id,
                isouter=True,
            )
        )
        total_entries, covered_entries = self.session.execute(query).one()
        total = int(total_entries or 0)
        covered = int(covered_entries or 0)
        if total == 0:
            return 0
        return int(round((covered / total) * 100))
