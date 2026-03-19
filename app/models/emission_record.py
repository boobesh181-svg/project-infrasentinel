from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, Index, Numeric, String
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class EmissionRecord(Base):
    __tablename__ = "emission_records"
    __table_args__ = (
        Index("ix_emission_records_organization_id", "organization_id"),
        Index("ix_emission_records_material_event_id", "material_event_id"),
        Index("ix_emission_records_status", "status"),
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
    factor_value_snapshot: Mapped[float] = mapped_column(Numeric(14, 6), nullable=False)
    factor_source_snapshot: Mapped[str] = mapped_column(String(255), nullable=False)
    factor_reference_snapshot: Mapped[str] = mapped_column(String(500), nullable=False)
    calculation_method: Mapped[str] = mapped_column(String(255), nullable=False)
    emission_value: Mapped[float] = mapped_column(Numeric(14, 6), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    created_by: Mapped[UUID] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="DRAFT")
