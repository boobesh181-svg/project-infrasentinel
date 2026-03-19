import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db, require_roles
from app.models.user import User, UserRole
from app.schemas.material_entry import MaterialEntryCreate, MaterialEntryOut
from app.models.material_entry import MaterialEntry
from app.services.audit_service import AuditService
from app.services.material_service import MaterialService
from app.services.workflow_service import WorkflowService

logger = logging.getLogger("infrasentinel")

router = APIRouter(prefix="/material-entries", tags=["material-entries"])


def _handle_transition_error(exc: ValueError, *, user: User, entry_id: UUID) -> None:
    detail = str(exc)
    lowered = detail.lower()
    if "not found" in lowered:
        logger.warning(
            "404 resource not found",
            extra={
                "resource": "material_entry",
                "requested_id": str(entry_id),
                "user_id": str(user.id),
                "user_email": user.email,
                "user_org": str(user.organization_id),
                "db_exists": False,
                "org_mismatch": False,
            },
        )
        status_code = status.HTTP_404_NOT_FOUND
    elif "verifier" in lowered or "notification_response_hours" in lowered:
        status_code = status.HTTP_400_BAD_REQUEST
    else:
        status_code = status.HTTP_409_CONFLICT
    raise HTTPException(status_code=status_code, detail=detail) from exc


@router.post("", response_model=MaterialEntryOut)
def create_material_entry(
    payload: MaterialEntryCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.CREATOR)),
) -> MaterialEntryOut:
    service = MaterialService(db)
    try:
        created = service.create_entry(
            project_id=payload.project_id,
            user_id=user.id,
            material_name=payload.material_name,
            quantity=payload.quantity,
            supplier_name=payload.supplier_name,
            supplier_email=payload.supplier_email,
            factor_version_snapshot=payload.factor_version_snapshot,
            factor_value_snapshot=payload.factor_value_snapshot,
            factor_unit_snapshot=payload.factor_unit_snapshot,
            factor_source_snapshot=payload.factor_source_snapshot,
        )
        with db.begin_nested():
            AuditService(db).log(
                performed_by_id=user.id,
                entity_type="MaterialEntry",
                entity_id=created.id,
                action="CREATE_ENTRY",
                previous_state={},
                new_state={"id": str(created.id), "status": created.status.value},
            )
        return created
    except ValueError as exc:
        _handle_transition_error(exc, user=user, entry_id=payload.project_id)


@router.get("/{entry_id}", response_model=MaterialEntryOut)
def get_material_entry(
    entry_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> MaterialEntryOut:
    entry = db.get(MaterialEntry, entry_id)
    if entry is None:
        exists = db.get(MaterialEntry, entry_id) is not None
        logger.warning(
            "404 resource not found",
            extra={
                "resource": "material_entry",
                "requested_id": str(entry_id),
                "user_id": str(user.id),
                "user_email": user.email,
                "user_org": str(user.organization_id),
                "db_exists": exists,
                "org_mismatch": False,
            },
        )
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    if entry.project.organization_id != user.organization_id:
        logger.warning(
            "ORG_MISMATCH",
            extra={
                "resource": "material_entry",
                "requested_id": str(entry_id),
                "user_id": str(user.id),
                "user_email": user.email,
                "user_org": str(user.organization_id),
                "db_exists": True,
                "org_mismatch": True,
            },
        )
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    return entry




@router.post("/{entry_id}/submit", response_model=MaterialEntryOut)
def submit_entry(
    entry_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.CREATOR)),
) -> MaterialEntryOut:
    service = WorkflowService(db)
    try:
        return service.submit(entry_id=entry_id, actor_user_id=user.id)
    except ValueError as exc:
        _handle_transition_error(exc, user=user, entry_id=entry_id)


@router.post("/{entry_id}/verify", response_model=MaterialEntryOut)
def verify_entry(
    entry_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.VERIFIER, UserRole.ADMIN, UserRole.AUDITOR)),
) -> MaterialEntryOut:
    service = WorkflowService(db)
    try:
        return service.verify(entry_id=entry_id, actor_user_id=user.id)
    except ValueError as exc:
        _handle_transition_error(exc, user=user, entry_id=entry_id)


@router.post("/{entry_id}/approve", response_model=MaterialEntryOut)
def approve_entry(
    entry_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.APPROVER)),
) -> MaterialEntryOut:
    service = WorkflowService(db)
    try:
        return service.approve(entry_id=entry_id, actor_user_id=user.id)
    except ValueError as exc:
        _handle_transition_error(exc, user=user, entry_id=entry_id)


@router.post("/{entry_id}/lock", response_model=MaterialEntryOut)
def lock_entry(
    entry_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.ADMIN)),
) -> MaterialEntryOut:
    service = WorkflowService(db)
    try:
        return service.lock(entry_id=entry_id, actor_user_id=user.id)
    except ValueError as exc:
        _handle_transition_error(exc, user=user, entry_id=entry_id)
