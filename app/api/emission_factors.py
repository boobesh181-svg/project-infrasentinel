from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db, require_roles
from app.models.emission_factor import EmissionFactor
from app.models.user import User, UserRole
from app.schemas.emission_factor import EmissionFactorCreate, EmissionFactorOut
from app.services.audit_service import AuditService

router = APIRouter(prefix="/emission-factors", tags=["emission-factors"])


@router.get("", response_model=list[EmissionFactorOut])
def list_emission_factors(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[EmissionFactorOut]:
    stmt = select(EmissionFactor).order_by(EmissionFactor.material_name.asc())
    return list(db.execute(stmt).scalars().all())


@router.post("", response_model=EmissionFactorOut)
def create_emission_factor(
    payload: EmissionFactorCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
) -> EmissionFactorOut:
    emission_factor = EmissionFactor(
        material_name=payload.material_name,
        factor_value=payload.factor_value,
        unit=payload.unit,
        source=payload.source,
        standard_name=payload.standard_name,
        region=payload.region,
        source_document_url=payload.source_document_url,
        methodology_reference=payload.methodology_reference,
        version=payload.version,
        valid_from=payload.valid_from,
        valid_to=payload.valid_to,
        is_active=payload.is_active,
    )
    with db.begin():
        db.add(emission_factor)
        db.flush()
        AuditService(db).log(
            performed_by_id=_.id,
            entity_type="EmissionFactor",
            entity_id=emission_factor.id,
            action="emission_factor_created",
            previous_state={},
            new_state={
                "id": emission_factor.id,
                "material_name": emission_factor.material_name,
                "factor_value": float(emission_factor.factor_value),
                "unit": emission_factor.unit,
                "source": emission_factor.source,
                "standard_name": emission_factor.standard_name,
                "region": emission_factor.region,
                "source_document_url": emission_factor.source_document_url,
                "methodology_reference": emission_factor.methodology_reference,
                "version": emission_factor.version,
                "valid_from": emission_factor.valid_from.isoformat(),
                "valid_to": emission_factor.valid_to.isoformat() if emission_factor.valid_to else None,
                "is_active": emission_factor.is_active,
                "created_at": emission_factor.created_at.isoformat() if emission_factor.created_at else None,
            },
        )
    return emission_factor
