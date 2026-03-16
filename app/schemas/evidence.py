from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class EvidenceOut(BaseModel):
    id: UUID
    material_entry_id: UUID
    file_name: str
    file_type: str
    file_size: int
    file_hash: str
    storage_path: str
    uploaded_by: UUID
    uploaded_at: datetime

    class Config:
        orm_mode = True
