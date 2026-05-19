from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog
from app.services.signature_service import AuditChainHasher


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
        timestamp = datetime.now(timezone.utc)
        latest = self._session.execute(
            select(AuditLog).order_by(AuditLog.timestamp.desc(), AuditLog.id.desc()).limit(1)
        ).scalar_one_or_none()
        previous_hash = latest.current_hash if latest is not None else AuditChainHasher.GENESIS_HASH
        serialized = AuditChainHasher.serialize_event(
            entity_type=entity_type,
            entity_id=entity_id,
            action=action,
            performed_by=performed_by_id,
            timestamp=timestamp,
        )
        current_hash = AuditChainHasher.compute_hash(
            previous_hash=previous_hash,
            serialized_event=serialized,
        )

        audit = AuditLog(
            performed_by_id=performed_by_id,
            entity_type=entity_type,
            entity_id=entity_id,
            action=action,
            previous_state=previous_state,
            new_state=new_state,
            timestamp=timestamp,
            previous_hash=previous_hash,
            current_hash=current_hash,
        )
        self._session.add(audit)
        return audit

    def latest_hash(self) -> str | None:
        latest = self._session.execute(
            select(AuditLog.current_hash).order_by(AuditLog.timestamp.desc(), AuditLog.id.desc()).limit(1)
        ).scalar_one_or_none()
        return latest

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
