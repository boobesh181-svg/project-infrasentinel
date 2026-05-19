from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.models.supplier_confirmation import SupplierConfirmationStatus


class SupplierConfirmationActionIn(BaseModel):
    status: SupplierConfirmationStatus


class SupplierConfirmationOut(BaseModel):
    id: UUID
    entry_id: UUID
    supplier_name: str
    supplier_email: str
    status: SupplierConfirmationStatus
    confirmed_at: datetime | None
    created_at: datetime

    class Config:
        orm_mode = True
