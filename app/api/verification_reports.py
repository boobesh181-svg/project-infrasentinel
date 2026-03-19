from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.report import ReportGenerateRequest, ReportOut
from app.services.report_generation_service import ReportGenerationService

router = APIRouter(prefix="/reports", tags=["reports"])


@router.post("/generate", response_model=ReportOut)
def generate_report(
    payload: ReportGenerateRequest,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
) -> ReportOut:
    service = ReportGenerationService(db)
    report = service.generate(
        actor=actor,
        project_id=payload.project_id,
        period_start=payload.report_period_start,
        period_end=payload.report_period_end,
        format=payload.format,
    )
    db.commit()
    return report
