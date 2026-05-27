from __future__ import annotations

from datetime import datetime, timezone
from typing import List
from uuid import UUID, uuid4

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class DeliveryEvent(Base):
    __tablename__ = "delivery_events"
    __table_args__ = (
        Index("ix_delivery_events_site_id", "site_id"),
        Index("ix_delivery_events_vehicle_plate", "vehicle_plate"),
    )

    id: Mapped[UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    site_id: Mapped[UUID] = mapped_column(PgUUID(as_uuid=True), nullable=False)
    camera_id: Mapped[str] = mapped_column(String(128), nullable=True)
    vehicle_plate: Mapped[str] = mapped_column(String(64), nullable=True)
    supplier: Mapped[str] = mapped_column(String(255), nullable=True)
    expected_quantity: Mapped[float] = mapped_column(Float, nullable=True)
    detected_quantity: Mapped[float] = mapped_column(Float, nullable=True)
    detected_plate: Mapped[str | None] = mapped_column(String(64), nullable=True)
    detected_material_type: Mapped[str | None] = mapped_column(String(255), nullable=True)
    detection_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    anpr_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    duplicate_vehicle: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    suspicious_flags: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    detected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    gps_lat: Mapped[float] = mapped_column(Float, nullable=True)
    gps_lng: Mapped[float] = mapped_column(Float, nullable=True)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    state: Mapped[str] = mapped_column(String(32), nullable=False, default="INGESTED")
    confidence: Mapped[float] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    evidence: Mapped[List["EvidenceAsset"]] = relationship(back_populates="delivery_event", passive_deletes=True)
    verification_results: Mapped[List["VerificationResult"]] = relationship(back_populates="delivery_event", passive_deletes=True)
    invoice_links: Mapped[List["InvoiceDeliveryLink"]] = relationship(back_populates="delivery_event", passive_deletes=True)
