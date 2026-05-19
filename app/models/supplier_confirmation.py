from datetime import datetime, timezone
from enum import Enum
from uuid import UUID, uuid4

from sqlalchemy import DateTime, Enum as SqlEnum, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class SupplierConfirmationStatus(str, Enum):
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    DISPUTED = "DISPUTED"


class SupplierConfirmation(Base):
    __tablename__ = "supplier_confirmations"
    __table_args__ = (
        Index("ix_supplier_confirmations_entry_id", "entry_id"),
    )

    id: Mapped[UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    entry_id: Mapped[UUID] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("material_entries.id", ondelete="CASCADE"),
        nullable=False,
    )
    supplier_name: Mapped[str] = mapped_column(String(255), nullable=False)
    supplier_email: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[SupplierConfirmationStatus] = mapped_column(
        SqlEnum(SupplierConfirmationStatus, name="supplier_confirmation_status_enum"),
        nullable=False,
        default=SupplierConfirmationStatus.PENDING,
    )
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
