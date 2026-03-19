import logging
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db, require_roles
from app.models.project import Project
from app.models.bim_material_estimate import BIMMaterialEstimate
from app.models.bim_model import BIMFileFormat, BIMModel
from app.models.material_entry import MaterialEntry
from app.models.user import User, UserRole
from app.db.session import SessionLocal
from app.schemas.bim import BIMDiscrepancyOut, BIMModelUploadOut, ProjectBIMDiscrepancyOut, ProjectBIMEstimateOut
from app.schemas.project import ProjectCreate, ProjectMaterialEntryListOut, ProjectListOut, ProjectOut
from app.services.audit_service import AuditService
from app.services.bim_parser_service import BIMParserService
from app.services.bim_validation_service import BIMValidationService

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

@router.get("", response_model=ProjectListOut)
def list_projects(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    limit: int = Query(50, ge=1),
    offset: int = Query(0, ge=0),
) -> ProjectListOut:
    items_stmt = (
        select(Project)
        .where(Project.organization_id == user.organization_id)
        .limit(limit)
        .offset(offset)
    )
    count_stmt = select(func.count(Project.id)).where(Project.organization_id == user.organization_id)

    return ProjectListOut(
        total=int(db.execute(count_stmt).scalar_one()),
        items=list(db.execute(items_stmt).scalars().all()),
    )


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


@router.get("/{project_id}/material-entries", response_model=ProjectMaterialEntryListOut)
def list_project_entries(
    project_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    limit: int = Query(50, ge=1),
    offset: int = Query(0, ge=0),
) -> ProjectMaterialEntryListOut:
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

    items_stmt = (
        select(MaterialEntry)
        .where(MaterialEntry.project_id == project_id)
        .limit(limit)
        .offset(offset)
    )
    count_stmt = select(func.count(MaterialEntry.id)).where(MaterialEntry.project_id == project_id)
    return ProjectMaterialEntryListOut(
        total=int(db.execute(count_stmt).scalar_one()),
        items=list(db.execute(items_stmt).scalars().all()),
    )


@router.post("/{project_id}/upload-bim", response_model=BIMModelUploadOut)
def upload_bim_model(
    project_id: UUID,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.ADMIN, UserRole.CREATOR, UserRole.ESG_ANALYST)),
) -> BIMModelUploadOut:
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    if project.organization_id != user.organization_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    suffix = Path(file.filename or "").suffix.lower()
    format_map = {
        ".ifc": BIMFileFormat.IFC,
        ".rvt": BIMFileFormat.RVT,
        ".gltf": BIMFileFormat.GLTF,
    }
    file_format = format_map.get(suffix)
    if file_format is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported BIM file format")

    storage_dir = Path(__file__).resolve().parents[2] / "storage" / "bim"
    storage_dir.mkdir(parents=True, exist_ok=True)
    file_path = storage_dir / f"{project_id}_{Path(file.filename or 'model').name}"

    with file_path.open("wb") as out_file:
        while True:
            chunk = file.file.read(1024 * 1024)
            if not chunk:
                break
            out_file.write(chunk)

    model = BIMModel(
        project_id=project.id,
        file_path=str(file_path),
        file_format=file_format,
        uploaded_by=user.id,
    )
    db.add(model)
    db.flush()
    db.commit()

    if file_format == BIMFileFormat.IFC:
        background_tasks.add_task(_parse_ifc_and_store_estimates, project.id, str(file_path))

    return model


@router.post("/{project_id}/bim-upload", response_model=dict[str, str])
def upload_bim_model_minimal(
    project_id: UUID,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.ADMIN, UserRole.CREATOR, UserRole.ESG_ANALYST)),
) -> dict[str, str]:
    model = upload_bim_model(
        project_id=project_id,
        background_tasks=background_tasks,
        file=file,
        db=db,
        user=user,
    )
    return {"model_id": str(model.id)}


@router.get("/{project_id}/bim-estimates", response_model=list[ProjectBIMEstimateOut])
def get_project_bim_estimates(
    project_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[ProjectBIMEstimateOut]:
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    if project.organization_id != user.organization_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    summary = BIMValidationService(db).summarize_project(project_id=project_id)
    db.flush()
    return [ProjectBIMEstimateOut(**item) for item in summary]


@router.get("/{project_id}/bim-discrepancies", response_model=list[ProjectBIMDiscrepancyOut])
def get_project_bim_discrepancies(
    project_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[ProjectBIMDiscrepancyOut]:
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    if project.organization_id != user.organization_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    flagged = BIMValidationService(db).validate_project(project_id=project_id, discrepancy_threshold=0.30)
    db.flush()
    return [
        ProjectBIMDiscrepancyOut(
            material=str(item["material_type"]),
            estimated=float(item["estimated_quantity"]),
            reported=float(item["reported_quantity"]),
            discrepancy=round(float(item["discrepancy_ratio"]) * 100.0, 2),
            status=str(item.get("status", "HIGH")),
        )
        for item in flagged
    ]


def _parse_ifc_and_store_estimates(project_id: UUID, file_path: str) -> None:
    with SessionLocal() as session:
        parser = BIMParserService()
        parsed = parser.parse_ifc_materials(file_path=Path(file_path))
        unit_map = {
            "concrete": "m3",
            "steel": "ton",
            "glass": "m2",
        }

        session.execute(
            BIMMaterialEstimate.__table__.delete().where(BIMMaterialEstimate.project_id == project_id)
        )

        for material_type, estimated_quantity in parsed.items():
            session.add(
                BIMMaterialEstimate(
                    project_id=project_id,
                    material_type=material_type,
                    estimated_quantity=float(estimated_quantity),
                    unit=unit_map[material_type],
                )
            )

        BIMValidationService(session).summarize_project(project_id=project_id)
        session.commit()
