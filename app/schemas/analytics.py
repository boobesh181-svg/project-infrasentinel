from datetime import datetime

from pydantic import BaseModel


class EmissionsByProjectOut(BaseModel):
    project_id: str
    project_name: str
    emissions: float


class EmissionsByMaterialOut(BaseModel):
    material_name: str
    emissions: float


class EmissionsByTimeOut(BaseModel):
    period_start: datetime
    emissions: float
