from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.models.entry_risk_score import RiskLevel


class EntryRiskScoreOut(BaseModel):
    entry_id: UUID
    risk_score: int
    risk_level: RiskLevel
    reasons: list[str]
    generated_at: datetime


class HighRiskEntryOut(BaseModel):
    entry_id: UUID
    project_id: UUID
    material_name: str
    status: str
    risk_score: int
    risk_level: RiskLevel
    reasons: list[str]
    generated_at: datetime


class EntryRiskOut(BaseModel):
    entry_id: UUID
    risk_score: int
    risk_level: RiskLevel
    reasons: list[str]
    generated_at: datetime
