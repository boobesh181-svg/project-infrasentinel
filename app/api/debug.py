from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_roles
from app.models.evidence_file import EvidenceFile
from app.models.material_entry import MaterialEntry
from app.models.project import Project
from app.models.user import UserRole

router = APIRouter(prefix="/debug", tags=["debug"])


@router.get("/resource/{resource_id}")
def debug_resource(
    resource_id: UUID,
    db: Session = Depends(get_db),
    _: object = Depends(require_roles(UserRole.ADMIN)),
) -> dict[str, bool]:
    return {
        "projects": db.get(Project, resource_id) is not None,
        "material_entries": db.get(MaterialEntry, resource_id) is not None,
        "evidence_files": db.get(EvidenceFile, resource_id) is not None,
    }
