from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel

from app.models.material_entry import MaterialStatus


class MaterialEntryCreate(BaseModel):
    project_id: UUID
    material_name: str
    quantity: float
    factor_version_snapshot: int
    factor_value_snapshot: float
    factor_unit_snapshot: str
    factor_source_snapshot: str


class MaterialEntryOut(BaseModel):
    id: UUID
    project_id: UUID
    material_name: str
    quantity: float
    factor_version_snapshot: int
    factor_value_snapshot: float
    factor_unit_snapshot: str
    factor_source_snapshot: str
    calculated_emission: float
    status: MaterialStatus
    created_by_id: UUID
    verified_by_id: Optional[UUID]
    approved_by_id: Optional[UUID]
    locked_at: Optional[datetime]
    created_at: datetime

    class Config:
        orm_mode = True
