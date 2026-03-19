from datetime import datetime, timedelta, timezone
import os
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.material_entry import MaterialEntry
from app.models.notification import Notification, ResponseType
from app.models.project import Project
from app.models.user import User, UserRole
from app.services.audit_service import AuditService


class NotificationService:
    def __init__(self, session: Session) -> None:
        self._session = session
        self._audit = AuditService(session)

    def create_notification(
        self,
        *,
        entity_type: str,
        entity_id: UUID,
        notified_user_id: UUID,
        response_deadline: datetime,
    ) -> Notification:
        notification = Notification(
            entity_type=entity_type,
            entity_id=entity_id,
            notified_user_id=notified_user_id,
            response_deadline=response_deadline,
        )
        self._session.add(notification)
        self._session.flush()
        return notification

    def set_response_type(
        self, *, notification_id: UUID, response_type: ResponseType
    ) -> Notification:
        with self._session.begin():
            notification = self._session.get(Notification, notification_id)
            if notification is None:
                raise ValueError("Notification not found")
            notification.response_type = response_type
            notification.responded_at = datetime.now(timezone.utc)
            return notification

    def has_blocking_for_entity(self, *, entity_type: str, entity_id: UUID) -> bool:
        now = datetime.now(timezone.utc)
        stmt = select(Notification.id).where(
            Notification.entity_type == entity_type,
            Notification.entity_id == entity_id,
            (
                (Notification.response_type == ResponseType.DISPUTED)
                | (
                    (Notification.response_type == ResponseType.NONE)
                    & (Notification.response_deadline > now)
                )
            ),
        )
        return self._session.execute(stmt).first() is not None

    def create_notifications_for_submission(
        self,
        *,
        entry_id: UUID,
        actor_user_id: UUID,
    ) -> list[Notification]:
        entry = self._get_entry(entry_id)
        project = self._get_project(entry.project_id)
        owner_id = project.created_by_id
        verifier = self._get_project_verifier(project.organization_id)
        supplier = self._get_supplier_user(entry.supplier_email, project.organization_id)

        notified_at = datetime.now(timezone.utc)
        deadline_hours = self._notification_deadline_hours()
        response_deadline = notified_at + timedelta(hours=deadline_hours)

        recipients = {owner_id, verifier.id}
        if supplier is not None:
            recipients.add(supplier.id)
        notifications: list[Notification] = []
        for user_id in recipients:
            notification = self.create_notification(
                entity_type="material_entry",
                entity_id=entry.id,
                notified_user_id=user_id,
                response_deadline=response_deadline,
            )
            notifications.append(notification)
            self._audit.log(
                performed_by_id=actor_user_id,
                entity_type="Notification",
                entity_id=notification.id,
                action="NOTIFICATION_CREATE",
                previous_state={},
                new_state=self._snapshot(notification),
            )
        return notifications

    def _get_supplier_user(self, supplier_email: str | None, organization_id: UUID) -> User | None:
        if not supplier_email:
            return None

        stmt = (
            select(User)
            .where(
                User.organization_id == organization_id,
                User.email == supplier_email,
                User.role == UserRole.SUPPLIER,
                User.is_active.is_(True),
            )
            .limit(1)
        )
        return self._session.execute(stmt).scalar_one_or_none()

    def resolve_notification(
        self,
        *,
        notification_id: UUID,
        response_type: ResponseType,
        actor_user_id: UUID,
    ) -> Notification:
        with self._session.begin():
            notification = self._session.get(Notification, notification_id)
            if notification is None:
                raise ValueError("Notification not found")

            previous_state = self._snapshot(notification)
            notification.response_type = response_type
            notification.responded_at = datetime.now(timezone.utc)

            self._audit.log(
                performed_by_id=actor_user_id,
                entity_type="Notification",
                entity_id=notification.id,
                action="NOTIFICATION_RESPOND",
                previous_state=previous_state,
                new_state=self._snapshot(notification),
            )
            return notification

    def notifications_ready_for_verification(self, *, entry_id: UUID) -> bool:
        now = datetime.now(timezone.utc)
        stmt = select(Notification).where(
            Notification.entity_type == "material_entry",
            Notification.entity_id == entry_id,
        )
        notifications = list(self._session.execute(stmt).scalars().all())
        if not notifications:
            return True

        for notification in notifications:
            if notification.response_type == ResponseType.DISPUTED:
                return False
            if (
                notification.response_type == ResponseType.NONE
                and notification.response_deadline > now
            ):
                return False
        return True

    def _get_entry(self, entry_id: UUID) -> MaterialEntry:
        entry = self._session.get(MaterialEntry, entry_id)
        if entry is None:
            raise ValueError("MaterialEntry not found")
        return entry

    def _get_project(self, project_id: UUID) -> Project:
        project = self._session.get(Project, project_id)
        if project is None:
            raise ValueError("Project not found")
        return project

    def _get_project_verifier(self, organization_id: UUID) -> User:
        stmt = (
            select(User)
            .where(
                User.organization_id == organization_id,
                User.role == UserRole.VERIFIER,
                User.is_active.is_(True),
            )
            .order_by(User.created_at.asc())
            .limit(1)
        )
        verifier = self._session.execute(stmt).scalar_one_or_none()
        if verifier is None:
            raise ValueError("No active verifier found for organization")
        return verifier

    def _notification_deadline_hours(self) -> int:
        raw_value = os.getenv("NOTIFICATION_RESPONSE_HOURS", "48")
        try:
            hours = int(raw_value)
        except ValueError as exc:
            raise ValueError("NOTIFICATION_RESPONSE_HOURS must be an integer") from exc
        if hours <= 0:
            raise ValueError("NOTIFICATION_RESPONSE_HOURS must be positive")
        return hours

    def _snapshot(self, notification: Notification) -> dict[str, object]:
        response_type = (
            notification.response_type.value
            if notification.response_type is not None
            else ResponseType.NONE.value
        )
        return {
            "id": self._serialize(notification.id),
            "entity_type": notification.entity_type,
            "entity_id": self._serialize(notification.entity_id),
            "notified_user_id": self._serialize(notification.notified_user_id),
            "notified_at": self._serialize(notification.notified_at),
            "response_deadline": self._serialize(notification.response_deadline),
            "response_type": response_type,
            "responded_at": self._serialize(notification.responded_at),
        }

    def _serialize(self, value: object) -> object:
        if isinstance(value, datetime):
            return value.isoformat()
        if isinstance(value, UUID):
            return str(value)
        return value
