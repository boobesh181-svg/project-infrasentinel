from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class SupplierCreate(BaseModel):
    name: str
    country: str | None = None
    contact_email: str | None = None


class SupplierOut(BaseModel):
    id: UUID
    organization_id: UUID
    name: str
    country: str | None
    contact_email: str | None
    status: str
    created_at: datetime
    created_by: UUID

    class Config:
        orm_mode = True
