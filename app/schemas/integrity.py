from pydantic import BaseModel


class IntegrityBreakdownOut(BaseModel):
    material_verification: int
    emission_accuracy: int
    anomaly_risk: int
    evidence_completeness: int


class IntegrityScoreOut(BaseModel):
    integrity_score: int
    breakdown: IntegrityBreakdownOut
