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
from app.models.user_key import UserKey
from app.models.user import User, UserRole
from app.schemas.material_entry import WorkflowSignatureIn
from app.services.acknowledgement_service import AcknowledgementService
from app.services.ai_risk_service import AIRiskService
from app.services.audit_service import AuditService
from app.services.evidence_integrity_service import EvidenceIntegrityService
from app.services.evidence_rule_engine import EvidenceRuleEngine
from app.services.notification_service import NotificationService
from app.services.signature_service import SignatureService
from app.services.supplier_confirmation_service import SupplierConfirmationService
from app.services.temporal_analysis_service import TemporalAnalysisService
from app.services.temporal_integrity_service import TemporalIntegrityService


class WorkflowService:
    def __init__(self, session: Session) -> None:
        self._session = session
        self._audit = AuditService(session)
        self._notifications = NotificationService(session)
        self._ack_service = AcknowledgementService(session)
        self._integrity_service = EvidenceIntegrityService(session)
        self._rule_engine = EvidenceRuleEngine(session)
        self._temporal_service = TemporalIntegrityService(session)
        self._temporal_analysis = TemporalAnalysisService()
        self._ai_risk = AIRiskService(session)
        self._supplier_confirmation = SupplierConfirmationService(session)

    def submit(
        self,
        *,
        entry_id: UUID,
        actor_user_id: UUID,
        signature_payload: WorkflowSignatureIn | None = None,
    ) -> MaterialEntry:
        with self._session.begin():
            actor = self._get_user(actor_user_id)
            entry = self._get_entry(entry_id, actor_organization_id=actor.organization_id)
            if entry.status == MaterialStatus.LOCKED:
                raise ValueError("Locked entries are immutable")
            if entry.status != MaterialStatus.DRAFT:
                raise ValueError("Only DRAFT entries can be submitted")
            if actor.role != UserRole.CREATOR or entry.created_by_id != actor.id:
                raise ValueError("Only the creator can submit this entry")

            signature, algorithm = self._validate_action_signature(
                actor=actor,
                entry=entry,
                action="SUBMIT",
                signature_payload=signature_payload,
            )

            previous_state = self._snapshot(entry)
            entry.status = MaterialStatus.SUBMITTED
            entry.submitted_at = datetime.now(timezone.utc)
            entry.signature = signature
            entry.signature_algorithm = algorithm

            self._notifications.create_notifications_for_submission(
                entry_id=entry.id,
                actor_user_id=actor.id,
            )
            self._supplier_confirmation.ensure_pending_for_submission(entry=entry, actor=actor)

            self._audit.log(
                performed_by_id=actor.id,
                entity_type="MaterialEntry",
                entity_id=entry.id,
                action="SUBMIT_ENTRY",
                previous_state=previous_state,
                new_state=self._snapshot(entry),
            )
            return entry

    def verify(
        self,
        *,
        entry_id: UUID,
        actor_user_id: UUID,
        signature_payload: WorkflowSignatureIn | None = None,
    ) -> MaterialEntry:
        with self._session.begin():
            actor = self._get_user(actor_user_id)
            entry = self._get_entry(entry_id, actor_organization_id=actor.organization_id)
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

            complete, missing = self._rule_engine.validate_for_verification(entry=entry)
            if not complete:
                missing_str = ", ".join(missing)
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Verification blocked: missing required evidence types: {missing_str}",
                )

            self._integrity_service.refresh_duplicate_flags()

            if not self._ack_service.required_acknowledgements_completed(entry=entry):
                raise ValueError("Required evidence acknowledgements are incomplete")

            if not self._notifications.notifications_ready_for_verification(
                entry_id=entry.id
            ):
                raise ValueError("Entry has unresolved or disputed notifications")
            if not self._supplier_confirmation.verification_allowed(entry_id=entry.id):
                raise ValueError("Verification blocked: supplier disputed this entry")
            if entry.audit_required and actor.role not in {UserRole.ADMIN, UserRole.AUDITOR}:
                raise ValueError("Audited entries can only be reviewed by ADMIN or AUDITOR")
            if actor.role not in {UserRole.VERIFIER, UserRole.ADMIN, UserRole.AUDITOR}:
                raise ValueError("Only verifier can verify")
            if entry.created_by_id == actor.id:
                raise ValueError("Creator cannot verify their own entry")

            signature, algorithm = self._validate_action_signature(
                actor=actor,
                entry=entry,
                action="VERIFY",
                signature_payload=signature_payload,
            )

            previous_state = self._snapshot(entry)
            entry.status = MaterialStatus.VERIFIED
            entry.verified_by_id = actor.id
            entry.verified_at = datetime.now(timezone.utc)
            temporal_integrity = self._temporal_service.evaluate_entry(entry=entry)
            temporal_speed_flag = self._temporal_analysis.detect_temporal_anomaly(entry=entry)
            entry.temporal_anomaly = temporal_integrity or temporal_speed_flag
            entry.signature = signature
            entry.signature_algorithm = algorithm
            ai_risk = self._ai_risk.calculate_risk(entry=entry)
            entry.ai_risk_score = ai_risk.combined_score
            entry.ai_risk_level = ai_risk.risk_level
            entry.ai_anomaly_reason = "; ".join(ai_risk.explanation[:3])
            if entry.ai_risk_level == "HIGH":
                entry.audit_required = True
                entry.status = MaterialStatus.UNDER_REVIEW

            self._audit.log(
                performed_by_id=actor.id,
                entity_type="MaterialEntry",
                entity_id=entry.id,
                action="VERIFY_ENTRY",
                previous_state=previous_state,
                new_state=self._snapshot(entry),
            )
            return entry

    def approve(
        self,
        *,
        entry_id: UUID,
        actor_user_id: UUID,
        signature_payload: WorkflowSignatureIn | None = None,
    ) -> MaterialEntry:
        with self._session.begin():
            actor = self._get_user(actor_user_id)
            entry = self._get_entry(entry_id, actor_organization_id=actor.organization_id)
            if entry.status == MaterialStatus.LOCKED:
                raise ValueError("Locked entries are immutable")
            if entry.status != MaterialStatus.VERIFIED:
                raise ValueError("Only VERIFIED entries can be approved")
            if actor.role not in {UserRole.APPROVER, UserRole.ADMIN, UserRole.AUDITOR}:
                raise ValueError("Only approver can approve")
            if entry.verified_by_id == actor.id:
                raise ValueError("Approver cannot be the verifier")

            signature, algorithm = self._validate_action_signature(
                actor=actor,
                entry=entry,
                action="APPROVE",
                signature_payload=signature_payload,
            )

            previous_state = self._snapshot(entry)
            entry.status = MaterialStatus.APPROVED
            entry.approved_by_id = actor.id
            entry.signature = signature
            entry.signature_algorithm = algorithm

            self._audit.log(
                performed_by_id=actor.id,
                entity_type="MaterialEntry",
                entity_id=entry.id,
                action="APPROVE_ENTRY",
                previous_state=previous_state,
                new_state=self._snapshot(entry),
            )
            return entry

    def lock(
        self,
        *,
        entry_id: UUID,
        actor_user_id: UUID,
        signature_payload: WorkflowSignatureIn | None = None,
    ) -> MaterialEntry:
        with self._session.begin():
            actor = self._get_user(actor_user_id)
            entry = self._get_entry(entry_id, actor_organization_id=actor.organization_id)
            if entry.status != MaterialStatus.APPROVED:
                raise ValueError("Only APPROVED entries can be locked")
            if actor.role != UserRole.ADMIN:
                raise ValueError("Only admin can lock")

            signature, algorithm = self._validate_action_signature(
                actor=actor,
                entry=entry,
                action="LOCK",
                signature_payload=signature_payload,
            )

            previous_state = self._snapshot(entry)
            entry.status = MaterialStatus.LOCKED
            entry.locked_at = datetime.now(timezone.utc)
            entry.signature = signature
            entry.signature_algorithm = algorithm

            self._audit.log(
                performed_by_id=actor.id,
                entity_type="MaterialEntry",
                entity_id=entry.id,
                action="LOCK_ENTRY",
                previous_state=previous_state,
                new_state=self._snapshot(entry),
            )
            return entry

    def _get_entry(self, entry_id: UUID, *, actor_organization_id: UUID) -> MaterialEntry:
        stmt = (
            select(MaterialEntry)
            .where(
                MaterialEntry.id == entry_id,
                MaterialEntry.project.has(organization_id=actor_organization_id),
            )
            .with_for_update()
        )
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
            "supplier_name": entry.supplier_name,
            "supplier_email": entry.supplier_email,
            "factor_version_snapshot": entry.factor_version_snapshot,
            "factor_value_snapshot": float(entry.factor_value_snapshot),
            "factor_unit_snapshot": entry.factor_unit_snapshot,
            "factor_source_snapshot": entry.factor_source_snapshot,
            "calculated_emission": float(entry.calculated_emission),
            "created_by_id": self._serialize(entry.created_by_id),
            "verified_by_id": self._serialize(entry.verified_by_id),
            "approved_by_id": self._serialize(entry.approved_by_id),
            "submitted_at": self._serialize(entry.submitted_at),
            "verified_at": self._serialize(entry.verified_at),
            "locked_at": self._serialize(entry.locked_at),
            "audit_required": entry.audit_required,
            "temporal_anomaly": entry.temporal_anomaly,
            "bim_discrepancy_score": self._serialize(entry.bim_discrepancy_score),
            "bim_validation_status": entry.bim_validation_status,
            "ai_risk_score": self._serialize(entry.ai_risk_score),
            "ai_risk_level": entry.ai_risk_level,
            "ai_anomaly_reason": entry.ai_anomaly_reason,
            "signature": entry.signature,
            "signature_algorithm": entry.signature_algorithm,
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

    def _validate_action_signature(
        self,
        *,
        actor: User,
        entry: MaterialEntry,
        action: str,
        signature_payload: WorkflowSignatureIn | None,
    ) -> tuple[str | None, str | None]:
        user_key = self._session.execute(
            select(UserKey).where(UserKey.user_id == actor.id)
        ).scalar_one_or_none()

        if user_key is None:
            if signature_payload is not None:
                raise ValueError("No public key registered for this user")
            return None, None

        if signature_payload is None:
            raise ValueError("Digital signature is required for this workflow action")

        payload = SignatureService.build_payload(
            entry_id=entry.id,
            action=action,
            timestamp=signature_payload.timestamp,
        )
        is_valid = SignatureService.verify_signature(
            payload=payload,
            signature=signature_payload.signature,
            public_key=user_key.public_key,
            algorithm=signature_payload.signature_algorithm,
        )
        if not is_valid:
            raise ValueError("Invalid digital signature")

        return signature_payload.signature, signature_payload.signature_algorithm


def _sha256_file(path: Path) -> str:
    hasher = hashlib.sha256()
    with path.open("rb") as handle:
        while True:
            chunk = handle.read(1024 * 1024)
            if not chunk:
                break
            hasher.update(chunk)
    return hasher.hexdigest()

