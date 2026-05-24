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


class DeliveryEventOut(BaseModel):
    id: UUID
    site_id: UUID
    camera_id: Optional[str]
    vehicle_plate: Optional[str]
    supplier: Optional[str]
    expected_quantity: Optional[float]
    detected_quantity: Optional[float]
    gps_lat: Optional[float]
    gps_lng: Optional[float]
    occurred_at: datetime
    state: str
    confidence: Optional[float]
    evidence: List[EvidenceOut] = []
    verification_results: List[VerificationOut] = []
    created_at: datetime

    class Config:
        orm_mode = True


class VerifyActionIn(BaseModel):
    action: str
    notes: Optional[str]
    operator_id: Optional[UUID]
