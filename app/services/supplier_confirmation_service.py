from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.material_entry import MaterialEntry
from app.models.notification import Notification, ResponseType
from app.models.project import Project
from app.models.supplier_confirmation import SupplierConfirmation, SupplierConfirmationStatus
from app.models.user import User, UserRole
from app.services.audit_service import AuditService
from app.services.notification_service import NotificationService


class SupplierConfirmationService:
    def __init__(self, session: Session) -> None:
        self._session = session
        self._audit = AuditService(session)
        self._notifications = NotificationService(session)

    def ensure_pending_for_submission(self, *, entry: MaterialEntry, actor: User) -> SupplierConfirmation | None:
        if not entry.supplier_name or not entry.supplier_email:
            return None

        existing = self._latest_for_entry(entry_id=entry.id)
        if existing is not None and existing.status == SupplierConfirmationStatus.PENDING:
            return existing

        confirmation = SupplierConfirmation(
            entry_id=entry.id,
            supplier_name=entry.supplier_name,
            supplier_email=entry.supplier_email,
            status=SupplierConfirmationStatus.PENDING,
            confirmed_at=None,
        )
        self._session.add(confirmation)
        self._session.flush()

        supplier_user = self._find_supplier_user(entry=entry)
        if supplier_user is not None:
            self._notifications.create_notification(
                entity_type="supplier_confirmation",
                entity_id=entry.id,
                notified_user_id=supplier_user.id,
                response_deadline=datetime.now(timezone.utc) + timedelta(hours=48),
            )

        self._audit.log(
            performed_by_id=actor.id,
            entity_type="SupplierConfirmation",
            entity_id=confirmation.id,
            action="SUPPLIER_CONFIRMATION_REQUESTED",
            previous_state={},
            new_state=self._snapshot(confirmation),
        )
        return confirmation

    def update_confirmation(
        self,
        *,
        entry_id: UUID,
        actor: User,
        status_value: SupplierConfirmationStatus,
    ) -> SupplierConfirmation:
        entry = self._session.get(MaterialEntry, entry_id)
        if entry is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Material entry not found")

        project = self._session.get(Project, entry.project_id)
        if project is None or project.organization_id != actor.organization_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

        if actor.role != UserRole.SUPPLIER:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only suppliers can confirm")

        confirmation = self._latest_for_entry(entry_id=entry_id)
        if confirmation is None:
            if not entry.supplier_name or not entry.supplier_email:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Entry has no supplier")
            confirmation = SupplierConfirmation(
                entry_id=entry.id,
                supplier_name=entry.supplier_name,
                supplier_email=entry.supplier_email,
                status=SupplierConfirmationStatus.PENDING,
            )
            self._session.add(confirmation)
            self._session.flush()

        previous_state = self._snapshot(confirmation)
        confirmation.status = status_value
        confirmation.confirmed_at = datetime.now(timezone.utc)

        notification_type = ResponseType.ACKNOWLEDGED if status_value == SupplierConfirmationStatus.CONFIRMED else ResponseType.DISPUTED
        self._mark_supplier_notifications(
            entry_id=entry.id,
            response_type=notification_type,
            actor_user_id=actor.id,
        )

        self._audit.log(
            performed_by_id=actor.id,
            entity_type="SupplierConfirmation",
            entity_id=confirmation.id,
            action="SUPPLIER_CONFIRMATION_UPDATED",
            previous_state=previous_state,
            new_state=self._snapshot(confirmation),
        )
        return confirmation

    def latest_status_for_entry(self, *, entry_id: UUID) -> SupplierConfirmationStatus | None:
        latest = self._latest_for_entry(entry_id=entry_id)
        return latest.status if latest else None

    def verification_allowed(self, *, entry_id: UUID) -> bool:
        latest = self._latest_for_entry(entry_id=entry_id)
        if latest is None:
            return True
        return latest.status != SupplierConfirmationStatus.DISPUTED

    def _latest_for_entry(self, *, entry_id: UUID) -> SupplierConfirmation | None:
        stmt = (
            select(SupplierConfirmation)
            .where(SupplierConfirmation.entry_id == entry_id)
            .order_by(SupplierConfirmation.created_at.desc())
            .limit(1)
        )
        return self._session.execute(stmt).scalar_one_or_none()

    def _find_supplier_user(self, *, entry: MaterialEntry) -> User | None:
        if not entry.supplier_email:
            return None
        stmt = (
            select(User)
            .where(
                User.organization_id == entry.project.organization_id,
                User.email == entry.supplier_email,
                User.role == UserRole.SUPPLIER,
                User.is_active.is_(True),
            )
            .limit(1)
        )
        return self._session.execute(stmt).scalar_one_or_none()

    def _mark_supplier_notifications(
        self,
        *,
        entry_id: UUID,
        response_type: ResponseType,
        actor_user_id: UUID,
    ) -> None:
        notifications = self._session.execute(
            select(Notification).where(
                Notification.entity_id == entry_id,
                Notification.notified_user_id == actor_user_id,
                Notification.entity_type.in_(["material_entry", "supplier_confirmation"]),
            )
        ).scalars().all()
        for notification in notifications:
            notification.response_type = response_type
            notification.responded_at = datetime.now(timezone.utc)

    def _snapshot(self, confirmation: SupplierConfirmation) -> dict[str, object]:
        return {
            "id": str(confirmation.id),
            "entry_id": str(confirmation.entry_id),
            "supplier_name": confirmation.supplier_name,
            "supplier_email": confirmation.supplier_email,
            "status": confirmation.status.value,
            "confirmed_at": confirmation.confirmed_at.isoformat() if confirmation.confirmed_at else None,
            "created_at": confirmation.created_at.isoformat() if confirmation.created_at else None,
        }
