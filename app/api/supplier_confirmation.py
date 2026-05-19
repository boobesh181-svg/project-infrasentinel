from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db, require_roles
from app.models.material_entry import MaterialEntry
from app.models.project import Project
from app.models.supplier_confirmation import SupplierConfirmation, SupplierConfirmationStatus
from app.models.user import User, UserRole
from app.schemas.supplier_confirmation import SupplierConfirmationActionIn, SupplierConfirmationOut
from app.services.supplier_confirmation_service import SupplierConfirmationService

router = APIRouter(tags=["supplier-confirmation"])


@router.post("/supplier-confirm/{entry_id}", response_model=SupplierConfirmationOut)
def supplier_confirm_entry(
    entry_id: UUID,
    payload: SupplierConfirmationActionIn,
    db: Session = Depends(get_db),
    actor: User = Depends(require_roles(UserRole.SUPPLIER)),
) -> SupplierConfirmationOut:
    if payload.status == SupplierConfirmationStatus.PENDING:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Status must be CONFIRMED or DISPUTED")

    confirmation = SupplierConfirmationService(db).update_confirmation(
        entry_id=entry_id,
        actor=actor,
        status_value=payload.status,
    )
    db.commit()
    db.refresh(confirmation)
    return confirmation


@router.get("/supplier-confirm/{entry_id}", response_model=SupplierConfirmationOut)
def get_supplier_confirmation(
    entry_id: UUID,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
) -> SupplierConfirmationOut:
    entry = db.execute(
        select(MaterialEntry)
        .join(Project, Project.id == MaterialEntry.project_id)
        .where(
            MaterialEntry.id == entry_id,
            Project.organization_id == actor.organization_id,
        )
    ).scalar_one_or_none()
    if entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Material entry not found")

    latest = db.execute(
        select(SupplierConfirmation)
        .where(SupplierConfirmation.entry_id == entry_id)
        .order_by(SupplierConfirmation.created_at.desc())
        .limit(1)
    ).scalar_one_or_none()
    if latest is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier confirmation not found")
    return latest
