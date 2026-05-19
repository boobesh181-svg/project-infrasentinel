from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.models.bim_model import BIMFileFormat, BIMProcessingStatus


class BIMModelUploadOut(BaseModel):
    id: UUID
    project_id: UUID
    file_path: str
    file_format: BIMFileFormat
    uploaded_by: UUID
    uploaded_at: datetime

    class Config:
        orm_mode = True


class BIMModelOut(BaseModel):
    id: UUID
    project_id: UUID
    file_path: str
    model_name: str
    file_hash: str
    file_format: BIMFileFormat
    uploaded_by: UUID
    uploaded_at: datetime
    processing_status: BIMProcessingStatus
    created_at: datetime

    class Config:
        orm_mode = True


class BIMUploadResponseOut(BaseModel):
    message: str
    model: BIMModelOut


class BIMMaterialOut(BaseModel):
    id: UUID
    bim_model_id: UUID
    material_name: str
    quantity: float
    unit: str
    source_element: str | None
    confidence_score: float

    class Config:
        orm_mode = True


class BIMComparisonRowOut(BaseModel):
    material: str
    expected: float
    reported: float
    difference: float
    difference_ratio: float
    risk_score: float
    risk_level: str


class BIMComparisonOut(BaseModel):
    project_id: str
    bim_model_id: str | None
    comparisons: list[BIMComparisonRowOut]
    anomalies: list[BIMComparisonRowOut]


class BIMMaterialEstimateOut(BaseModel):
    project_id: UUID
    material_type: str
    estimated_quantity: float
    unit: str


class BIMDiscrepancyOut(BaseModel):
    project_id: UUID
    project_name: str
    material_type: str
    estimated_quantity: float
    reported_quantity: float
    discrepancy_ratio: float


class ProjectBIMEstimateOut(BaseModel):
    material: str
    estimated: float
    reported: float
    discrepancy: float
    status: str


class ProjectBIMDiscrepancyOut(BaseModel):
    material: str
    estimated: float
    reported: float
    discrepancy: float
    status: str


class BIMExtractedMaterialOut(BaseModel):
    name: str
    quantity: float
    unit: str


class BIMUploadMaterialsOut(BaseModel):
    materials: list[BIMExtractedMaterialOut]
