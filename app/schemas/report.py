from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel


class ReportGenerateRequest(BaseModel):
    project_id: UUID
    report_period_start: date
    report_period_end: date
    format: str


class ReportOut(BaseModel):
    id: UUID
    organization_id: UUID
    project_id: UUID
    generated_by: UUID
    report_type: str
    report_period_start: date
    report_period_end: date
    format: str
    file_url: str
    generation_hash: str
    created_at: datetime
    status: str

    class Config:
        orm_mode = True
