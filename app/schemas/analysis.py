from pydantic import BaseModel, Field


class AnalysisMaterialIn(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    quantity: float = Field(ge=0)


class AnomalyFlagOut(BaseModel):
    material: str
    deviation: float


class AnomalyAnalysisRequest(BaseModel):
    materials: list[AnalysisMaterialIn] = Field(min_items=1)


class AnomalyAnalysisOut(BaseModel):
    risk_score: float
    flags: list[AnomalyFlagOut]


class HistoricalMaterialRowIn(BaseModel):
    building_id: str | None = None
    material: str = Field(min_length=1, max_length=255)
    quantity: float = Field(ge=0)


class HistoricalBuildingIn(BaseModel):
    building_id: str
    materials: list[AnalysisMaterialIn] = Field(min_items=1)


class AnomalyTrainingRequest(BaseModel):
    dataset: list[HistoricalMaterialRowIn | HistoricalBuildingIn] = Field(min_items=1)


class AnomalyTrainingOut(BaseModel):
    trained_rows: int
    model_path: str
