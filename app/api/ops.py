from datetime import datetime, timezone
from typing import Generator
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.core.config import get_settings
import redis
import json
from app.models.delivery_event import DeliveryEvent
from app.models.evidence_asset import EvidenceAsset
from app.models.verification_result import VerificationResult
from app.schemas.delivery_event import (
    DeliveryEventIn,
    DeliveryEventOut,
    VerifyActionIn,
)
from fastapi import WebSocket, WebSocketDisconnect
import asyncio
from app.core.config import get_settings
import redis
import json

router = APIRouter(prefix="/ops", tags=["ops"])


def publish_ops_event(payload: dict) -> None:
    try:
        settings = get_settings()
        r = redis.from_url(settings.redis_url)
        payload = {
            **payload,
            "created_at": payload.get("created_at") or datetime.now(timezone.utc).isoformat(),
        }
        r.publish("ops:events", json.dumps(payload))
    except Exception:
        pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/ingest", response_model=DeliveryEventOut)
def ingest_event(payload: DeliveryEventIn, db: Session = Depends(get_db)):
    evt = DeliveryEvent(
        site_id=payload.site_id,
        camera_id=payload.camera_id,
        vehicle_plate=payload.vehicle_plate,
        supplier=payload.supplier,
        expected_quantity=payload.expected_quantity,
        gps_lat=payload.gps_lat,
        gps_lng=payload.gps_lng,
        occurred_at=payload.occurred_at,
        state="DETECTED",
    )
    db.add(evt)
    db.commit()
    db.refresh(evt)
    # publish to Redis ingest queue for processors/workers
    try:
        settings = get_settings()
        r = redis.from_url(settings.redis_url)
        msg = {
            "delivery_id": str(evt.id),
            "site_id": str(evt.site_id),
            "vehicle_plate": evt.vehicle_plate,
            "supplier": evt.supplier,
            "occurred_at": evt.occurred_at.isoformat(),
        }
        r.lpush("ingest:queue", json.dumps(msg))
    except Exception:
        # non-fatal for demo — worker may be absent
        pass

    publish_ops_event(
        {
            "type": "delivery_state",
            "phase": "detected",
            "state": "DETECTED",
            "delivery_id": str(evt.id),
            "site_id": str(evt.site_id),
            "vehicle_plate": evt.vehicle_plate,
            "supplier": evt.supplier,
            "confidence": evt.confidence,
            "reasoning": "Delivery arrival detected at the site boundary.",
        }
    )

    return evt


@router.get("/sites")
def list_sites(db: Session = Depends(get_db)):
    # Minimal stub: return distinct site ids and counts
    rows = db.query(DeliveryEvent.site_id).all()
    sites = {}
    for (site_id,) in rows:
        sites[str(site_id)] = sites.get(str(site_id), 0) + 1
    return {"sites": sites}


@router.get("/site/{site_id}/queue")
def site_queue(
    site_id: UUID,
    vehicle_plate: str | None = Query(None),
    state: str | None = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(DeliveryEvent).filter(DeliveryEvent.site_id == site_id)
    if vehicle_plate:
        q = q.filter(DeliveryEvent.vehicle_plate.ilike(f"%{vehicle_plate}%"))
    if state:
        q = q.filter(DeliveryEvent.state == state)
    items = q.order_by(DeliveryEvent.occurred_at.desc()).limit(200).all()
    # Minimal paging structure
    return {"total": len(items), "items": items}


@router.get("/delivery/{delivery_id}", response_model=DeliveryEventOut)
def get_delivery(delivery_id: UUID, db: Session = Depends(get_db)):
    evt = db.query(DeliveryEvent).filter(DeliveryEvent.id == delivery_id).one_or_none()
    if not evt:
        raise HTTPException(status_code=404, detail="delivery not found")
    return evt


@router.post("/delivery/{delivery_id}/verify")
def operator_verify(delivery_id: UUID, action: VerifyActionIn, db: Session = Depends(get_db)):
    evt = db.query(DeliveryEvent).filter(DeliveryEvent.id == delivery_id).one_or_none()
    if not evt:
        raise HTTPException(status_code=404, detail="delivery not found")

    normalized_action = action.action.upper()
    state_map = {
        "CONFIRM": "RESOLVED",
        "REVIEW": "FLAGGED",
        "ESCALATE": "ESCALATED",
    }
    confidence_map = {
        "CONFIRM": 1.0,
        "REVIEW": 0.45,
        "ESCALATE": 0.1,
    }
    next_state = state_map.get(normalized_action, "FLAGGED")

    # Create a VerificationResult representing the operator action
    vr = VerificationResult(
        delivery_event_id=evt.id,
        analyzer=f"operator:{action.action}",
        confidence=confidence_map.get(normalized_action, 0.0),
        reasoning=action.notes or f"Operator action recorded: {normalized_action}",
    )
    evt.state = next_state
    db.add(vr)
    db.add(evt)
    db.commit()
    db.refresh(evt)
    # publish operator action to ops stream
    publish_ops_event(
        {
            "type": "operator_action",
            "phase": next_state.lower(),
            "state": next_state,
            "delivery_id": str(evt.id),
            "site_id": str(evt.site_id),
            "action": normalized_action,
            "notes": action.notes,
            "confidence": vr.confidence,
            "reasoning": vr.reasoning,
        }
    )
    return {"status": "ok", "delivery_id": str(evt.id), "state": evt.state}



@router.websocket("/stream/ops")
async def ops_stream(websocket: WebSocket):
    await websocket.accept()
    settings = get_settings()
    r = redis.from_url(settings.redis_url)
    pubsub = r.pubsub()
    pubsub.subscribe("ops:events")
    try:
        while True:
            message = pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
            if message:
                data = message.get("data")
                if isinstance(data, (bytes, bytearray)):
                    try:
                        await websocket.send_text(data.decode("utf-8"))
                    except Exception:
                        break
            try:
                # check for client ping messages
                pkt = await asyncio.wait_for(websocket.receive_text(), timeout=0.1)
                if pkt == "ping":
                    await websocket.send_text("pong")
            except asyncio.TimeoutError:
                continue
    except WebSocketDisconnect:
        pubsub.unsubscribe("ops:events")
    finally:
        try:
            pubsub.unsubscribe("ops:events")
        except Exception:
            pass
