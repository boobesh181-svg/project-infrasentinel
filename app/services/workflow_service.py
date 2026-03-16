from datetime import datetime, timezone
import hashlib
from pathlib import Path
from enum import Enum
from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.evidence_file import EvidenceFile
from app.models.material_entry import MaterialEntry, MaterialStatus
from app.models.user import User, UserRole
from app.services.audit_service import AuditService
from app.services.notification_service import NotificationService


class WorkflowService:
    def __init__(self, session: Session) -> None:
        self._session = session
        self._audit = AuditService(session)
        self._notifications = NotificationService(session)

    def submit(self, *, entry_id: UUID, actor_user_id: UUID) -> MaterialEntry:
        with self._session.begin():
            entry = self._get_entry(entry_id)
            actor = self._get_user(actor_user_id)
            if entry.status == MaterialStatus.LOCKED:
                raise ValueError("Locked entries are immutable")
            if entry.status != MaterialStatus.DRAFT:
                raise ValueError("Only DRAFT entries can be submitted")
            if actor.role != UserRole.CREATOR or entry.created_by_id != actor.id:
                raise ValueError("Only the creator can submit this entry")

            previous_state = self._snapshot(entry)
            entry.status = MaterialStatus.SUBMITTED

            self._notifications.create_notifications_for_submission(
                entry_id=entry.id,
                actor_user_id=actor.id,
            )

            self._audit.log(
                performed_by_id=actor.id,
                entity_type="MaterialEntry",
                entity_id=entry.id,
                action="SUBMIT",
                previous_state=previous_state,
                new_state=self._snapshot(entry),
            )
            return entry

    def verify(self, *, entry_id: UUID, actor_user_id: UUID) -> MaterialEntry:
        with self._session.begin():
            entry = self._get_entry(entry_id)
            actor = self._get_user(actor_user_id)
            if entry.status == MaterialStatus.LOCKED:
                raise ValueError("Locked entries are immutable")
            if entry.status != MaterialStatus.SUBMITTED:
                raise ValueError("Only SUBMITTED entries can be verified")

            evidence_files = list(
                self._session.execute(
                    select(EvidenceFile).where(
                        EvidenceFile.material_entry_id == entry.id
                    )
                ).scalars().all()
            )
            if not evidence_files:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=(
                        "Verification blocked: no evidence uploaded for this material entry."
                    ),
                )

            if not self._evidence_integrity_ok(evidence_files):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Evidence integrity verification failed.",
                )

            if not self._notifications.notifications_ready_for_verification(
                entry_id=entry.id
            ):
                raise ValueError("Entry has unresolved or disputed notifications")
            if actor.role != UserRole.VERIFIER:
                raise ValueError("Only verifier can verify")
            if entry.created_by_id == actor.id:
                raise ValueError("Creator cannot verify their own entry")

            previous_state = self._snapshot(entry)
            entry.status = MaterialStatus.VERIFIED
            entry.verified_by_id = actor.id

            self._audit.log(
                performed_by_id=actor.id,
                entity_type="MaterialEntry",
                entity_id=entry.id,
                action="verified",
                previous_state=previous_state,
                new_state=self._snapshot(entry),
            )
            return entry

    def approve(self, *, entry_id: UUID, actor_user_id: UUID) -> MaterialEntry:
        with self._session.begin():
            entry = self._get_entry(entry_id)
            actor = self._get_user(actor_user_id)
            if entry.status == MaterialStatus.LOCKED:
                raise ValueError("Locked entries are immutable")
            if entry.status != MaterialStatus.VERIFIED:
                raise ValueError("Only VERIFIED entries can be approved")
            if actor.role != UserRole.APPROVER:
                raise ValueError("Only approver can approve")
            if entry.verified_by_id == actor.id:
                raise ValueError("Approver cannot be the verifier")

            previous_state = self._snapshot(entry)
            entry.status = MaterialStatus.APPROVED
            entry.approved_by_id = actor.id

            self._audit.log(
                performed_by_id=actor.id,
                entity_type="MaterialEntry",
                entity_id=entry.id,
                action="APPROVE",
                previous_state=previous_state,
                new_state=self._snapshot(entry),
            )
            return entry

    def lock(self, *, entry_id: UUID, actor_user_id: UUID) -> MaterialEntry:
        with self._session.begin():
            entry = self._get_entry(entry_id)
            actor = self._get_user(actor_user_id)
            if entry.status != MaterialStatus.APPROVED:
                raise ValueError("Only APPROVED entries can be locked")
            if actor.role != UserRole.ADMIN:
                raise ValueError("Only admin can lock")

            previous_state = self._snapshot(entry)
            entry.status = MaterialStatus.LOCKED
            entry.locked_at = datetime.now(timezone.utc)

            self._audit.log(
                performed_by_id=actor.id,
                entity_type="MaterialEntry",
                entity_id=entry.id,
                action="LOCK",
                previous_state=previous_state,
                new_state=self._snapshot(entry),
            )
            return entry

    def _get_entry(self, entry_id: UUID) -> MaterialEntry:
        stmt = select(MaterialEntry).where(MaterialEntry.id == entry_id).with_for_update()
        entry = self._session.execute(stmt).scalar_one_or_none()
        if entry is None:
            raise ValueError("MaterialEntry not found")
        return entry

    def _get_user(self, user_id: UUID) -> User:
        user = self._session.get(User, user_id)
        if user is None:
            raise ValueError("User not found")
        return user

    def _snapshot(self, entry: MaterialEntry) -> dict[str, Any]:
        return {
            "id": self._serialize(entry.id),
            "status": self._serialize(entry.status),
            "project_id": self._serialize(entry.project_id),
            "material_name": entry.material_name,
            "quantity": float(entry.quantity),
            "factor_version_snapshot": entry.factor_version_snapshot,
            "factor_value_snapshot": float(entry.factor_value_snapshot),
            "factor_unit_snapshot": entry.factor_unit_snapshot,
            "factor_source_snapshot": entry.factor_source_snapshot,
            "calculated_emission": float(entry.calculated_emission),
            "created_by_id": self._serialize(entry.created_by_id),
            "verified_by_id": self._serialize(entry.verified_by_id),
            "approved_by_id": self._serialize(entry.approved_by_id),
            "locked_at": self._serialize(entry.locked_at),
            "created_at": self._serialize(entry.created_at),
        }

    def _serialize(self, value: Any) -> Any:
        if isinstance(value, datetime):
            return value.isoformat()
        if isinstance(value, Enum):
            return value.value
        if isinstance(value, UUID):
            return str(value)
        return value

    def _evidence_integrity_ok(self, evidence_files: list[EvidenceFile]) -> bool:
        for evidence in evidence_files:
            path = Path(evidence.storage_path)
            if not path.exists():
                return False
            if _sha256_file(path) != evidence.file_hash:
                return False
        return True


def _sha256_file(path: Path) -> str:
    hasher = hashlib.sha256()
    with path.open("rb") as handle:
        while True:
            chunk = handle.read(1024 * 1024)
            if not chunk:
                break
            hasher.update(chunk)
    return hasher.hexdigest()

