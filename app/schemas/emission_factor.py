from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel


class EmissionFactorCreate(BaseModel):
    material_name: str
    factor_value: float
    unit: str
    source: str
    standard_name: str
    region: str
    source_document_url: str
    methodology_reference: str
    version: int
    valid_from: date
    valid_to: date | None = None
    is_active: bool = True


class EmissionFactorOut(BaseModel):
    id: UUID
    material_name: str
    factor_value: float
    unit: str
    source: str
    standard_name: str
    region: str
    source_document_url: str
    methodology_reference: str
    version: int
    valid_from: date
    valid_to: date | None
    is_active: bool
    created_at: datetime

    class Config:
        orm_mode = True
