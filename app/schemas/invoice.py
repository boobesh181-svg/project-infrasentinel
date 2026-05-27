from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, validator

from app.models.supplier_invoice import InvoiceStatus


class InvoiceDeliveryLinkOut(BaseModel):
    id: UUID
    invoice_id: UUID
    delivery_event_id: UUID
    match_confidence: float | None
    match_reason: str | None
    matched_at: datetime

    class Config:
        orm_mode = True


class SupplierInvoiceOut(BaseModel):
    id: UUID
    organization_id: UUID
    uploaded_by: UUID
    supplier_name: str | None
    invoice_number: str | None
    material_type: str | None
    expected_quantity: float | None
    vehicle_number: str | None
    invoice_timestamp: datetime | None
    raw_text: str | None
    extraction_confidence: dict
    extraction_status: InvoiceStatus
    extraction_errors: list[str]
    file_name: str
    file_type: str
    content_type: str
    file_size: int
    file_hash: str
    storage_path: str
    correction_notes: str | None
    corrected_by: UUID | None
    corrected_at: datetime | None
    uploaded_at: datetime
    updated_at: datetime
    delivery_links: list[InvoiceDeliveryLinkOut] = []

    class Config:
        orm_mode = True


class SupplierInvoiceListOut(BaseModel):
    total: int
    items: list[SupplierInvoiceOut]


class SupplierInvoiceUpdate(BaseModel):
    supplier_name: str | None = Field(default=None, max_length=255)
    invoice_number: str | None = Field(default=None, max_length=128)
    material_type: str | None = Field(default=None, max_length=255)
    expected_quantity: float | None = Field(default=None, gt=0)
    vehicle_number: str | None = Field(default=None, max_length=64)
    invoice_timestamp: datetime | None = None
    correction_notes: str | None = Field(default=None, max_length=500)

    @validator("supplier_name", "invoice_number", "material_type", "vehicle_number", "correction_notes")
    def _strip_optional_strings(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None
