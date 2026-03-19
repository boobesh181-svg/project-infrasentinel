from datetime import datetime, timezone
from enum import Enum
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import DateTime, Enum as SqlEnum, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.project import Project


class BIMFileFormat(str, Enum):
    IFC = "IFC"
    RVT = "RVT"
    GLTF = "GLTF"


class BIMModel(Base):
    __tablename__ = "bim_models"
    __table_args__ = (Index("ix_bim_models_project_id", "project_id"),)

    id: Mapped[UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    project_id: Mapped[UUID] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="RESTRICT"),
        nullable=False,
    )
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    file_format: Mapped[BIMFileFormat] = mapped_column(
        SqlEnum(BIMFileFormat, name="bim_file_format_enum"),
        nullable=False,
    )
    uploaded_by: Mapped[UUID] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    project: Mapped["Project"] = relationship(back_populates="bim_models")
