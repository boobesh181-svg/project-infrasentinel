from __future__ import annotations

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel


class EvidenceOut(BaseModel):
    id: UUID
    file_name: str
    file_type: str
    content_type: Optional[str]
    file_size: Optional[int]
    file_hash: Optional[str]
    storage_path: Optional[str]
    uploaded_by: Optional[UUID]
    uploaded_at: datetime

    class Config:
        orm_mode = True


class VerificationOut(BaseModel):
    id: UUID
    analyzer: str
    confidence: Optional[float]
    reasoning: Optional[str]
    created_at: datetime

    class Config:
        orm_mode = True


class DeliveryEventIn(BaseModel):
    site_id: UUID
    camera_id: Optional[str]
    vehicle_plate: Optional[str]
    supplier: Optional[str]
    expected_quantity: Optional[float]
    gps_lat: Optional[float]
    gps_lng: Optional[float]
    occurred_at: datetime


class DeliveryInvoiceLinkOut(BaseModel):
    id: UUID
    invoice_id: UUID
    delivery_event_id: UUID
    match_confidence: Optional[float]
    match_reason: Optional[str]
    matched_at: datetime

    class Config:
        orm_mode = True


class DeliveryEventOut(BaseModel):
    id: UUID
    site_id: UUID
    camera_id: Optional[str]
    vehicle_plate: Optional[str]
    supplier: Optional[str]
    expected_quantity: Optional[float]
    detected_quantity: Optional[float]
    detected_plate: Optional[str]
    detected_material_type: Optional[str]
    detection_confidence: Optional[float]
    anpr_confidence: Optional[float]
    duplicate_vehicle: bool
    suspicious_flags: List[str] = []
    detected_at: Optional[datetime]
    gps_lat: Optional[float]
    gps_lng: Optional[float]
    occurred_at: datetime
    state: str
    confidence: Optional[float]
    evidence: List[EvidenceOut] = []
    verification_results: List[VerificationOut] = []
    invoice_links: List[DeliveryInvoiceLinkOut] = []
    created_at: datetime

    class Config:
        orm_mode = True


class VerifyActionIn(BaseModel):
    action: str
    notes: Optional[str]
    operator_id: Optional[UUID]


class DeliveryDetectionIn(BaseModel):
    detected_plate: Optional[str]
    detected_material_type: Optional[str]
    detected_quantity: Optional[float]
    detection_confidence: Optional[float]
    anpr_confidence: Optional[float]
    timestamp: Optional[datetime]


