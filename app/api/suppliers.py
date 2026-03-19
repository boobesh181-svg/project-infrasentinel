from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db, require_roles
from app.models.supplier import Supplier
from app.models.user import User, UserRole
from app.schemas.supplier import SupplierCreate, SupplierOut
from app.services.verification_audit_service import VerificationAuditService

router = APIRouter(prefix="/suppliers", tags=["suppliers"])


@router.post("", response_model=SupplierOut)
def create_supplier(
    payload: SupplierCreate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_roles(UserRole.ADMIN, UserRole.CONTRACTOR_MANAGER)),
) -> SupplierOut:
    exists = db.execute(
        select(Supplier).where(
            Supplier.organization_id == actor.organization_id,
            Supplier.name == payload.name,
        )
    ).scalar_one_or_none()
    if exists is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Supplier already exists")

    supplier = Supplier(
        organization_id=actor.organization_id,
        name=payload.name,
        country=payload.country,
        contact_email=payload.contact_email,
        status="ACTIVE",
        created_by=actor.id,
    )
    db.add(supplier)
    db.flush()
    VerificationAuditService(db).log(
        organization_id=actor.organization_id,
        entity_type="supplier",
        entity_id=supplier.id,
        action="CREATE_SUPPLIER",
        user_id=actor.id,
        before_state={},
        after_state={"name": supplier.name, "status": supplier.status},
    )
    db.commit()
    return supplier


@router.get("", response_model=list[SupplierOut])
def list_suppliers(
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
    limit: int = Query(100, ge=1),
    offset: int = Query(0, ge=0),
) -> list[SupplierOut]:
    stmt = (
        select(Supplier)
        .where(Supplier.organization_id == actor.organization_id)
        .order_by(Supplier.name.asc())
        .limit(limit)
        .offset(offset)
    )
    return list(db.execute(stmt).scalars().all())
