from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from uuid import UUID, uuid4

from sqlalchemy import BigInteger, DateTime, Enum as SqlEnum, ForeignKey, Index, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class InvoiceStatus(str, Enum):
    EXTRACTED = "EXTRACTED"
    NEEDS_REVIEW = "NEEDS_REVIEW"
    CONFIRMED = "CONFIRMED"
    FAILED = "FAILED"


class SupplierInvoice(Base):
    __tablename__ = "supplier_invoices"
    __table_args__ = (
        Index("ix_supplier_invoices_org_id", "organization_id"),
        Index("ix_supplier_invoices_supplier_name", "supplier_name"),
        Index("ix_supplier_invoices_invoice_number", "invoice_number"),
        Index("ix_supplier_invoices_vehicle_number", "vehicle_number"),
        Index("ix_supplier_invoices_invoice_timestamp", "invoice_timestamp"),
    )

    id: Mapped[UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    organization_id: Mapped[UUID] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="RESTRICT"),
        nullable=False,
    )
    uploaded_by: Mapped[UUID] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    supplier_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    invoice_number: Mapped[str | None] = mapped_column(String(128), nullable=True)
    material_type: Mapped[str | None] = mapped_column(String(255), nullable=True)
    expected_quantity: Mapped[float | None] = mapped_column(Numeric(14, 6), nullable=True)
    vehicle_number: Mapped[str | None] = mapped_column(String(64), nullable=True)
    invoice_timestamp: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    raw_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    extraction_confidence: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    extraction_status: Mapped[InvoiceStatus] = mapped_column(
        SqlEnum(InvoiceStatus, name="invoice_status_enum"),
        nullable=False,
        default=InvoiceStatus.EXTRACTED,
    )
    extraction_errors: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)

    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_type: Mapped[str] = mapped_column(String(128), nullable=False)
    content_type: Mapped[str] = mapped_column(String(128), nullable=False)
    file_size: Mapped[int] = mapped_column(BigInteger, nullable=False)
    file_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    storage_path: Mapped[str] = mapped_column(String(500), nullable=False)

    correction_notes: Mapped[str | None] = mapped_column(String(500), nullable=True)
    corrected_by: Mapped[UUID | None] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=True,
    )
    corrected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    delivery_links = relationship(
        "InvoiceDeliveryLink",
        back_populates="invoice",
        passive_deletes=True,
        cascade="all, delete-orphan",
    )
