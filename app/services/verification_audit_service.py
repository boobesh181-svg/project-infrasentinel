from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog


class VerificationAuditService:
    def __init__(self, session: Session) -> None:
        self._session = session

    def log(
        self,
        *,
        organization_id: UUID,
        entity_type: str,
        entity_id: UUID,
        action: str,
        user_id: UUID,
        before_state: dict[str, Any],
        after_state: dict[str, Any],
    ) -> AuditLog:
        payload_before = {"organization_id": str(organization_id), **before_state}
        payload_after = {"organization_id": str(organization_id), **after_state}
        record = AuditLog(
            entity_type=entity_type,
            entity_id=entity_id,
            action=action,
            performed_by_id=user_id,
            previous_state=payload_before,
            new_state=payload_after,
            timestamp=datetime.now(timezone.utc),
        )
        self._session.add(record)
        return record
