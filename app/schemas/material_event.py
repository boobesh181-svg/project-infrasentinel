from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel

from app.models.material_entry import MaterialStatus


class MaterialEventCreate(BaseModel):
    project_id: UUID
    supplier_id: UUID
    material_type: str
    quantity: float
    unit: str
    delivery_date: date


class MaterialEventUpdate(BaseModel):
    supplier_id: UUID | None = None
    material_type: str | None = None
    quantity: float | None = None
    unit: str | None = None
    delivery_date: date | None = None


class MaterialEventOut(BaseModel):
    id: UUID
    organization_id: UUID
    project_id: UUID
    supplier_id: UUID
    material_type: str
    quantity: float
    unit: str
    delivery_date: date
    status: MaterialStatus
    created_at: datetime
    created_by: UUID
    parent_event_id: UUID | None

    class Config:
        orm_mode = True


class MaterialEventListOut(BaseModel):
    total: int
    items: list[MaterialEventOut]
