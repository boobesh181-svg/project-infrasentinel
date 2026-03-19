from datetime import date, datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import Date, DateTime, Enum as SqlEnum, ForeignKey, Index, Numeric, String
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.material_entry import MaterialStatus


class MaterialEvent(Base):
    __tablename__ = "material_events"
    __table_args__ = (
        Index("ix_material_events_organization_id", "organization_id"),
        Index("ix_material_events_project_id", "project_id"),
        Index("ix_material_events_status", "status"),
    )

    id: Mapped[UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    organization_id: Mapped[UUID] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="RESTRICT"),
        nullable=False,
    )
    project_id: Mapped[UUID] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="RESTRICT"),
        nullable=False,
    )
    supplier_id: Mapped[UUID] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("suppliers.id", ondelete="RESTRICT"),
        nullable=False,
    )
    material_type: Mapped[str] = mapped_column(String(255), nullable=False)
    quantity: Mapped[float] = mapped_column(Numeric(14, 6), nullable=False)
    unit: Mapped[str] = mapped_column(String(64), nullable=False)
    delivery_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[MaterialStatus] = mapped_column(
        SqlEnum(MaterialStatus, name="material_status_enum"),
        default=MaterialStatus.DRAFT,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    created_by: Mapped[UUID] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    parent_event_id: Mapped[UUID | None] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("material_events.id", ondelete="RESTRICT"),
        nullable=True,
    )
