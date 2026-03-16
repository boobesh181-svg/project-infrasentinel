from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_roles
from app.models.user import User, UserRole
from app.schemas.audit import AuditLogOut
from app.services.audit_service import AuditService

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("/{entity_type}/{entity_id}", response_model=list[AuditLogOut])
def list_audit_logs(
    entity_type: str,
    entity_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
) -> list[AuditLogOut]:
    service = AuditService(db)
    return service.list_by_entity(entity_type=entity_type, entity_id=entity_id)
