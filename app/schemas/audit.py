from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel


class AuditLogOut(BaseModel):
    id: UUID
    performed_by_id: UUID
    entity_type: str
    entity_id: UUID
    action: str
    previous_state: dict[str, Any]
    new_state: dict[str, Any]
    timestamp: datetime

    class Config:
        orm_mode = True
