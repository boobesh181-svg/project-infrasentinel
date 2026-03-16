from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.attestation import AttestationCreate, AttestationResponse
from app.services.attestation_service import AttestationService

router = APIRouter(prefix="/attestations", tags=["attestations"])


@router.post("", response_model=AttestationResponse)
def create_attestation(
    payload: AttestationCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AttestationResponse:
    service = AttestationService(db)
    return service.create_attestation(payload=payload, user=user)


@router.get("/{entity_type}/{entity_id}", response_model=list[AttestationResponse])
def list_attestations(
    entity_type: str,
    entity_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[AttestationResponse]:
    service = AttestationService(db)
    return service.get_entity_attestations(
        entity_type=entity_type,
        entity_id=entity_id,
        user=user,
    )
