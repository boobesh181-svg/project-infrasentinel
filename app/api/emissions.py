from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db
from app.models.emission_record import EmissionRecord
from app.models.user import User
from app.schemas.emission_record import EmissionRecordCreate, EmissionRecordOut
from app.services.emission_record_service import EmissionRecordService

router = APIRouter(prefix="/emissions", tags=["emissions"])


@router.post("/calculate", response_model=EmissionRecordOut)
def calculate_emission(
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
        from fastapi import HTTPException, status

        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Emission record not found")
    return record
