from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel

from app.models.material_entry import MaterialStatus


class MaterialEntryCreate(BaseModel):
    project_id: UUID
    material_name: str
    quantity: float
    supplier_name: str | None = None
    supplier_email: str | None = None
    factor_version_snapshot: int
    factor_value_snapshot: float
    factor_unit_snapshot: str
    factor_source_snapshot: str


class MaterialEntryOut(BaseModel):
    id: UUID
    project_id: UUID
    material_name: str
    quantity: float
    supplier_name: str | None
    supplier_email: str | None
    factor_version_snapshot: int
    factor_value_snapshot: float
    factor_unit_snapshot: str
    factor_source_snapshot: str
    calculated_emission: float
    status: MaterialStatus
    created_by_id: UUID
    verified_by_id: Optional[UUID]
    approved_by_id: Optional[UUID]
    submitted_at: Optional[datetime]
    verified_at: Optional[datetime]
    locked_at: Optional[datetime]
    audit_required: bool
    temporal_anomaly: bool
    bim_discrepancy_score: Optional[float]
    bim_validation_status: Optional[str]
    created_at: datetime

    class Config:
        orm_mode = True


class MaterialEntryListOut(BaseModel):
    total: int
    items: list[MaterialEntryOut]
