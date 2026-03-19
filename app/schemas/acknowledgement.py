from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.models.evidence_acknowledgement import (
    AcknowledgementResponseType,
    AcknowledgementRole,
)


class EvidenceAcknowledgeIn(BaseModel):
    comment: str | None = None


class SupplierConfirmationIn(BaseModel):
    entry_id: UUID
    confirmation_status: str
    comment: str | None = None


class EvidenceAcknowledgementOut(BaseModel):
    id: UUID
    material_entry_id: UUID
    user_id: UUID
    role: AcknowledgementRole
    response_type: AcknowledgementResponseType
    comment: str | None
    timestamp: datetime

    class Config:
        orm_mode = True


class EvidenceAcknowledgementListOut(BaseModel):
    total: int
    items: list[EvidenceAcknowledgementOut]
