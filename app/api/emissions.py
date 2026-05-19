from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db
from app.models.emission_record import EmissionRecord
from app.models.user import User
from app.schemas.emissions import EmissionsCalculationRequest, EmissionsCalculationResponse
from app.schemas.emission_record import EmissionRecordCreate, EmissionRecordOut
from app.services.emission_record_service import EmissionRecordService
from app.services.emissions_service import EmissionsService

router = APIRouter(prefix="/emissions", tags=["emissions"])


@router.post("/calculate", response_model=EmissionsCalculationResponse)
def calculate_material_emissions(
    payload: EmissionsCalculationRequest,
    db: Session = Depends(get_db),
    _actor: User = Depends(get_current_user),
) -> EmissionsCalculationResponse:
    try:
        result = EmissionsService(db).calculate_material_emissions(
            [material.dict() for material in payload.materials]
        )
        return EmissionsCalculationResponse(**result)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/calculate-record", response_model=EmissionRecordOut)
def calculate_emission_record(
    payload: EmissionRecordCreate,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
) -> EmissionRecordOut:
    service = EmissionRecordService(db)
    record = service.calculate(
        material_event_id=payload.material_event_id,
        calculation_method=payload.calculation_method,
        actor=actor,
    )
    db.commit()
    return record


@router.get("/{emission_record_id}", response_model=EmissionRecordOut)
def get_emission_record(
    emission_record_id: UUID,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
) -> EmissionRecordOut:
    record = db.get(EmissionRecord, emission_record_id)
    if record is None or record.organization_id != actor.organization_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Emission record not found")
    return record
