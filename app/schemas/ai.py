from __future__ import annotations

from pydantic import BaseModel, Field


class AIRiskBreakdownOut(BaseModel):
    anomaly_score: float = Field(ge=0, le=1)
    rule_score: float = Field(ge=0, le=1)
    combined_score: float = Field(ge=0, le=1)
    risk_level: str
    explanation: list[str]
    top_contributing_features: list[str]
    deviation_details: dict[str, float]
    model_version: int


class AITrainOut(BaseModel):
    current_model: str | None
    algorithm: str
    trained_at: str | None
    training_samples: int
    model_version: int


class AIMonitoringOut(BaseModel):
    anomaly_rate: float
    false_positive_rate: float
    score_distribution: list[float]
    drift_detection: dict[str, float | bool | str]


class AIModelStatusOut(BaseModel):
    model_loaded: bool
    current_model: str | None
    algorithm: str
    trained_at: str | None
    training_samples: int
    model_version: int
    monitoring: dict[str, float | int | list[float]]
    drift: dict[str, float | bool | str]
