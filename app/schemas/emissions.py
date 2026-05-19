from pydantic import BaseModel, Field


class MaterialInput(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    quantity: float = Field(ge=0)
    unit: str = Field(min_length=1, max_length=64)


class EmissionBreakdownItem(BaseModel):
    material: str
    emissions: float


class EmissionsCalculationRequest(BaseModel):
    materials: list[MaterialInput] = Field(min_items=1)


class EmissionsCalculationResponse(BaseModel):
    total_emissions: float
    breakdown: list[EmissionBreakdownItem]
