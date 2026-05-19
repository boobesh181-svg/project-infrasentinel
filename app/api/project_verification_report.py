import logging
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db
from app.models.user import User
from app.services.report_service import VerificationReportService

logger = logging.getLogger("infrasentinel")

router = APIRouter(prefix="/projects", tags=["verification-report"])


@router.get("/{project_id}/verification-report")
def generate_verification_report(
    project_id: UUID,
    format: Literal["pdf", "json"] = Query("pdf"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    service = VerificationReportService(session=db, user=user)
    bundle = service.generate_project_report(project_id=project_id)

    if format == "json":
        return JSONResponse(content=bundle["json"])

    file_name = f"verification_report_{project_id}.pdf"
    logger.info(
        "Verification report PDF download project_id=%s user_id=%s",
        str(project_id),
        str(user.id),
    )
    return StreamingResponse(
        iter([bundle["pdf_bytes"]]),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={file_name}"},
    )
