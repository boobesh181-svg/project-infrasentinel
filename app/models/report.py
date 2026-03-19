from datetime import date, datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import Date, DateTime, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Report(Base):
    __tablename__ = "reports"
    __table_args__ = (
        Index("ix_reports_organization_id", "organization_id"),
        Index("ix_reports_project_id", "project_id"),
        Index("ix_reports_status", "status"),
    )

    id: Mapped[UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    organization_id: Mapped[UUID] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="RESTRICT"),
        nullable=False,
    )
    project_id: Mapped[UUID] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="RESTRICT"),
        nullable=False,
    )
    generated_by: Mapped[UUID] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    report_type: Mapped[str] = mapped_column(String(50), nullable=False, default="VERIFICATION")
    report_period_start: Mapped[date] = mapped_column(Date, nullable=False)
    report_period_end: Mapped[date] = mapped_column(Date, nullable=False)
    format: Mapped[str] = mapped_column(String(10), nullable=False)
    file_url: Mapped[str] = mapped_column(String(500), nullable=False)
    generation_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="GENERATED")
