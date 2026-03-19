from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.models.bim_model import BIMFileFormat


class BIMModelUploadOut(BaseModel):
    id: UUID
    project_id: UUID
    file_path: str
    file_format: BIMFileFormat
    uploaded_by: UUID
    uploaded_at: datetime

    class Config:
        orm_mode = True


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
