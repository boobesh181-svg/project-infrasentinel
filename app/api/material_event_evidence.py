from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db
from app.models.material_event import MaterialEvent
from app.models.material_event_evidence import MaterialEventEvidence
from app.models.material_entry import MaterialStatus
from app.models.user import User
from app.schemas.material_event_evidence import (
    MaterialEventEvidenceCreate,
    MaterialEventEvidenceListOut,
    MaterialEventEvidenceOut,
)
from app.services.verification_audit_service import VerificationAuditService

router = APIRouter(prefix="/material-events/{event_id}/evidence", tags=["evidence"])

_ALLOWED_TYPES = {"invoice", "delivery_note", "photo", "supplier_certificate", "transport_document"}


@router.post("", response_model=MaterialEventEvidenceOut)
def create_material_event_evidence(
    event_id: UUID,
    payload: MaterialEventEvidenceCreate,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
) -> MaterialEventEvidenceOut:
    event = db.get(MaterialEvent, event_id)
    if event is None or event.organization_id != actor.organization_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Material event not found")
    if event.status == MaterialStatus.LOCKED:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Locked events cannot be modified")
    if payload.evidence_type not in _ALLOWED_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported evidence_type")

    record = MaterialEventEvidence(
        organization_id=actor.organization_id,
        material_event_id=event.id,
        file_url=payload.file_url,
        file_hash=payload.file_hash,
        file_type=payload.file_type,
        evidence_type=payload.evidence_type,
        created_by=actor.id,
        status="ACTIVE",
    )
    db.add(record)
    db.flush()

    VerificationAuditService(db).log(
        organization_id=actor.organization_id,
        entity_type="material_event_evidence",
        entity_id=record.id,
        action="UPLOAD_EVIDENCE",
        user_id=actor.id,
        before_state={},
        after_state={
            "material_event_id": str(record.material_event_id),
            "file_hash": record.file_hash,
            "evidence_type": record.evidence_type,
        },
    )
    db.commit()
    return record


@router.get("", response_model=MaterialEventEvidenceListOut)
def list_material_event_evidence(
    event_id: UUID,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
    limit: int = Query(50, ge=1),
    offset: int = Query(0, ge=0),
) -> MaterialEventEvidenceListOut:
    event = db.get(MaterialEvent, event_id)
    if event is None or event.organization_id != actor.organization_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Material event not found")

    items_stmt = (
        select(MaterialEventEvidence)
        .where(
            MaterialEventEvidence.organization_id == actor.organization_id,
            MaterialEventEvidence.material_event_id == event_id,
        )
        .order_by(MaterialEventEvidence.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    count_stmt = select(func.count(MaterialEventEvidence.id)).where(
        MaterialEventEvidence.organization_id == actor.organization_id,
        MaterialEventEvidence.material_event_id == event_id,
    )
    return MaterialEventEvidenceListOut(
        total=int(db.execute(count_stmt).scalar_one()),
        items=list(db.execute(items_stmt).scalars().all()),
    )
