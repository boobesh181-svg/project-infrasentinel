from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog


class AuditService:
    def __init__(self, session: Session) -> None:
        self._session = session

    def log(
        self,
        *,
        performed_by_id: UUID,
        entity_type: str,
        entity_id: UUID,
        action: str,
        previous_state: dict[str, Any],
        new_state: dict[str, Any],
    ) -> AuditLog:
        audit = AuditLog(
            performed_by_id=performed_by_id,
            entity_type=entity_type,
            entity_id=entity_id,
            action=action,
            previous_state=previous_state,
            new_state=new_state,
        )
        self._session.add(audit)
        return audit

    def list_by_entity(self, *, entity_type: str, entity_id: UUID) -> list[AuditLog]:
        stmt = (
            select(AuditLog)
            .where(
                AuditLog.entity_type == entity_type,
                AuditLog.entity_id == entity_id,
            )
            .order_by(AuditLog.timestamp.asc())
        )
        return list(self._session.execute(stmt).scalars().all())
