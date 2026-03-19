from __future__ import annotations

from datetime import datetime, timedelta, timezone
import statistics
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.entry_risk_score import EntryRiskScore, RiskLevel
from app.models.evidence_acknowledgement import (
    AcknowledgementResponseType,
    AcknowledgementRole,
    EvidenceAcknowledgement,
)
from app.models.evidence_file import EvidenceFile
from app.models.material_entry import MaterialEntry
from app.models.project import Project
from app.models.user import User
from app.services.audit_service import AuditService
from app.services.evidence_integrity_service import EvidenceIntegrityService


class RiskEngineService:
    DUPLICATE_EVIDENCE_POINTS = 30
    MISSING_SUPPLIER_CONFIRMATION_POINTS = 20
    BIM_HIGH_DISCREPANCY_POINTS = 40
    TEMPORAL_ANOMALY_POINTS = 10
    UNUSUAL_EMISSION_POINTS = 20
    LATE_EVIDENCE_UPLOAD_POINTS = 10

    def __init__(self, session: Session) -> None:
        self._session = session
        self._audit = AuditService(session)

    def calculate_risk(self, *, entry_id: UUID, actor: User) -> EntryRiskScore:
        entry = self._session.execute(
            select(MaterialEntry)
            .join(Project, Project.id == MaterialEntry.project_id)
            .where(
                MaterialEntry.id == entry_id,
                Project.organization_id == actor.organization_id,
            )
        ).scalar_one_or_none()
        if entry is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Material entry not found")

        EvidenceIntegrityService(self._session).refresh_duplicate_flags(organization_id=actor.organization_id)

        score = 0
        reasons: list[str] = []

        if self._has_duplicate_evidence(entry_id=entry.id):
            score += self.DUPLICATE_EVIDENCE_POINTS
            reasons.append("Duplicate evidence detected")

        if self._is_missing_supplier_confirmation(entry=entry):
            score += self.MISSING_SUPPLIER_CONFIRMATION_POINTS
            reasons.append("Supplier confirmation missing")

        if (entry.bim_validation_status or "").upper() == "HIGH":
            score += self.BIM_HIGH_DISCREPANCY_POINTS
            reasons.append("BIM discrepancy detected")

        if self._has_temporal_anomaly(entry=entry, organization_id=actor.organization_id):
            score += self.TEMPORAL_ANOMALY_POINTS
            reasons.append("Temporal anomaly detected")

        if self._has_late_evidence_upload(entry=entry):
            score += self.LATE_EVIDENCE_UPLOAD_POINTS
            reasons.append("Late evidence upload detected")

        if self._is_unusual_emission(entry=entry):
            score += self.UNUSUAL_EMISSION_POINTS
            reasons.append("Unusual emission value detected")

        risk_score = min(score, 100)
        risk_level = self._to_level(risk_score)

        existing = self._session.execute(
            select(EntryRiskScore).where(EntryRiskScore.entry_id == entry.id)
        ).scalar_one_or_none()
        previous_state: dict[str, object]
        if existing is None:
            existing = EntryRiskScore(
                entry_id=entry.id,
                risk_score=risk_score,
                risk_level=risk_level,
                reasons=reasons,
                generated_at=datetime.now(timezone.utc),
            )
            self._session.add(existing)
            self._session.flush()
            previous_state = {}
        else:
            previous_state = {
                "risk_score": int(existing.risk_score),
                "risk_level": existing.risk_level.value,
                "reasons": list(existing.reasons or []),
                "generated_at": existing.generated_at.isoformat(),
            }
            existing.risk_score = risk_score
            existing.risk_level = risk_level
            existing.reasons = reasons
            existing.generated_at = datetime.now(timezone.utc)
            self._session.flush()

        self._audit.log(
            performed_by_id=actor.id,
            entity_type="EntryRiskScore",
            entity_id=existing.id,
            action="RISK_ANALYSIS_RUN",
            previous_state=previous_state,
            new_state={
                "entry_id": str(existing.entry_id),
                "risk_score": int(existing.risk_score),
                "risk_level": existing.risk_level.value,
                "reasons": list(existing.reasons or []),
                "generated_at": existing.generated_at.isoformat(),
            },
        )

        return existing

    def list_high_risk(self, *, actor: User) -> list[tuple[MaterialEntry, EntryRiskScore]]:
        entries = self._session.execute(
            select(MaterialEntry)
            .join(Project, Project.id == MaterialEntry.project_id)
            .where(Project.organization_id == actor.organization_id)
        ).scalars().all()

        for entry in entries:
            self.calculate_risk(entry_id=entry.id, actor=actor)

        stmt = (
            select(MaterialEntry, EntryRiskScore)
            .join(EntryRiskScore, EntryRiskScore.entry_id == MaterialEntry.id)
            .join(Project, Project.id == MaterialEntry.project_id)
            .where(
                Project.organization_id == actor.organization_id,
                EntryRiskScore.risk_level == RiskLevel.HIGH,
            )
            .order_by(EntryRiskScore.risk_score.desc(), EntryRiskScore.generated_at.desc())
        )
        return list(self._session.execute(stmt).all())

    def _has_duplicate_evidence(self, *, entry_id: UUID) -> bool:
        stmt = select(EvidenceFile.id).where(
            EvidenceFile.material_entry_id == entry_id,
            EvidenceFile.duplicate_flag.is_(True),
        )
        return self._session.execute(stmt).first() is not None

    def _is_missing_supplier_confirmation(self, *, entry: MaterialEntry) -> bool:
        if not entry.supplier_email:
            return False

        ack_stmt = select(EvidenceAcknowledgement.id).where(
            EvidenceAcknowledgement.material_entry_id == entry.id,
            EvidenceAcknowledgement.role == AcknowledgementRole.SUPPLIER,
            EvidenceAcknowledgement.response_type == AcknowledgementResponseType.ACK,
        )
        return self._session.execute(ack_stmt).first() is None

    def _has_temporal_anomaly(self, *, entry: MaterialEntry, organization_id: UUID) -> bool:
        if entry.submitted_at and (entry.submitted_at - entry.created_at) < timedelta(seconds=10):
            fast_entries = self._session.execute(
                select(MaterialEntry)
                .join(Project, Project.id == MaterialEntry.project_id)
                .where(
                    Project.organization_id == organization_id,
                    MaterialEntry.submitted_at.is_not(None),
                )
            ).scalars().all()

            fast_count = 0
            for candidate in fast_entries:
                if candidate.submitted_at and (candidate.submitted_at - candidate.created_at) < timedelta(seconds=10):
                    fast_count += 1
            if fast_count >= 3:
                return True

        return bool(entry.temporal_anomaly)

    def _has_late_evidence_upload(self, *, entry: MaterialEntry) -> bool:
        if entry.submitted_at is None:
            return False

        late_threshold = entry.submitted_at + timedelta(hours=24)
        late_evidence_stmt = select(EvidenceFile.id).where(
            EvidenceFile.material_entry_id == entry.id,
            EvidenceFile.uploaded_at > late_threshold,
        )
        return self._session.execute(late_evidence_stmt).first() is not None

    def _is_unusual_emission(self, *, entry: MaterialEntry) -> bool:
        emissions = [
            float(value)
            for value in self._session.execute(
                select(MaterialEntry.calculated_emission).where(MaterialEntry.project_id == entry.project_id)
            ).scalars().all()
        ]
        if not emissions:
            return False

        emission = float(entry.calculated_emission)
        avg_emission = statistics.fmean(emissions)
        stddev = statistics.pstdev(emissions) if len(emissions) > 1 else 0.0
        return emission > (avg_emission + (2 * stddev)) and emission > (avg_emission * 1.5)

    def _to_level(self, score: int) -> RiskLevel:
        if score <= 30:
            return RiskLevel.LOW
        if score < 60:
            return RiskLevel.MEDIUM
        return RiskLevel.HIGH
