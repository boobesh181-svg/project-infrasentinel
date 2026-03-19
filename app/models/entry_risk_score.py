from datetime import datetime, timezone
from enum import Enum
from uuid import UUID, uuid4

from sqlalchemy import DateTime, Enum as SqlEnum, ForeignKey, Index, Integer
from sqlalchemy.dialects.postgresql import JSONB, UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class RiskLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class EntryRiskScore(Base):
    __tablename__ = "entry_risk_scores"
    __table_args__ = (Index("ix_entry_risk_scores_entry_id", "entry_id"),)

    id: Mapped[UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    entry_id: Mapped[UUID] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("material_entries.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    risk_score: Mapped[int] = mapped_column(Integer, nullable=False)
    risk_level: Mapped[RiskLevel] = mapped_column(
        SqlEnum(RiskLevel, name="risk_level_enum"),
        nullable=False,
    )
    reasons: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
