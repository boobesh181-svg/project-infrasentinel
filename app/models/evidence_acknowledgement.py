from datetime import datetime, timezone
from enum import Enum
from uuid import UUID, uuid4

from sqlalchemy import DateTime, Enum as SqlEnum, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class AcknowledgementRole(str, Enum):
    VERIFIER = "VERIFIER"
    AUDITOR = "AUDITOR"
    SUPPLIER = "SUPPLIER"


class AcknowledgementResponseType(str, Enum):
    ACK = "ACK"
    DISPUTE = "DISPUTE"


class EvidenceAcknowledgement(Base):
    __tablename__ = "evidence_acknowledgements"
    __table_args__ = (
        Index("ix_evidence_ack_material_entry_id", "material_entry_id"),
        Index("ix_evidence_ack_user_id", "user_id"),
    )

    id: Mapped[UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    material_entry_id: Mapped[UUID] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("material_entries.id", ondelete="RESTRICT"),
        nullable=False,
    )
    user_id: Mapped[UUID] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    role: Mapped[AcknowledgementRole] = mapped_column(
        SqlEnum(AcknowledgementRole, name="acknowledgement_role_enum"),
        nullable=False,
    )
    response_type: Mapped[AcknowledgementResponseType] = mapped_column(
        SqlEnum(AcknowledgementResponseType, name="acknowledgement_response_type_enum"),
        nullable=False,
    )
    comment: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
