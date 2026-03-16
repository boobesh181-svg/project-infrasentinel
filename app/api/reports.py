from uuid import UUID

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.mrv_report import MRVReportGenerate, MRVReportOut
from app.services.report_service import ReportService

router = APIRouter(prefix="/mrv-reports", tags=["mrv-reports"])


@router.post("/generate", response_model=MRVReportOut)
def generate_report(
    payload: MRVReportGenerate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> MRVReportOut:
    service = ReportService(db)
    return service.generate_project_report(
        project_id=payload.project_id,
        period_start=payload.report_period_start,
        period_end=payload.report_period_end,
        user=user,
    )


@router.get("/{report_id}", response_model=MRVReportOut)
def get_report(
    report_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> MRVReportOut:
    service = ReportService(db)
    return service.get_report(report_id=report_id, user=user)


@router.get("/{report_id}/export")
def export_report(
    report_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> StreamingResponse:
    service = ReportService(db)
    bundle = service.export_report(report_id=report_id, user=user)
    filename = f"mrv_report_{report_id}.zip"
    return StreamingResponse(
        iter([bundle]),
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
