from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, validator

from app.models.material_entry import MaterialStatus


class MaterialEntryCreate(BaseModel):
    project_id: UUID
    material_name: str = Field(min_length=1, max_length=255)
    quantity: float = Field(gt=0)
    supplier_name: str | None = Field(default=None, max_length=255)
    supplier_email: str | None = Field(default=None, max_length=255)
    factor_version_snapshot: int = Field(ge=1)
    factor_value_snapshot: float = Field(gt=0)
    factor_unit_snapshot: str = Field(min_length=1, max_length=64)
    factor_source_snapshot: str = Field(min_length=1, max_length=255)

    @validator("material_name", "factor_unit_snapshot", "factor_source_snapshot")
    def _strip_required_strings(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("must not be blank")
        return stripped

    @validator("supplier_name", "supplier_email")
    def _strip_optional_strings(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None


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
    ai_risk_score: Optional[float]
    ai_risk_level: Optional[str]
    ai_anomaly_reason: Optional[str]
    signature: Optional[str]
    signature_algorithm: Optional[str]
    created_at: datetime

    class Config:
        orm_mode = True


class MaterialEntryListOut(BaseModel):
    total: int
    items: list[MaterialEntryOut]


class WorkflowSignatureIn(BaseModel):
    signature: str = Field(min_length=1)
    signature_algorithm: str = Field(min_length=1, max_length=64)
    timestamp: datetime
