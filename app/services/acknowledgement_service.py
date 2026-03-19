from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.evidence_acknowledgement import (
    AcknowledgementResponseType,
    AcknowledgementRole,
    EvidenceAcknowledgement,
)
from app.models.material_entry import MaterialEntry
from app.models.project import Project
from app.models.user import User, UserRole
from app.services.audit_service import AuditService


ROLE_MAP: dict[UserRole, AcknowledgementRole] = {
    UserRole.VERIFIER: AcknowledgementRole.VERIFIER,
    UserRole.AUDITOR: AcknowledgementRole.AUDITOR,
    UserRole.SUPPLIER: AcknowledgementRole.SUPPLIER,
}


class AcknowledgementService:
    def __init__(self, session: Session) -> None:
        self._session = session
        self._audit = AuditService(session)

    def acknowledge(
        self,
        *,
        entry_id: UUID,
        actor: User,
        comment: str | None,
    ) -> EvidenceAcknowledgement:
        role = self._map_actor_role(actor)
        entry = self._get_entry(entry_id=entry_id, actor=actor)
        return self._upsert(
            entry=entry,
            actor=actor,
            role=role,
            response_type=AcknowledgementResponseType.ACK,
            comment=comment,
        )

    def dispute(
        self,
        *,
        entry_id: UUID,
        actor: User,
        comment: str | None,
    ) -> EvidenceAcknowledgement:
        role = self._map_actor_role(actor)
        entry = self._get_entry(entry_id=entry_id, actor=actor)
        return self._upsert(
            entry=entry,
            actor=actor,
            role=role,
            response_type=AcknowledgementResponseType.DISPUTE,
            comment=comment,
        )

    def supplier_confirm_delivery(
        self,
        *,
        entry_id: UUID,
        actor: User,
        confirmation_status: str,
        comment: str | None,
    ) -> EvidenceAcknowledgement:
        if actor.role != UserRole.SUPPLIER:
            raise ValueError("Only SUPPLIER role can confirm delivery")

        normalized = confirmation_status.strip().upper()
        if normalized not in {"ACK", "DISPUTE"}:
            raise ValueError("confirmation_status must be ACK or DISPUTE")

        entry = self._get_entry(entry_id=entry_id, actor=actor)
        if entry.supplier_email and actor.email.lower() != entry.supplier_email.lower():
            raise ValueError("Supplier email does not match entry supplier")

        response_type = (
            AcknowledgementResponseType.ACK
            if normalized == "ACK"
            else AcknowledgementResponseType.DISPUTE
        )
        return self._upsert(
            entry=entry,
            actor=actor,
            role=AcknowledgementRole.SUPPLIER,
            response_type=response_type,
            comment=comment,
        )

    def list_for_entry(self, *, entry_id: UUID, actor: User) -> list[EvidenceAcknowledgement]:
        self._get_entry(entry_id=entry_id, actor=actor)
        stmt = (
            select(EvidenceAcknowledgement)
            .where(EvidenceAcknowledgement.material_entry_id == entry_id)
            .order_by(EvidenceAcknowledgement.timestamp.asc())
        )
        return list(self._session.execute(stmt).scalars().all())

    def required_acknowledgements_completed(self, *, entry: MaterialEntry) -> bool:
        required_roles = {AcknowledgementRole.VERIFIER, AcknowledgementRole.AUDITOR}
        if entry.supplier_email:
            required_roles.add(AcknowledgementRole.SUPPLIER)

        stmt = select(EvidenceAcknowledgement).where(
            EvidenceAcknowledgement.material_entry_id == entry.id
        )
        records = list(self._session.execute(stmt).scalars().all())

        latest_by_role: dict[AcknowledgementRole, EvidenceAcknowledgement] = {}
        for record in records:
            previous = latest_by_role.get(record.role)
            if previous is None or record.timestamp > previous.timestamp:
                latest_by_role[record.role] = record

        for role in required_roles:
            current = latest_by_role.get(role)
            if current is None:
                return False
            if current.response_type != AcknowledgementResponseType.ACK:
                return False
        return True

    def _upsert(
        self,
        *,
        entry: MaterialEntry,
        actor: User,
        role: AcknowledgementRole,
        response_type: AcknowledgementResponseType,
        comment: str | None,
    ) -> EvidenceAcknowledgement:
        with self._session.begin_nested():
            stmt = select(EvidenceAcknowledgement).where(
                EvidenceAcknowledgement.material_entry_id == entry.id,
                EvidenceAcknowledgement.user_id == actor.id,
                EvidenceAcknowledgement.role == role,
            )
            existing = self._session.execute(stmt).scalar_one_or_none()

            if existing is None:
                existing = EvidenceAcknowledgement(
                    material_entry_id=entry.id,
                    user_id=actor.id,
                    role=role,
                    response_type=response_type,
                    comment=comment,
                    timestamp=datetime.now(timezone.utc),
                )
                self._session.add(existing)
                action = "ACKNOWLEDGEMENT"
                previous_state: dict[str, object] = {}
            else:
                previous_state = self._snapshot(existing)
                existing.response_type = response_type
                existing.comment = comment
                existing.timestamp = datetime.now(timezone.utc)
                action = "ACKNOWLEDGEMENT"

            self._session.flush()
            self._audit.log(
                performed_by_id=actor.id,
                entity_type="EvidenceAcknowledgement",
                entity_id=existing.id,
                action=action,
                previous_state=previous_state,
                new_state=self._snapshot(existing),
            )
            return existing

    def count_pending_supplier_confirmation(self, *, organization_id: UUID) -> int:
        supplier_ack_count = (
            select(func.count(EvidenceAcknowledgement.id))
            .where(
                EvidenceAcknowledgement.material_entry_id == MaterialEntry.id,
                EvidenceAcknowledgement.role == AcknowledgementRole.SUPPLIER,
                EvidenceAcknowledgement.response_type == AcknowledgementResponseType.ACK,
            )
            .correlate(MaterialEntry)
            .scalar_subquery()
        )
        stmt = (
            select(func.count(MaterialEntry.id))
            .join(Project, Project.id == MaterialEntry.project_id)
            .where(
                Project.organization_id == organization_id,
                MaterialEntry.status == "SUBMITTED",
                MaterialEntry.supplier_email.is_not(None),
                supplier_ack_count == 0,
            )
        )
        return int(self._session.execute(stmt).scalar_one())

    def _map_actor_role(self, actor: User) -> AcknowledgementRole:
        role = ROLE_MAP.get(actor.role)
        if role is None:
            raise ValueError("User role cannot acknowledge evidence")
        return role

    def _get_entry(self, *, entry_id: UUID, actor: User) -> MaterialEntry:
        stmt = (
            select(MaterialEntry)
            .join(Project, Project.id == MaterialEntry.project_id)
            .where(MaterialEntry.id == entry_id, Project.organization_id == actor.organization_id)
        )
        entry = self._session.execute(stmt).scalar_one_or_none()
        if entry is None:
            raise ValueError("Material entry not found")
        return entry

    def _snapshot(self, record: EvidenceAcknowledgement) -> dict[str, object]:
        return {
            "id": str(record.id),
            "material_entry_id": str(record.material_entry_id),
            "user_id": str(record.user_id),
            "role": record.role.value,
            "response_type": record.response_type.value,
            "comment": record.comment,
            "timestamp": record.timestamp.isoformat(),
        }
