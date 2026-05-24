from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, Index, String, Float
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class VerificationResult(Base):
    __tablename__ = "verification_results"
    __table_args__ = (Index("ix_verification_delivery_id", "delivery_event_id"),)

    id: Mapped[UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    delivery_event_id: Mapped[UUID] = mapped_column(PgUUID(as_uuid=True), ForeignKey("delivery_events.id", ondelete="CASCADE"), nullable=False)
    analyzer: Mapped[str] = mapped_column(String(128), nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=True)
    reasoning: Mapped[str] = mapped_column(String(2000), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    delivery_event = relationship("DeliveryEvent", back_populates="verification_results")
