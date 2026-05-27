from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import DateTime, Float, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class InvoiceDeliveryLink(Base):
    __tablename__ = "invoice_delivery_links"
    __table_args__ = (
        Index("ix_invoice_delivery_links_invoice_id", "invoice_id"),
        Index("ix_invoice_delivery_links_delivery_event_id", "delivery_event_id"),
    )

    id: Mapped[UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    invoice_id: Mapped[UUID] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("supplier_invoices.id", ondelete="CASCADE"),
        nullable=False,
    )
    delivery_event_id: Mapped[UUID] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("delivery_events.id", ondelete="CASCADE"),
        nullable=False,
    )
    match_confidence: Mapped[float] = mapped_column(Float, nullable=True)
    match_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    matched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    invoice = relationship("SupplierInvoice", back_populates="delivery_links")
    delivery_event = relationship("DeliveryEvent", back_populates="invoice_links")
