from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, Index, String, event
from sqlalchemy.dialects.postgresql import JSONB, UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"
    __table_args__ = (Index("ix_audit_logs_performed_by_id", "performed_by_id"),)

    id: Mapped[UUID] = mapped_column(
        PgUUID(as_uuid=True), primary_key=True, default=uuid4
    )
    entity_type: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_id: Mapped[UUID] = mapped_column(PgUUID(as_uuid=True), nullable=False)
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    previous_state: Mapped[dict] = mapped_column(JSONB, nullable=False)
    new_state: Mapped[dict] = mapped_column(JSONB, nullable=False)
    performed_by_id: Mapped[UUID] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    performed_by = relationship("User", back_populates="audit_logs")


@event.listens_for(AuditLog, "before_update")
def prevent_audit_log_update(*_) -> None:
    raise ValueError("AuditLog is append-only")


@event.listens_for(AuditLog, "before_delete")
def prevent_audit_log_delete(*_) -> None:
    raise ValueError("AuditLog is append-only")
