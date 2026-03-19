from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class EmissionRecordCreate(BaseModel):
    material_event_id: UUID
    calculation_method: str = "quantity_x_factor"


class EmissionRecordOut(BaseModel):
    id: UUID
    organization_id: UUID
    material_event_id: UUID
    factor_value_snapshot: float
    factor_source_snapshot: str
    factor_reference_snapshot: str
    calculation_method: str
    emission_value: float
    created_at: datetime
    created_by: UUID
    status: str

    class Config:
        orm_mode = True
