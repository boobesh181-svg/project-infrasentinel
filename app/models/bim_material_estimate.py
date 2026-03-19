from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, Index, Numeric, String
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class BIMMaterialEstimate(Base):
    __tablename__ = "bim_material_estimates"
    __table_args__ = (
        Index("ix_bim_material_estimates_project_id", "project_id"),
        Index("ix_bim_material_estimates_material_type", "material_type"),
    )

    id: Mapped[UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    project_id: Mapped[UUID] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
    )
    material_type: Mapped[str] = mapped_column(String(255), nullable=False)
    estimated_quantity: Mapped[float] = mapped_column(Numeric(14, 6), nullable=False)
    unit: Mapped[str] = mapped_column(String(32), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
