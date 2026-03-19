from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel

from app.schemas.material_entry import MaterialEntryOut


class ProjectCreate(BaseModel):
    name: str
    location: str
    reporting_period_start: date
    reporting_period_end: date


class ProjectOut(BaseModel):
    id: UUID
    organization_id: UUID
    created_by_id: UUID
    name: str
    location: str
    reporting_period_start: date
    reporting_period_end: date
    created_at: datetime

    class Config:
        orm_mode = True


class ProjectListOut(BaseModel):
    total: int
    items: list[ProjectOut]


class ProjectMaterialEntryListOut(BaseModel):
    total: int
    items: list[MaterialEntryOut]
