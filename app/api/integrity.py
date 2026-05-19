import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db
from app.models.project import Project
from app.models.user import User
from app.schemas.integrity import IntegrityScoreOut
from app.services.integrity_service import IntegrityScoringService

logger = logging.getLogger("infrasentinel")

router = APIRouter(prefix="/projects", tags=["integrity"])


@router.get("/{project_id}/integrity-score", response_model=IntegrityScoreOut)
def get_project_integrity_score(
    project_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> IntegrityScoreOut:
    project = db.get(Project, project_id)
    if project is None:
        logger.warning(
            "Project not found for integrity scoring project_id=%s user_id=%s",
            str(project_id),
            str(user.id),
        )
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    if project.organization_id != user.organization_id:
        logger.warning(
            "Forbidden integrity scoring access project_id=%s user_id=%s user_org=%s project_org=%s",
            str(project_id),
            str(user.id),
            str(user.organization_id),
            str(project.organization_id),
        )
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    scoring = IntegrityScoringService(db)
    result = scoring.calculate_project_score(project_id=project_id)
    return IntegrityScoreOut(**result)
