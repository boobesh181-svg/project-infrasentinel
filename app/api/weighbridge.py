from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db
from app.models.delivery_event import DeliveryEvent
from app.models.weighbridge_event import WeighbridgeEvent
from app.models.user import User
from app.schemas.weighbridge import WeighbridgeEventCreate, WeighbridgeEventOut, WeighbridgeTareCapture
from app.services.weighbridge_service import WeighbridgeService

router = APIRouter(prefix="/weighbridge", tags=["weighbridge"])


@router.post("/events", response_model=WeighbridgeEventOut)
def capture_gross_weight(
    payload: WeighbridgeEventCreate,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
) -> WeighbridgeEventOut:
    delivery = db.get(DeliveryEvent, payload.delivery_event_id)
    if delivery is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delivery event not found")

    service = WeighbridgeService(db)
    record = service.capture_gross(
        organization_id=actor.organization_id,
        actor_id=actor.id,
        delivery_event_id=payload.delivery_event_id,
        invoice_id=payload.invoice_id,
        gross_weight=payload.gross_weight,
        unit=payload.unit,
    )
    db.commit()
    db.refresh(record)
    return record


@router.post("/events/{event_id}/tare", response_model=WeighbridgeEventOut)
def capture_tare_weight(
    event_id: UUID,
    payload: WeighbridgeTareCapture,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
) -> WeighbridgeEventOut:
    service = WeighbridgeService(db)
    try:
        record = service.capture_tare(
            record_id=event_id,
            actor_id=actor.id,
            tare_weight=payload.tare_weight,
            mismatch_threshold=payload.mismatch_threshold,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    db.commit()
    db.refresh(record)
    return record


@router.get("/events/{event_id}", response_model=WeighbridgeEventOut)
def get_weighbridge_event(
    event_id: UUID,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
) -> WeighbridgeEventOut:
    record = db.get(WeighbridgeEvent, event_id)
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Weighbridge event not found")
    if record.organization_id != actor.organization_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    return record


@router.get("/events/delivery/{delivery_id}", response_model=WeighbridgeEventOut | None)
def get_latest_for_delivery(
    delivery_id: UUID,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
) -> WeighbridgeEventOut | None:
    service = WeighbridgeService(db)
    record = service.get_latest_for_delivery(delivery_event_id=delivery_id)
    if record is None:
        return None
    if record.organization_id != actor.organization_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    return record
