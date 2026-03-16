from datetime import date, datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel

from app.models.mrv_report import MRVReportStatus


class MRVReportGenerate(BaseModel):
    project_id: UUID
    report_period_start: date
    report_period_end: date


class MRVReportOut(BaseModel):
    id: UUID
    project_id: UUID
    report_period_start: date
    report_period_end: date
    total_emissions: float
    report_data: dict[str, Any]
    created_by: UUID
    created_at: datetime
    status: MRVReportStatus

    class Config:
        orm_mode = True
