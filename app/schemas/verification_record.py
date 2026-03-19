from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class VerificationActionRequest(BaseModel):
    notes: str | None = None


class VerificationRecordOut(BaseModel):
    id: UUID
    organization_id: UUID
    emission_record_id: UUID
    verifier_id: UUID | None
    approver_id: UUID | None
    submitted_at: datetime | None
    reviewed_at: datetime | None
    approved_at: datetime | None
    locked_at: datetime | None
    review_notes: str | None
    created_at: datetime
    created_by: UUID
    status: str

    class Config:
        orm_mode = True
