from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import TYPE_CHECKING, List
from uuid import UUID, uuid4

from sqlalchemy import Boolean, DateTime, Enum as SqlEnum, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.audit_log import AuditLog
    from app.models.material_entry import MaterialEntry
    from app.models.notification import Notification
    from app.models.organization import Organization
    from app.models.project import Project


class UserRole(str, Enum):
    ADMIN = "ADMIN"
    CREATOR = "CREATOR"
    VERIFIER = "VERIFIER"
    APPROVER = "APPROVER"
    SITE_ENGINEER = "SITE_ENGINEER"
    CONTRACTOR_MANAGER = "CONTRACTOR_MANAGER"
    ESG_ANALYST = "ESG_ANALYST"
    AUDITOR = "AUDITOR"
    SUPPLIER = "SUPPLIER"


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        Index("ix_users_organization_id", "organization_id"),
        Index("ix_users_email", "email"),
    )

    id: Mapped[UUID] = mapped_column(
        PgUUID(as_uuid=True), primary_key=True, default=uuid4
    )
    organization_id: Mapped[UUID] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="RESTRICT"),
        nullable=False,
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        SqlEnum(UserRole, name="user_role_enum"),
        default=UserRole.CREATOR,
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    organization: Mapped["Organization"] = relationship(
        back_populates="users", passive_deletes=True
    )
    projects: Mapped[List["Project"]] = relationship(
        back_populates="creator", passive_deletes=True
    )
    material_entries: Mapped[List["MaterialEntry"]] = relationship(
        back_populates="creator",
        passive_deletes=True,
        foreign_keys="MaterialEntry.created_by_id",
    )
    verified_entries: Mapped[List["MaterialEntry"]] = relationship(
        back_populates="verified_by",
        passive_deletes=True,
        foreign_keys="MaterialEntry.verified_by_id",
    )
    approved_entries: Mapped[List["MaterialEntry"]] = relationship(
        back_populates="approved_by",
        passive_deletes=True,
        foreign_keys="MaterialEntry.approved_by_id",
    )
    notifications: Mapped[List["Notification"]] = relationship(
        back_populates="notified_user", passive_deletes=True
    )
    audit_logs: Mapped[List["AuditLog"]] = relationship(
        back_populates="performed_by", passive_deletes=True
    )
