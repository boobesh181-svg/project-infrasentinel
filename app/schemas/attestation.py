from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class AttestationCreate(BaseModel):
    entity_type: str
    entity_id: UUID
    attestation_type: str
    comment: str | None = None


class AttestationResponse(BaseModel):
    id: UUID
    entity_type: str
    entity_id: UUID
    attestor_user_id: UUID
    attestation_type: str
    comment: str | None
    created_at: datetime

    class Config:
        orm_mode = True
