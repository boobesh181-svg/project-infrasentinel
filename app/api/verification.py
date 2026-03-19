from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.verification_record import VerificationActionRequest, VerificationRecordOut
from app.services.verification_record_service import VerificationRecordService

router = APIRouter(prefix="/verification", tags=["verification"])


@router.post("/{emission_record_id}/start-review", response_model=VerificationRecordOut)
def start_review(
    emission_record_id: UUID,
    payload: VerificationActionRequest,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
) -> VerificationRecordOut:
    service = VerificationRecordService(db)
    record = service.start_review(
        emission_record_id=emission_record_id,
        actor=actor,
        notes=payload.notes,
    )
    db.commit()
    return record


@router.post("/{verification_id}/verify", response_model=VerificationRecordOut)
def verify_record(
    verification_id: UUID,
    payload: VerificationActionRequest,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
) -> VerificationRecordOut:
    service = VerificationRecordService(db)
    record = service.verify(verification_id=verification_id, actor=actor, notes=payload.notes)
    db.commit()
    return record


@router.post("/{verification_id}/approve", response_model=VerificationRecordOut)
def approve_record(
    verification_id: UUID,
    payload: VerificationActionRequest,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
) -> VerificationRecordOut:
    service = VerificationRecordService(db)
    record = service.approve(verification_id=verification_id, actor=actor, notes=payload.notes)
    db.commit()
    return record


@router.post("/{verification_id}/lock", response_model=VerificationRecordOut)
def lock_record(
    verification_id: UUID,
    payload: VerificationActionRequest,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
) -> VerificationRecordOut:
    service = VerificationRecordService(db)
    record = service.lock(verification_id=verification_id, actor=actor, notes=payload.notes)
    db.commit()
    return record


@router.get("/{verification_id}", response_model=VerificationRecordOut)
def get_verification(
    verification_id: UUID,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
) -> VerificationRecordOut:
    service = VerificationRecordService(db)
    return service.get(verification_id=verification_id, actor=actor)
