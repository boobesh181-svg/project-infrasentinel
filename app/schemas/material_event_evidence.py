from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class MaterialEventEvidenceCreate(BaseModel):
    file_url: str
    file_hash: str
    file_type: str
    evidence_type: str


class MaterialEventEvidenceOut(BaseModel):
    id: UUID
    organization_id: UUID
    material_event_id: UUID
    file_url: str
    file_hash: str
    file_type: str
    evidence_type: str
    created_at: datetime
    created_by: UUID
    status: str

    class Config:
        orm_mode = True


class MaterialEventEvidenceListOut(BaseModel):
    total: int
    items: list[MaterialEventEvidenceOut]
