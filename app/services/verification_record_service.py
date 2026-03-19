from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.emission_record import EmissionRecord
from app.models.material_entry import MaterialStatus
from app.models.material_event import MaterialEvent
from app.models.user import User, UserRole
from app.models.verification_record import VerificationRecord
from app.services.verification_audit_service import VerificationAuditService


class VerificationRecordService:
    def __init__(self, session: Session) -> None:
        self._session = session
        self._audit = VerificationAuditService(session)

    def start_review(self, *, emission_record_id: UUID, actor: User, notes: str | None = None) -> VerificationRecord:
        if actor.role not in {UserRole.VERIFIER, UserRole.ESG_ANALYST, UserRole.ADMIN}:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Verifier role required")

        emission = self._session.get(EmissionRecord, emission_record_id)
        if emission is None or emission.organization_id != actor.organization_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Emission record not found")

        event = self._session.get(MaterialEvent, emission.material_event_id)
        if event is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Material event not found")

        event.status = MaterialStatus.UNDER_REVIEW
        record = VerificationRecord(
            organization_id=actor.organization_id,
            emission_record_id=emission.id,
            verifier_id=actor.id,
            approver_id=None,
            submitted_at=datetime.now(timezone.utc),
            reviewed_at=None,
            approved_at=None,
            locked_at=None,
            review_notes=notes,
            created_at=datetime.now(timezone.utc),
            created_by=actor.id,
            status="UNDER_REVIEW",
        )
        self._session.add(record)
        self._session.flush()

        self._audit.log(
            organization_id=actor.organization_id,
            entity_type="verification_record",
            entity_id=record.id,
            action="SUBMIT_FOR_VERIFICATION",
            user_id=actor.id,
            before_state={},
            after_state={"status": record.status, "emission_record_id": str(emission.id)},
        )
        return record

    def verify(self, *, verification_id: UUID, actor: User, notes: str | None = None) -> VerificationRecord:
        if actor.role not in {UserRole.VERIFIER, UserRole.ESG_ANALYST, UserRole.ADMIN}:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Verifier role required")

        record = self._session.get(VerificationRecord, verification_id)
        if record is None or record.organization_id != actor.organization_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Verification record not found")
        if record.status != "UNDER_REVIEW":
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Record must be under review")

        record.status = "VERIFIED"
        record.verifier_id = actor.id
        record.reviewed_at = datetime.now(timezone.utc)
        if notes:
            record.review_notes = notes

        emission = self._session.get(EmissionRecord, record.emission_record_id)
        if emission is not None:
            event = self._session.get(MaterialEvent, emission.material_event_id)
            if event is not None:
                event.status = MaterialStatus.VERIFIED

        self._audit.log(
            organization_id=actor.organization_id,
            entity_type="verification_record",
            entity_id=record.id,
            action="VERIFY_RECORD",
            user_id=actor.id,
            before_state={"status": "UNDER_REVIEW"},
            after_state={"status": "VERIFIED"},
        )
        return record

    def approve(self, *, verification_id: UUID, actor: User, notes: str | None = None) -> VerificationRecord:
        if actor.role not in {UserRole.APPROVER, UserRole.CONTRACTOR_MANAGER, UserRole.ADMIN}:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Approver role required")

        record = self._session.get(VerificationRecord, verification_id)
        if record is None or record.organization_id != actor.organization_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Verification record not found")
        if record.status != "VERIFIED":
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Record must be verified")

        record.status = "APPROVED"
        record.approver_id = actor.id
        record.approved_at = datetime.now(timezone.utc)
        if notes:
            record.review_notes = notes

        emission = self._session.get(EmissionRecord, record.emission_record_id)
        if emission is not None:
            event = self._session.get(MaterialEvent, emission.material_event_id)
            if event is not None:
                event.status = MaterialStatus.APPROVED

        self._audit.log(
            organization_id=actor.organization_id,
            entity_type="verification_record",
            entity_id=record.id,
            action="APPROVE_RECORD",
            user_id=actor.id,
            before_state={"status": "VERIFIED"},
            after_state={"status": "APPROVED"},
        )
        return record

    def lock(self, *, verification_id: UUID, actor: User, notes: str | None = None) -> VerificationRecord:
        if actor.role not in {UserRole.APPROVER, UserRole.CONTRACTOR_MANAGER, UserRole.ADMIN}:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Approver role required")

        record = self._session.get(VerificationRecord, verification_id)
        if record is None or record.organization_id != actor.organization_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Verification record not found")
        if record.status != "APPROVED":
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Record must be approved")

        record.status = "LOCKED"
        record.locked_at = datetime.now(timezone.utc)
        if notes:
            record.review_notes = notes

        emission = self._session.get(EmissionRecord, record.emission_record_id)
        if emission is not None:
            event = self._session.get(MaterialEvent, emission.material_event_id)
            if event is not None:
                event.status = MaterialStatus.LOCKED

        self._audit.log(
            organization_id=actor.organization_id,
            entity_type="verification_record",
            entity_id=record.id,
            action="LOCK_RECORD",
            user_id=actor.id,
            before_state={"status": "APPROVED"},
            after_state={"status": "LOCKED"},
        )
        return record

    def get(self, *, verification_id: UUID, actor: User) -> VerificationRecord:
        stmt = select(VerificationRecord).where(
            VerificationRecord.id == verification_id,
            VerificationRecord.organization_id == actor.organization_id,
        )
        record = self._session.execute(stmt).scalar_one_or_none()
        if record is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Verification record not found")
        return record
