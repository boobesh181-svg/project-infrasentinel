import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db, require_roles
from app.models.project import Project
from app.models.material_entry import MaterialEntry
from app.models.user import User, UserRole
from app.schemas.project import ProjectCreate, ProjectOut
from app.schemas.material_entry import MaterialEntryOut
from app.services.audit_service import AuditService

logger = logging.getLogger("infrasentinel")

router = APIRouter(prefix="/projects", tags=["projects"])


@router.post("", response_model=ProjectOut)
def create_project(
    payload: ProjectCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.ADMIN, UserRole.CREATOR)),
) -> ProjectOut:
    project = Project(
        organization_id=user.organization_id,
        created_by_id=user.id,
        name=payload.name,
        location=payload.location,
        reporting_period_start=payload.reporting_period_start,
        reporting_period_end=payload.reporting_period_end,
    )
    try:
        with db.begin():
            db.add(project)
            db.flush()
            AuditService(db).log(
                performed_by_id=user.id,
                entity_type="Project",
                entity_id=project.id,
                action="project_created",
                previous_state={},
                new_state={
                    "id": project.id,
                    "organization_id": project.organization_id,
                    "created_by_id": project.created_by_id,
                    "name": project.name,
                    "location": project.location,
                    "reporting_period_start": project.reporting_period_start.isoformat(),
                    "reporting_period_end": project.reporting_period_end.isoformat(),
                    "created_at": project.created_at.isoformat() if project.created_at else None,
                },
            )
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Project already exists",
        ) from exc
    return project

@router.get("", response_model=list[ProjectOut])
def list_projects(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    limit: int = Query(50, ge=1),
    offset: int = Query(0, ge=0),
) -> list[ProjectOut]:
    stmt = (
        select(Project)
        .where(Project.organization_id == user.organization_id)
        .limit(limit)
        .offset(offset)
    )
    return list(db.execute(stmt).scalars().all())


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(
    project_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ProjectOut:
    project = db.get(Project, project_id)
    if project is None:
        exists = db.get(Project, project_id) is not None
        logger.warning(
            "404 resource not found",
            extra={
                "resource": "project",
                "requested_id": str(project_id),
                "user_id": str(user.id),
                "user_email": user.email,
                "user_org": str(user.organization_id),
                "db_exists": exists,
                "org_mismatch": False,
            },
        )
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    if project.organization_id != user.organization_id:
        logger.warning(
            "ORG_MISMATCH",
            extra={
                "resource": "project",
                "requested_id": str(project_id),
                "user_id": str(user.id),
                "user_email": user.email,
                "user_org": str(user.organization_id),
                "db_exists": True,
                "org_mismatch": True,
            },
        )
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    return project


@router.get("/{project_id}/material-entries", response_model=list[MaterialEntryOut])
def list_project_entries(
    project_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    limit: int = Query(50, ge=1),
    offset: int = Query(0, ge=0),
) -> list[MaterialEntryOut]:
    project = db.get(Project, project_id)
    if project is None:
        exists = db.get(Project, project_id) is not None
        logger.warning(
            "404 resource not found",
            extra={
                "resource": "project",
                "requested_id": str(project_id),
                "user_id": str(user.id),
                "user_email": user.email,
                "user_org": str(user.organization_id),
                "db_exists": exists,
                "org_mismatch": False,
            },
        )
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    if project.organization_id != user.organization_id:
        logger.warning(
            "ORG_MISMATCH",
            extra={
                "resource": "project",
                "requested_id": str(project_id),
                "user_id": str(user.id),
                "user_email": user.email,
                "user_org": str(user.organization_id),
                "db_exists": True,
                "org_mismatch": True,
            },
        )
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    stmt = (
        select(MaterialEntry)
        .where(MaterialEntry.project_id == project_id)
        .limit(limit)
        .offset(offset)
    )
    return list(db.execute(stmt).scalars().all())
