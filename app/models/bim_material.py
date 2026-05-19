from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, Index, Numeric, String
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class BIMMaterial(Base):
    __tablename__ = "bim_materials"
    __table_args__ = (
        Index("ix_bim_materials_bim_model_id", "bim_model_id"),
        Index("ix_bim_materials_material_name", "material_name"),
    )

    id: Mapped[UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    bim_model_id: Mapped[UUID] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("bim_models.id", ondelete="CASCADE"),
        nullable=False,
    )
    material_name: Mapped[str] = mapped_column(String(255), nullable=False)
    quantity: Mapped[float] = mapped_column(Numeric(14, 6), nullable=False)
    unit: Mapped[str] = mapped_column(String(32), nullable=False)
    source_element: Mapped[str | None] = mapped_column(String(255), nullable=True)
    confidence_score: Mapped[float] = mapped_column(Numeric(6, 4), nullable=False, default=0.8)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    bim_model = relationship("BIMModel", back_populates="materials")
