from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db, require_roles
from app.models.material_entry import MaterialEntry
from app.models.user import User, UserRole
from app.schemas.ai import AIMonitoringOut, AIModelStatusOut, AIRiskBreakdownOut, AITrainOut
from app.services.ai_risk_service import AIRiskService


router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/train", response_model=AITrainOut)
def train_ai_model(
    db: Session = Depends(get_db),
    _actor: User = Depends(require_roles(UserRole.ADMIN)),
) -> AITrainOut:
    try:
        metadata = AIRiskService(db).train_from_historical_entries()
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return AITrainOut(
        current_model=metadata.get("current_model"),
        algorithm=str(metadata.get("algorithm") or "IsolationForest"),
        trained_at=metadata.get("trained_at"),
        training_samples=int(metadata.get("training_samples") or 0),
        model_version=int(metadata.get("model_version") or 0),
    )


@router.post("/retrain", response_model=AITrainOut)
def retrain_ai_model(
    db: Session = Depends(get_db),
    _actor: User = Depends(require_roles(UserRole.ADMIN)),
) -> AITrainOut:
    return train_ai_model(db=db, _actor=_actor)


@router.get("/model-status", response_model=AIModelStatusOut)
def get_ai_model_status(
    db: Session = Depends(get_db),
    _actor: User = Depends(get_current_user),
) -> AIModelStatusOut:
    status_payload = AIRiskService(db).model_status()
    return AIModelStatusOut(**status_payload)


@router.get("/monitoring", response_model=AIMonitoringOut)
def get_ai_monitoring(
    db: Session = Depends(get_db),
    _actor: User = Depends(get_current_user),
) -> AIMonitoringOut:
    payload = AIRiskService(db).monitoring_snapshot()
    return AIMonitoringOut(**payload)


@router.post("/score/{entry_id}", response_model=AIRiskBreakdownOut)
def score_entry_with_unified_ai(
    entry_id: str,
    db: Session = Depends(get_db),
    _actor: User = Depends(get_current_user),
) -> AIRiskBreakdownOut:
    entry = db.get(MaterialEntry, entry_id)
    if entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Material entry not found")

    result = AIRiskService(db).calculate_risk(entry=entry)
    return AIRiskBreakdownOut(
        anomaly_score=result.anomaly_score,
        rule_score=result.rule_score,
        combined_score=result.combined_score,
        risk_level=result.risk_level,
        explanation=result.explanation,
        top_contributing_features=result.top_contributing_features,
        deviation_details=result.deviation_details,
        model_version=result.model_version,
    )


@router.post("/rollback", response_model=AITrainOut)
def rollback_ai_model(
    model_name: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
    _actor: User = Depends(require_roles(UserRole.ADMIN)),
) -> AITrainOut:
    try:
        metadata = AIRiskService(db).rollback_model(target_model=model_name)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return AITrainOut(
        current_model=metadata.get("current_model"),
        algorithm=str(metadata.get("algorithm") or "IsolationForest"),
        trained_at=metadata.get("trained_at"),
        training_samples=int(metadata.get("training_samples") or 0),
        model_version=int(metadata.get("model_version") or 0),
    )
