from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class PaginationMeta(BaseModel):
    total: int
    limit: int
    offset: int


class IntegrityScoreItemOut(BaseModel):
    project_id: UUID
    project_name: str
    integrity_score: int
    material_verification: int
    emission_accuracy: int
    anomaly_risk: int
    evidence_completeness: int


class DashboardSummaryMetricsOut(BaseModel):
    number_of_projects: int
    total_emissions_verified: float
    anomalies_detected: int


class DashboardSummaryOut(BaseModel):
    metrics: DashboardSummaryMetricsOut
    integrity_scores: list[IntegrityScoreItemOut]
    pagination: PaginationMeta


class DashboardEmissionItemOut(BaseModel):
    project_id: UUID
    project_name: str
    verified_entries: int
    total_verified_emissions: float
    average_verified_emission: float


class DashboardEmissionsOut(BaseModel):
    items: list[DashboardEmissionItemOut]
    pagination: PaginationMeta


class DashboardAnomalyItemOut(BaseModel):
    material_entry_id: UUID
    project_id: UUID
    project_name: str
    material_name: str
    ai_risk_score: float | None
    ai_risk_level: str | None
    temporal_anomaly: bool
    audit_required: bool
    created_at: datetime


class DashboardAnomaliesOut(BaseModel):
    items: list[DashboardAnomalyItemOut]
    pagination: PaginationMeta
