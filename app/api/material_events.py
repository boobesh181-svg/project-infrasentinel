from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db
from app.models.material_entry import MaterialStatus
from app.models.user import User
from app.schemas.material_event import (
    MaterialEventCreate,
    MaterialEventListOut,
    MaterialEventOut,
    MaterialEventUpdate,
)
from app.services.material_event_service import MaterialEventService

router = APIRouter(prefix="/material-events", tags=["material-events"])


@router.post("", response_model=MaterialEventOut)
def create_material_event(
    payload: MaterialEventCreate,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
) -> MaterialEventOut:
    service = MaterialEventService(db)
    record = service.create(payload=payload, actor=actor)
    db.commit()
    return record


@router.patch("/{event_id}", response_model=MaterialEventOut)
def update_material_event(
    event_id: UUID,
    payload: MaterialEventUpdate,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
) -> MaterialEventOut:
    service = MaterialEventService(db)
    record = service.update_draft(event_id=event_id, payload=payload, actor=actor)
    db.commit()
    return record


@router.post("/{event_id}/submit", response_model=MaterialEventOut)
def submit_material_event(
    event_id: UUID,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
) -> MaterialEventOut:
    service = MaterialEventService(db)
    record = service.transition(event_id=event_id, target=MaterialStatus.SUBMITTED, actor=actor)
    db.commit()
    return record


@router.post("/{event_id}/start-review", response_model=MaterialEventOut)
def start_review(
    event_id: UUID,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
) -> MaterialEventOut:
    service = MaterialEventService(db)
    record = service.transition(event_id=event_id, target=MaterialStatus.UNDER_REVIEW, actor=actor)
    db.commit()
    return record


@router.get("", response_model=MaterialEventListOut)
def list_material_events(
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
    limit: int = Query(50, ge=1),
    offset: int = Query(0, ge=0),
) -> MaterialEventListOut:
    service = MaterialEventService(db)
    total, items = service.list(actor=actor, limit=limit, offset=offset)
    return MaterialEventListOut(total=total, items=items)
