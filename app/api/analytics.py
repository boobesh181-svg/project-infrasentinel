from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db
from app.models.bim_material_estimate import BIMMaterialEstimate
from app.models.entry_risk_score import EntryRiskScore, RiskLevel
from app.models.material_entry import MaterialEntry
from app.models.project import Project
from app.models.user import User
from app.schemas.analytics import (
    EmissionsByMaterialOut,
    EmissionsByProjectOut,
    EmissionsByTimeOut,
)
from app.schemas.bim import BIMDiscrepancyOut
from app.services.acknowledgement_service import AcknowledgementService
from app.services.bim_validation_service import BIMValidationService

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/emissions-by-project", response_model=list[EmissionsByProjectOut])
def emissions_by_project(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[EmissionsByProjectOut]:
    stmt = (
        select(
            Project.id,
            Project.name,
            func.coalesce(func.sum(MaterialEntry.calculated_emission), 0.0),
        )
        .join(MaterialEntry, MaterialEntry.project_id == Project.id)
        .where(Project.organization_id == user.organization_id)
        .group_by(Project.id, Project.name)
        .order_by(Project.name.asc())
    )
    rows = db.execute(stmt).all()
    return [
        EmissionsByProjectOut(
            project_id=str(project_id),
            project_name=project_name,
            emissions=float(emissions),
        )
        for project_id, project_name, emissions in rows
    ]


@router.get("/emissions-by-material", response_model=list[EmissionsByMaterialOut])
def emissions_by_material(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[EmissionsByMaterialOut]:
    stmt = (
        select(
            MaterialEntry.material_name,
            func.coalesce(func.sum(MaterialEntry.calculated_emission), 0.0),
        )
        .join(Project, Project.id == MaterialEntry.project_id)
        .where(Project.organization_id == user.organization_id)
        .group_by(MaterialEntry.material_name)
        .order_by(MaterialEntry.material_name.asc())
    )
    rows = db.execute(stmt).all()
    return [
        EmissionsByMaterialOut(material_name=material_name, emissions=float(emissions))
        for material_name, emissions in rows
    ]


@router.get("/emissions-by-time", response_model=list[EmissionsByTimeOut])
def emissions_by_time(
    start_at: datetime | None = Query(default=None),
    end_at: datetime | None = Query(default=None),
    granularity: str = Query(default="month"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[EmissionsByTimeOut]:
    if granularity not in {"day", "week", "month"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="granularity must be one of: day, week, month",
        )

    period_expr = func.date_trunc(granularity, MaterialEntry.created_at)
    stmt = (
        select(period_expr.label("period_start"), func.coalesce(func.sum(MaterialEntry.calculated_emission), 0.0))
        .join(Project, Project.id == MaterialEntry.project_id)
        .where(Project.organization_id == user.organization_id)
    )

    if start_at is not None:
        stmt = stmt.where(MaterialEntry.created_at >= start_at)
    if end_at is not None:
        stmt = stmt.where(MaterialEntry.created_at <= end_at)

    stmt = stmt.group_by(period_expr).order_by(period_expr.asc())

    rows = db.execute(stmt).all()
    return [
        EmissionsByTimeOut(period_start=period_start, emissions=float(emissions))
        for period_start, emissions in rows
    ]


@router.get("/bim-discrepancies", response_model=list[BIMDiscrepancyOut])
def bim_discrepancies(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[BIMDiscrepancyOut]:
    projects = db.execute(
        select(Project)
        .where(Project.organization_id == user.organization_id)
        .order_by(Project.created_at.desc())
    ).scalars().all()

    service = BIMValidationService(db)
    output: list[BIMDiscrepancyOut] = []
    for project in projects:
        flagged = service.validate_project(project_id=project.id)
        for item in flagged:
            output.append(
                BIMDiscrepancyOut(
                    project_id=project.id,
                    project_name=project.name,
                    material_type=str(item["material_type"]),
                    estimated_quantity=float(item["estimated_quantity"]),
                    reported_quantity=float(item["reported_quantity"]),
                    discrepancy_ratio=float(item["discrepancy_ratio"]),
                )
            )

    db.flush()
    return output


@router.get("/anti-corruption-summary", response_model=dict[str, int])
def anti_corruption_summary(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, int]:
    high_risk_entries = int(
        db.execute(
            select(func.count(EntryRiskScore.id))
            .join(MaterialEntry, MaterialEntry.id == EntryRiskScore.entry_id)
            .join(Project, Project.id == MaterialEntry.project_id)
            .where(
                Project.organization_id == user.organization_id,
                EntryRiskScore.risk_level == RiskLevel.HIGH,
            )
        ).scalar_one()
    )

    pending_supplier = AcknowledgementService(db).count_pending_supplier_confirmation(
        organization_id=user.organization_id
    )

    projects_with_bim_discrepancies = int(
        db.execute(
            select(func.count(func.distinct(Project.id)))
            .join(BIMMaterialEstimate, BIMMaterialEstimate.project_id == Project.id)
            .where(Project.organization_id == user.organization_id)
        ).scalar_one()
    )

    return {
        "high_risk_entries": high_risk_entries,
        "projects_with_bim_discrepancies": projects_with_bim_discrepancies,
        "entries_pending_supplier_confirmation": pending_supplier,
    }
