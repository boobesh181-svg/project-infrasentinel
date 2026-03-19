from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db, require_roles
from app.models.material_entry import MaterialEntry
from app.models.project import Project
from app.models.user import User, UserRole
from app.models.audit_log import AuditLog
from app.schemas.audit import AuditLogListOut

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("/{entity_type}/{entity_id}", response_model=AuditLogListOut)
def list_audit_logs(
    entity_type: str,
    entity_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
    limit: int = Query(50, ge=1),
    offset: int = Query(0, ge=0),
) -> AuditLogListOut:
    items_stmt = (
        select(AuditLog)
        .where(AuditLog.entity_type == entity_type, AuditLog.entity_id == entity_id)
        .order_by(AuditLog.timestamp.asc())
        .limit(limit)
        .offset(offset)
    )
    count_stmt = select(func.count(AuditLog.id)).where(
        AuditLog.entity_type == entity_type,
        AuditLog.entity_id == entity_id,
    )
    return AuditLogListOut(
        total=int(db.execute(count_stmt).scalar_one()),
        items=list(db.execute(items_stmt).scalars().all()),
    )


@router.get("/material-entry/{entity_id}", response_model=AuditLogListOut)
def material_entry_timeline(
    entity_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    limit: int = Query(200, ge=1),
    offset: int = Query(0, ge=0),
) -> AuditLogListOut:
    entry = db.execute(
        select(MaterialEntry)
        .join(Project, Project.id == MaterialEntry.project_id)
        .where(MaterialEntry.id == entity_id, Project.organization_id == user.organization_id)
    ).scalar_one_or_none()
    if entry is None:
        raise HTTPException(status_code=404, detail="Material entry not found")

    items_stmt = (
        select(AuditLog)
        .where(AuditLog.entity_type == "MaterialEntry", AuditLog.entity_id == entity_id)
        .order_by(AuditLog.timestamp.asc())
        .limit(limit)
        .offset(offset)
    )
    count_stmt = select(func.count(AuditLog.id)).where(
        AuditLog.entity_type == "MaterialEntry",
        AuditLog.entity_id == entity_id,
    )
    return AuditLogListOut(
        total=int(db.execute(count_stmt).scalar_one()),
        items=list(db.execute(items_stmt).scalars().all()),
    )
