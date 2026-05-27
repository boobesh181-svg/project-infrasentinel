from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from uuid import UUID, uuid4

from sqlalchemy import DateTime, Enum as SqlEnum, Float, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import JSONB, UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class WeighbridgeStatus(str, Enum):
    GROSS_CAPTURED = "GROSS_CAPTURED"
    TARE_CAPTURED = "TARE_CAPTURED"
    VERIFIED = "VERIFIED"
    MISMATCH = "MISMATCH"


class WeighbridgeEvent(Base):
    __tablename__ = "weighbridge_events"
    __table_args__ = (
        Index("ix_weighbridge_events_org_id", "organization_id"),
        Index("ix_weighbridge_events_delivery_id", "delivery_event_id"),
        Index("ix_weighbridge_events_invoice_id", "invoice_id"),
        Index("ix_weighbridge_events_status", "status"),
    )

    id: Mapped[UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    organization_id: Mapped[UUID] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="RESTRICT"),
        nullable=False,
    )
    delivery_event_id: Mapped[UUID] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("delivery_events.id", ondelete="CASCADE"),
        nullable=False,
    )
    invoice_id: Mapped[UUID | None] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("supplier_invoices.id", ondelete="SET NULL"),
        nullable=True,
    )

    gross_weight: Mapped[float] = mapped_column(Float, nullable=False)
    tare_weight: Mapped[float | None] = mapped_column(Float, nullable=True)
    net_weight: Mapped[float | None] = mapped_column(Float, nullable=True)
    unit: Mapped[str] = mapped_column(String(32), nullable=False, default="kg")

    gross_captured_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    tare_captured_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    expected_quantity: Mapped[float | None] = mapped_column(Float, nullable=True)
    mismatch_percent: Mapped[float | None] = mapped_column(Float, nullable=True)
    mismatch_threshold: Mapped[float] = mapped_column(Float, nullable=False, default=0.05)
    anomaly_flags: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)

    status: Mapped[WeighbridgeStatus] = mapped_column(
        SqlEnum(WeighbridgeStatus, name="weighbridge_status_enum"),
        nullable=False,
        default=WeighbridgeStatus.GROSS_CAPTURED,
    )

    created_by: Mapped[UUID] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    delivery_event = relationship("DeliveryEvent")
    invoice = relationship("SupplierInvoice")
