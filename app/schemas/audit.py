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
    previous_hash: str
    current_hash: str

    class Config:
        orm_mode = True


class AuditLogListOut(BaseModel):
    total: int
    items: list[AuditLogOut]


class AuditRootHashOut(BaseModel):
    root_hash: str | None
