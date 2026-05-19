import logging

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db
from app.models.material_entry import MaterialEntry, MaterialStatus
from app.models.project import Project
from app.models.user import User
from app.schemas.dashboard import (
    DashboardAnomaliesOut,
    DashboardAnomalyItemOut,
    DashboardEmissionItemOut,
    DashboardEmissionsOut,
    DashboardSummaryMetricsOut,
    DashboardSummaryOut,
    IntegrityScoreItemOut,
    PaginationMeta,
)
from app.services.integrity_service import IntegrityScoringService

logger = logging.getLogger("infrasentinel")

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummaryOut)
def dashboard_summary(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    limit: int = Query(10, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> DashboardSummaryOut:
    project_count_stmt = select(func.count(Project.id)).where(
        Project.organization_id == user.organization_id
    )
    number_of_projects = int(db.execute(project_count_stmt).scalar_one() or 0)

    verified_emissions_stmt = (
        select(func.coalesce(func.sum(MaterialEntry.calculated_emission), 0.0))
        .join(Project, Project.id == MaterialEntry.project_id)
        .where(
            Project.organization_id == user.organization_id,
            MaterialEntry.status.in_([
                MaterialStatus.VERIFIED,
                MaterialStatus.APPROVED,
                MaterialStatus.LOCKED,
            ]),
        )
    )
    total_emissions_verified = float(db.execute(verified_emissions_stmt).scalar_one() or 0.0)

    anomalies_stmt = (
        select(func.count(MaterialEntry.id))
        .join(Project, Project.id == MaterialEntry.project_id)
        .where(
            Project.organization_id == user.organization_id,
            (
                MaterialEntry.temporal_anomaly.is_(True)
                | MaterialEntry.audit_required.is_(True)
                | (func.coalesce(MaterialEntry.ai_risk_score, 0.0) > 0.6)
            ),
        )
    )
    anomalies_detected = int(db.execute(anomalies_stmt).scalar_one() or 0)

    projects_stmt = (
        select(Project.id, Project.name)
        .where(Project.organization_id == user.organization_id)
        .order_by(Project.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    projects = db.execute(projects_stmt).all()

    integrity_service = IntegrityScoringService(db)
    integrity_scores: list[IntegrityScoreItemOut] = []
    for project_id, project_name in projects:
        score = integrity_service.calculate_project_score(project_id=project_id)
        breakdown = score["breakdown"]
        integrity_scores.append(
            IntegrityScoreItemOut(
                project_id=project_id,
                project_name=project_name,
                integrity_score=int(score["integrity_score"]),
                material_verification=int(breakdown["material_verification"]),
                emission_accuracy=int(breakdown["emission_accuracy"]),
                anomaly_risk=int(breakdown["anomaly_risk"]),
                evidence_completeness=int(breakdown["evidence_completeness"]),
            )
        )

    logger.info(
        "Dashboard summary generated user_id=%s org_id=%s projects=%s limit=%s offset=%s",
        str(user.id),
        str(user.organization_id),
        number_of_projects,
        limit,
        offset,
    )
    return DashboardSummaryOut(
        metrics=DashboardSummaryMetricsOut(
            number_of_projects=number_of_projects,
            total_emissions_verified=round(total_emissions_verified, 4),
            anomalies_detected=anomalies_detected,
        ),
        integrity_scores=integrity_scores,
        pagination=PaginationMeta(total=number_of_projects, limit=limit, offset=offset),
    )


@router.get("/emissions", response_model=DashboardEmissionsOut)
def dashboard_emissions(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    limit: int = Query(20, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> DashboardEmissionsOut:
    total_projects = int(
        db.execute(
            select(func.count(Project.id)).where(Project.organization_id == user.organization_id)
        ).scalar_one()
        or 0
    )

    stmt = (
        select(
            Project.id,
            Project.name,
            func.count(MaterialEntry.id),
            func.coalesce(func.sum(MaterialEntry.calculated_emission), 0.0),
            func.coalesce(func.avg(MaterialEntry.calculated_emission), 0.0),
        )
        .join(MaterialEntry, MaterialEntry.project_id == Project.id, isouter=True)
        .where(
            Project.organization_id == user.organization_id,
            (
                MaterialEntry.id.is_(None)
                | MaterialEntry.status.in_([
                    MaterialStatus.VERIFIED,
                    MaterialStatus.APPROVED,
                    MaterialStatus.LOCKED,
                ])
            ),
        )
        .group_by(Project.id, Project.name)
        .order_by(Project.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    rows = db.execute(stmt).all()
    items = [
        DashboardEmissionItemOut(
            project_id=project_id,
            project_name=project_name,
            verified_entries=int(verified_entries or 0),
            total_verified_emissions=round(float(total_verified_emissions or 0.0), 4),
            average_verified_emission=round(float(avg_verified_emission or 0.0), 4),
        )
        for project_id, project_name, verified_entries, total_verified_emissions, avg_verified_emission in rows
    ]

    logger.info(
        "Dashboard emissions generated user_id=%s org_id=%s rows=%s limit=%s offset=%s",
        str(user.id),
        str(user.organization_id),
        len(items),
        limit,
        offset,
    )
    return DashboardEmissionsOut(
        items=items,
        pagination=PaginationMeta(total=total_projects, limit=limit, offset=offset),
    )


@router.get("/anomalies", response_model=DashboardAnomaliesOut)
def dashboard_anomalies(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    limit: int = Query(20, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> DashboardAnomaliesOut:
    base_filter = (
        (MaterialEntry.temporal_anomaly.is_(True))
        | (MaterialEntry.audit_required.is_(True))
        | (func.coalesce(MaterialEntry.ai_risk_score, 0.0) > 0.6)
    )

    total_stmt = (
        select(func.count(MaterialEntry.id))
        .join(Project, Project.id == MaterialEntry.project_id)
        .where(Project.organization_id == user.organization_id, base_filter)
    )
    total = int(db.execute(total_stmt).scalar_one() or 0)

    stmt = (
        select(
            MaterialEntry.id,
            Project.id,
            Project.name,
            MaterialEntry.material_name,
            MaterialEntry.ai_risk_score,
            MaterialEntry.ai_risk_level,
            MaterialEntry.temporal_anomaly,
            MaterialEntry.audit_required,
            MaterialEntry.created_at,
        )
        .join(Project, Project.id == MaterialEntry.project_id)
        .where(Project.organization_id == user.organization_id, base_filter)
        .order_by(MaterialEntry.created_at.desc(), MaterialEntry.id.desc())
        .limit(limit)
        .offset(offset)
    )
    rows = db.execute(stmt).all()
    items = [
        DashboardAnomalyItemOut(
            material_entry_id=entry_id,
            project_id=project_id,
            project_name=project_name,
            material_name=material_name,
            ai_risk_score=float(ai_risk_score) if ai_risk_score is not None else None,
            ai_risk_level=ai_risk_level,
            temporal_anomaly=bool(temporal_anomaly),
            audit_required=bool(audit_required),
            created_at=created_at,
        )
        for (
            entry_id,
            project_id,
            project_name,
            material_name,
            ai_risk_score,
            ai_risk_level,
            temporal_anomaly,
            audit_required,
            created_at,
        ) in rows
    ]

    logger.info(
        "Dashboard anomalies generated user_id=%s org_id=%s total=%s limit=%s offset=%s",
        str(user.id),
        str(user.organization_id),
        total,
        limit,
        offset,
    )
    return DashboardAnomaliesOut(
        items=items,
        pagination=PaginationMeta(total=total, limit=limit, offset=offset),
    )
