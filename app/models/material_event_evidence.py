from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class MaterialEventEvidence(Base):
    __tablename__ = "material_event_evidence"
    __table_args__ = (
        Index("ix_material_event_evidence_organization_id", "organization_id"),
        Index("ix_material_event_evidence_material_event_id", "material_event_id"),
    )

    id: Mapped[UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    organization_id: Mapped[UUID] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="RESTRICT"),
        nullable=False,
    )
    material_event_id: Mapped[UUID] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("material_events.id", ondelete="RESTRICT"),
        nullable=False,
    )
    file_url: Mapped[str] = mapped_column(String(500), nullable=False)
    file_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    file_type: Mapped[str] = mapped_column(String(100), nullable=False)
    evidence_type: Mapped[str] = mapped_column(String(50), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    created_by: Mapped[UUID] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="ACTIVE")
