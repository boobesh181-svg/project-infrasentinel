import logging

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.dependencies import get_current_user, require_roles
from app.models.user import User, UserRole
from app.schemas.analysis import (
    AnomalyAnalysisOut,
    AnomalyAnalysisRequest,
    AnomalyTrainingOut,
    AnomalyTrainingRequest,
)
from app.services.anomaly_service import detect_anomalies, train_anomaly_model

router = APIRouter(prefix="/analysis", tags=["analysis"])
logger = logging.getLogger("infrasentinel")


@router.post("/anomaly", response_model=AnomalyAnalysisOut)
def analyze_material_anomaly(
    payload: AnomalyAnalysisRequest,
    _actor: User = Depends(get_current_user),
) -> AnomalyAnalysisOut:
    try:
        result = detect_anomalies([material.dict() for material in payload.materials])
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return AnomalyAnalysisOut(**result)


@router.post("/anomaly/train", response_model=AnomalyTrainingOut)
def train_material_anomaly(
    payload: AnomalyTrainingRequest,
    _actor: User = Depends(require_roles(UserRole.ADMIN)),
) -> AnomalyTrainingOut:
    logger.warning("/analysis/anomaly/train is a legacy compatibility endpoint; prefer /ai/train")
    try:
        normalized_dataset = [item.dict() for item in payload.dataset]
        result = train_anomaly_model(normalized_dataset)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return AnomalyTrainingOut(**result)
