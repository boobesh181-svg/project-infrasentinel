from datetime import datetime, timezone
import hashlib
import logging
import re
import tempfile
from pathlib import Path
from typing import Generator
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile, status
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.core.config import get_settings
from app.core.observability import record_upload_size
from app.core.rate_limit import limiter
from app.models.delivery_event import DeliveryEvent
from app.models.evidence_asset import EvidenceAsset
from app.models.verification_result import VerificationResult
from app.services.delivery_verification_service import DeliveryVerificationService
from app.services.invoice_link_service import InvoiceLinkService
from app.schemas.delivery_event import (
    DeliveryEventIn,
    DeliveryEventOut,
    DeliveryDetectionIn,
    VerifyActionIn,
)
from app.storage import get_file_storage
from app.storage.base import FileStorage
from fastapi import WebSocket, WebSocketDisconnect
import asyncio
import redis
import json

logger = logging.getLogger("infrasentinel")

router = APIRouter(prefix="/ops", tags=["ops"])

_ALLOWED_TYPES = {
    "image/jpeg",
    "image/png",
}
_MAX_UPLOAD_BYTES = 10 * 1024 * 1024


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

    links = InvoiceLinkService(db).link_delivery_event(event=evt)
    if links:
        db.commit()
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


@router.post("/delivery/{delivery_id}/detect", response_model=DeliveryEventOut)
def detect_delivery(
    delivery_id: UUID,
    payload: DeliveryDetectionIn,
    db: Session = Depends(get_db),
):
    service = DeliveryVerificationService(db)
    try:
        event = service.record_detection(
            delivery_id=delivery_id,
            detected_plate=payload.detected_plate,
            detected_material_type=payload.detected_material_type,
            detected_quantity=payload.detected_quantity,
            detection_confidence=payload.detection_confidence,
            anpr_confidence=payload.anpr_confidence,
            timestamp=payload.timestamp,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    db.commit()
    db.refresh(event)

    publish_ops_event(
        {
            "type": "ai_detection",
            "phase": event.state.lower(),
            "state": event.state,
            "delivery_id": str(event.id),
            "site_id": str(event.site_id),
            "vehicle_plate": event.detected_plate or event.vehicle_plate,
            "supplier": event.supplier,
            "confidence": event.detection_confidence,
            "anpr_confidence": event.anpr_confidence,
            "suspicious_flags": event.suspicious_flags,
        }
    )

    return event


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


@router.post("/delivery/{delivery_id}/evidence")
@limiter.limit("10/minute")
async def upload_delivery_evidence(
    request: Request,
    delivery_id: UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    del request
    event = db.query(DeliveryEvent).filter(DeliveryEvent.id == delivery_id).one_or_none()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="delivery not found")

    if file.content_type not in _ALLOWED_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported or invalid evidence file type.",
        )

    if not _validate_file_signature(file):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported or invalid evidence file type.",
        )

    storage = get_file_storage()
    try:
        storage_path, file_hash, file_size, original_name = await _save_upload(
            file=file,
            storage=storage,
            max_bytes=_MAX_UPLOAD_BYTES,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    evidence = EvidenceAsset(
        delivery_event_id=event.id,
        file_name=original_name,
        file_type=file.content_type or "application/octet-stream",
        content_type=file.content_type or "application/octet-stream",
        file_size=file_size,
        file_hash=file_hash,
        storage_path=storage_path,
    )
    db.add(evidence)
    db.commit()

    publish_ops_event(
        {
            "type": "evidence_upload",
            "phase": "evidence",
            "state": event.state,
            "delivery_id": str(event.id),
            "site_id": str(event.site_id),
            "file_name": evidence.file_name,
            "file_hash": evidence.file_hash,
        }
    )

    return {"status": "ok", "evidence_id": str(evidence.id)}



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


async def _save_upload(*, file: UploadFile, storage: FileStorage, max_bytes: int) -> tuple[str, str, int, str]:
    original_name = _secure_filename(file.filename or "file")
    stored_key = f"delivery-evidence/{uuid4()}_{original_name}"
    hasher = hashlib.sha256()
    total = 0

    with tempfile.NamedTemporaryFile(delete=False) as tmp:
        tmp_path = Path(tmp.name)

    try:
        with tmp_path.open("wb") as handle:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                total += len(chunk)
                if total > max_bytes:
                    raise ValueError("File too large")
                hasher.update(chunk)
                handle.write(chunk)

        payload = tmp_path.read_bytes()
        uri = storage.save_bytes(
            key=stored_key,
            data=payload,
            content_type=file.content_type or "application/octet-stream",
        )
        record_upload_size(content_type=file.content_type or "application/octet-stream", size_bytes=total)
        return uri, hasher.hexdigest(), total, original_name
    finally:
        try:
            tmp_path.unlink(missing_ok=True)
        except Exception:
            logger.warning("Failed to clean temporary upload file: %s", str(tmp_path))
        await file.seek(0)


def _validate_file_signature(file: UploadFile) -> bool:
    header = file.file.read(8)
    filename = Path(file.filename or "").name.lower()
    try:
        if file.content_type == "image/jpeg":
            return header.startswith(b"\xFF\xD8\xFF")
        if file.content_type == "image/png":
            return header.startswith(b"\x89PNG\r\n\x1a\n")
        return filename.endswith(".jpg") or filename.endswith(".jpeg") or filename.endswith(".png")
    finally:
        try:
            file.file.seek(0)
        except Exception:
            pass


def _secure_filename(name: str) -> str:
    cleaned = Path(name).name.strip()
    if not cleaned:
        return "file"
    cleaned = re.sub(r"[^A-Za-z0-9._-]", "_", cleaned)
    return cleaned[:255]
