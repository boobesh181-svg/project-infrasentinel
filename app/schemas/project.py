from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, Field, root_validator, validator

from app.schemas.material_entry import MaterialEntryOut


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    location: str = Field(min_length=1, max_length=255)
    reporting_period_start: date
    reporting_period_end: date

    @validator("name", "location")
    def _strip_required_text(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("must not be blank")
        return stripped

    @root_validator
    def _validate_period(cls, values: dict[str, object]) -> dict[str, object]:
        period_start = values.get("reporting_period_start")
        period_end = values.get("reporting_period_end")
        if isinstance(period_start, date) and isinstance(period_end, date) and period_start > period_end:
            raise ValueError("reporting_period_start must be before or equal to reporting_period_end")
        return values


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
