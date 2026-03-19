from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class EvidenceOut(BaseModel):
    id: UUID
    material_entry_id: UUID
    file_name: str
    file_type: str
    content_type: str
    file_size: int
    file_hash: str
    evidence_type: str
    duplicate_flag: bool
    storage_path: str
    uploaded_by: UUID
    uploaded_at: datetime

    class Config:
        orm_mode = True


class EvidenceListOut(BaseModel):
    total: int
    items: list[EvidenceOut]
