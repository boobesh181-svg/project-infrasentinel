from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.entry_risk_score import EntryRiskScore, RiskLevel
from app.models.evidence_acknowledgement import EvidenceAcknowledgement
from app.models.evidence_file import EvidenceFile
from app.models.material_entry import MaterialEntry
from app.models.project import Project


class RiskEngine:
    def __init__(self, session: Session) -> None:
        self._session = session

    def score_entry(self, *, entry: MaterialEntry) -> EntryRiskScore:
        score = 0.0

        duplicate_exists_stmt = select(EvidenceFile.id).where(
            EvidenceFile.material_entry_id == entry.id,
            EvidenceFile.duplicate_flag.is_(True),
        )
        if self._session.execute(duplicate_exists_stmt).first() is not None:
            score += 35.0

        if entry.temporal_anomaly:
            score += 25.0

        if not self._has_acknowledgements(entry_id=entry.id):
            score += 20.0

        if self._is_abnormal_emission(entry=entry):
            score += 20.0

        capped = min(score, 100.0)
        level = self._to_level(capped)

        existing = self._session.execute(
            select(EntryRiskScore).where(EntryRiskScore.entry_id == entry.id)
        ).scalar_one_or_none()

        generated_at = datetime.now(timezone.utc)
        if existing is None:
            existing = EntryRiskScore(
                entry_id=entry.id,
                risk_score=capped,
                risk_level=level,
                generated_at=generated_at,
            )
            self._session.add(existing)
        else:
            existing.risk_score = capped
            existing.risk_level = level
            existing.generated_at = generated_at

        return existing

    def high_risk_entries(self, *, organization_id: UUID) -> list[tuple[MaterialEntry, EntryRiskScore]]:
        stmt = (
            select(MaterialEntry, EntryRiskScore)
            .join(Project, Project.id == MaterialEntry.project_id)
            .join(EntryRiskScore, EntryRiskScore.entry_id == MaterialEntry.id)
            .where(
                Project.organization_id == organization_id,
                EntryRiskScore.risk_level == RiskLevel.HIGH,
            )
            .order_by(EntryRiskScore.risk_score.desc())
        )
        return list(self._session.execute(stmt).all())

    def _to_level(self, score: float) -> RiskLevel:
        if score >= 70:
            return RiskLevel.HIGH
        if score >= 35:
            return RiskLevel.MEDIUM
        return RiskLevel.LOW

    def _has_acknowledgements(self, *, entry_id: UUID) -> bool:
        count_stmt = select(func.count(EvidenceAcknowledgement.id)).where(
            EvidenceAcknowledgement.material_entry_id == entry_id
        )
        return int(self._session.execute(count_stmt).scalar_one()) > 0

    def _is_abnormal_emission(self, *, entry: MaterialEntry) -> bool:
        avg_stmt = (
            select(func.avg(MaterialEntry.calculated_emission), func.stddev_pop(MaterialEntry.calculated_emission))
            .where(MaterialEntry.project_id == entry.project_id)
        )
        avg_value, stddev_value = self._session.execute(avg_stmt).one()
        if avg_value is None:
            return False

        emission = float(entry.calculated_emission)
        avg_emission = float(avg_value)
        stddev = float(stddev_value or 0.0)
        threshold = avg_emission + 2 * stddev
        return emission > threshold and emission > avg_emission * 1.5
