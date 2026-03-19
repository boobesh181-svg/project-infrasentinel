from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db, require_roles
from app.models.user import User, UserRole
from app.schemas.acknowledgement import (
    EvidenceAcknowledgeIn,
    EvidenceAcknowledgementListOut,
    EvidenceAcknowledgementOut,
    SupplierConfirmationIn,
)
from app.schemas.risk import EntryRiskOut, HighRiskEntryOut
from app.services.acknowledgement_service import AcknowledgementService
from app.services.audit_selection_service import AuditSelectionService
from app.services.risk_engine_service import RiskEngineService

router = APIRouter(tags=["anti-corruption"])


@router.post("/entries/{entry_id}/acknowledge", response_model=EvidenceAcknowledgementOut)
def acknowledge_entry_evidence(
    entry_id: UUID,
    payload: EvidenceAcknowledgeIn,
    db: Session = Depends(get_db),
    actor: User = Depends(require_roles(UserRole.VERIFIER, UserRole.AUDITOR, UserRole.SUPPLIER)),
) -> EvidenceAcknowledgementOut:
    service = AcknowledgementService(db)
    try:
        return service.acknowledge(entry_id=entry_id, actor=actor, comment=payload.comment)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.post("/entries/{entry_id}/dispute", response_model=EvidenceAcknowledgementOut)
def dispute_entry_evidence(
    entry_id: UUID,
    payload: EvidenceAcknowledgeIn,
    db: Session = Depends(get_db),
    actor: User = Depends(require_roles(UserRole.VERIFIER, UserRole.AUDITOR, UserRole.SUPPLIER)),
) -> EvidenceAcknowledgementOut:
    service = AcknowledgementService(db)
    try:
        return service.dispute(entry_id=entry_id, actor=actor, comment=payload.comment)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.get("/entries/{entry_id}/acknowledgements", response_model=EvidenceAcknowledgementListOut)
def list_entry_acknowledgements(
    entry_id: UUID,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
) -> EvidenceAcknowledgementListOut:
    service = AcknowledgementService(db)
    try:
        items = service.list_for_entry(entry_id=entry_id, actor=actor)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return EvidenceAcknowledgementListOut(total=len(items), items=items)


@router.post("/supplier/confirm-delivery", response_model=EvidenceAcknowledgementOut)
def supplier_confirm_delivery(
    payload: SupplierConfirmationIn,
    db: Session = Depends(get_db),
    actor: User = Depends(require_roles(UserRole.SUPPLIER)),
) -> EvidenceAcknowledgementOut:
    service = AcknowledgementService(db)
    try:
        return service.supplier_confirm_delivery(
            entry_id=payload.entry_id,
            actor=actor,
            confirmation_status=payload.confirmation_status,
            comment=payload.comment,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.get("/entries/{entry_id}/risk", response_model=EntryRiskOut)
def get_entry_risk(
    entry_id: UUID,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
) -> EntryRiskOut:
    record = RiskEngineService(db).calculate_risk(entry_id=entry_id, actor=actor)
    db.commit()
    return EntryRiskOut(
        entry_id=record.entry_id,
        risk_score=int(record.risk_score),
        risk_level=record.risk_level,
        reasons=list(record.reasons or []),
        generated_at=record.generated_at,
    )


@router.get("/entries/high-risk", response_model=list[HighRiskEntryOut])
def list_high_risk_entries(
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
) -> list[HighRiskEntryOut]:
    high_risk = RiskEngineService(db).list_high_risk(actor=actor)
    db.commit()
    return [
        HighRiskEntryOut(
            entry_id=entry.id,
            project_id=entry.project_id,
            material_name=entry.material_name,
            status=entry.status.value,
            risk_score=int(score.risk_score),
            risk_level=score.risk_level,
            reasons=list(score.reasons or []),
            generated_at=score.generated_at,
        )
        for entry, score in high_risk
    ]


@router.post("/entries/audit-selection/run", response_model=list[str])
def run_audit_selection(
    db: Session = Depends(get_db),
    actor: User = Depends(require_roles(UserRole.ADMIN)),
) -> list[str]:
    selected = AuditSelectionService(db).select_random_audits(organization_id=actor.organization_id)
    db.commit()
    return [str(entry_id) for entry_id in selected]
