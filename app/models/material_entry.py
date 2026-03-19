from datetime import datetime, timezone
from enum import Enum
from uuid import UUID, uuid4

from sqlalchemy import Boolean, DateTime, Enum as SqlEnum, ForeignKey, Index, Numeric, String
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class MaterialStatus(str, Enum):
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    UNDER_REVIEW = "UNDER_REVIEW"
    VERIFIED = "VERIFIED"
    APPROVED = "APPROVED"
    LOCKED = "LOCKED"


class MaterialEntry(Base):
    __tablename__ = "material_entries"
    __table_args__ = (
        Index("ix_material_entries_project_id", "project_id"),
        Index("ix_material_entries_created_by_id", "created_by_id"),
        Index("ix_material_entries_verified_by_id", "verified_by_id"),
        Index("ix_material_entries_approved_by_id", "approved_by_id"),
        Index("ix_material_entries_status", "status"),
    )

    id: Mapped[UUID] = mapped_column(
        PgUUID(as_uuid=True), primary_key=True, default=uuid4
    )
    project_id: Mapped[UUID] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="RESTRICT"),
        nullable=False,
    )
    material_name: Mapped[str] = mapped_column(String(255), nullable=False)
    quantity: Mapped[float] = mapped_column(Numeric(14, 6), nullable=False)
    supplier_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    supplier_email: Mapped[str | None] = mapped_column(String(255), nullable=True)

    factor_version_snapshot: Mapped[int] = mapped_column(nullable=False)
    factor_value_snapshot: Mapped[float] = mapped_column(
        Numeric(14, 6), nullable=False
    )
    factor_unit_snapshot: Mapped[str] = mapped_column(String(64), nullable=False)
    factor_source_snapshot: Mapped[str] = mapped_column(String(255), nullable=False)
    calculated_emission: Mapped[float] = mapped_column(
        Numeric(14, 6), nullable=False
    )

    status: Mapped[MaterialStatus] = mapped_column(
        SqlEnum(MaterialStatus, name="material_status_enum"),
        default=MaterialStatus.DRAFT,
        nullable=False,
    )
    created_by_id: Mapped[UUID] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    verified_by_id: Mapped[UUID | None] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=True,
    )
    approved_by_id: Mapped[UUID | None] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=True,
    )
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    locked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    audit_required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    temporal_anomaly: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    bim_discrepancy_score: Mapped[float | None] = mapped_column(Numeric(10, 4))
    bim_validation_status: Mapped[str | None] = mapped_column(String(32), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    project = relationship("Project", back_populates="material_entries")
    creator = relationship(
        "User", back_populates="material_entries", foreign_keys=[created_by_id]
    )
    verified_by = relationship(
        "User", back_populates="verified_entries", foreign_keys=[verified_by_id]
    )
    approved_by = relationship(
        "User", back_populates="approved_entries", foreign_keys=[approved_by_id]
    )
