from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, validator

from app.models.weighbridge_event import WeighbridgeStatus


class WeighbridgeEventCreate(BaseModel):
    delivery_event_id: UUID
    invoice_id: UUID | None = None
    gross_weight: float = Field(gt=0)
    unit: str = Field(default="kg", min_length=1, max_length=32)

    @validator("unit")
    def _normalize_unit(cls, value: str) -> str:
        return value.strip().lower()


class WeighbridgeTareCapture(BaseModel):
    tare_weight: float = Field(gt=0)
    mismatch_threshold: float = Field(default=0.05, ge=0.0, le=1.0)


class WeighbridgeEventOut(BaseModel):
    id: UUID
    organization_id: UUID
    delivery_event_id: UUID
    invoice_id: UUID | None
    gross_weight: float
    tare_weight: float | None
    net_weight: float | None
    unit: str
    gross_captured_at: datetime
    tare_captured_at: datetime | None
    expected_quantity: float | None
    mismatch_percent: float | None
    mismatch_threshold: float
    anomaly_flags: list[str]
    status: WeighbridgeStatus
    created_by: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True
