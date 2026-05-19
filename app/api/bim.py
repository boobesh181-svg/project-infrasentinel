from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import logging
from pathlib import Path
import tempfile
from uuid import UUID, uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db, require_roles
from app.db.session import SessionLocal
from app.models.bim_material import BIMMaterial
from app.models.bim_model import BIMFileFormat, BIMModel, BIMProcessingStatus
from app.models.project import Project
from app.models.user import User, UserRole
from app.schemas.bim import (
    BIMComparisonOut,
    BIMExtractedMaterialOut,
    BIMMaterialOut,
    BIMModelOut,
    BIMUploadMaterialsOut,
    BIMUploadResponseOut,
)
from app.services.bim_service import parse_ifc_materials
from app.services.bim.bim_comparison_service import BIMComparisonService
from app.services.bim.bim_material_extractor import BIMMaterialExtractor
from app.services.bim.bim_parser import parse_ifc

router = APIRouter(tags=["bim"])
logger = logging.getLogger("infrasentinel")


@router.post("/bim/upload", response_model=BIMUploadMaterialsOut)
def upload_ifc_extract_materials(
    file: UploadFile = File(...),
    _: User = Depends(get_current_user),
) -> BIMUploadMaterialsOut:
    filename = file.filename or ""
    if not filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing filename")
    if Path(filename).suffix.lower() != ".ifc":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only IFC files are supported")

    temp_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".ifc") as tmp_file:
            while True:
                chunk = file.file.read(1024 * 1024)
                if not chunk:
                    break
                tmp_file.write(chunk)
            temp_path = Path(tmp_file.name)

        if temp_path.stat().st_size == 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded IFC file is empty")

        materials = parse_ifc_materials(str(temp_path))
        logger.info("BIM upload parsed successfully: %s (%s materials)", filename, len(materials))
        return BIMUploadMaterialsOut(materials=[BIMExtractedMaterialOut(**item) for item in materials])
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Failed to parse IFC upload: %s", filename)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to parse IFC model",
        ) from exc
    finally:
        if temp_path is not None:
            try:
                temp_path.unlink(missing_ok=True)
            except Exception:
                logger.warning("Failed to delete temporary IFC upload: %s", temp_path)


@router.post("/projects/{project_id}/bim/upload", response_model=BIMUploadResponseOut)
def upload_bim_model(
    project_id: UUID,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    actor: User = Depends(require_roles(UserRole.CREATOR, UserRole.ADMIN)),
) -> BIMUploadResponseOut:
    project = _get_project_for_org(db=db, project_id=project_id, organization_id=actor.organization_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    file_name = file.filename or "model.ifc"
    suffix = Path(file_name).suffix.lower()
    if suffix != ".ifc":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only IFC files are supported")

    storage_dir = Path(__file__).resolve().parents[2] / "storage" / "bim"
    storage_dir.mkdir(parents=True, exist_ok=True)
    stored_name = f"{uuid4()}{suffix}"
    file_path = storage_dir / stored_name

    file_hash = _save_and_hash_upload(file=file, file_path=file_path)

    model = BIMModel(
        project_id=project.id,
        file_path=str(file_path),
        file_format=BIMFileFormat.IFC,
        uploaded_by=actor.id,
        uploaded_at=datetime.now(timezone.utc),
        model_name=file_name,
        file_hash=file_hash,
        processing_status=BIMProcessingStatus.UPLOADED,
    )
    db.add(model)
    db.commit()
    db.refresh(model)

    background_tasks.add_task(_process_model_task, str(model.id), str(file_path))

    return BIMUploadResponseOut(
        message="BIM model uploaded",
        model=model,
    )


@router.get("/projects/{project_id}/bim/materials", response_model=list[BIMMaterialOut])
def get_bim_materials(
    project_id: UUID,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
) -> list[BIMMaterialOut]:
    project = _get_project_for_org(db=db, project_id=project_id, organization_id=actor.organization_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    model = _latest_processed_model(db=db, project_id=project_id)
    if model is None:
        return []

    materials = db.execute(
        select(BIMMaterial)
        .where(BIMMaterial.bim_model_id == model.id)
        .order_by(BIMMaterial.material_name.asc())
    ).scalars().all()
    return list(materials)


@router.get("/projects/{project_id}/bim/comparison", response_model=BIMComparisonOut)
def get_bim_comparison(
    project_id: UUID,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
) -> BIMComparisonOut:
    project = _get_project_for_org(db=db, project_id=project_id, organization_id=actor.organization_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    report = BIMComparisonService(db).compare_project_materials(project_id=project_id, risk_threshold=0.25)
    return BIMComparisonOut(**report)


def _process_model_task(model_id: str, file_path: str) -> None:
    model_uuid = UUID(model_id)
    with SessionLocal() as session:
        model = session.get(BIMModel, model_uuid)
        if model is None:
            return

        try:
            model.processing_status = BIMProcessingStatus.PROCESSING
            session.flush()

            raw_materials = parse_ifc(file_path)
            normalized = BIMMaterialExtractor().aggregate(raw_materials)

            session.execute(BIMMaterial.__table__.delete().where(BIMMaterial.bim_model_id == model.id))
            for item in normalized:
                session.add(
                    BIMMaterial(
                        bim_model_id=model.id,
                        material_name=str(item["material_name"]),
                        quantity=float(item["quantity"]),
                        unit=str(item["unit"]),
                        source_element=str(item["source_element"]),
                        confidence_score=float(item["confidence_score"]),
                    )
                )

            model.processing_status = BIMProcessingStatus.PROCESSED
            session.commit()
        except Exception:
            session.rollback()
            model = session.get(BIMModel, model_uuid)
            if model is not None:
                model.processing_status = BIMProcessingStatus.FAILED
                session.commit()


def _save_and_hash_upload(*, file: UploadFile, file_path: Path) -> str:
    hasher = hashlib.sha256()
    with file_path.open("wb") as out_file:
        while True:
            chunk = file.file.read(1024 * 1024)
            if not chunk:
                break
            hasher.update(chunk)
            out_file.write(chunk)
    return hasher.hexdigest()


def _get_project_for_org(*, db: Session, project_id: UUID, organization_id: UUID) -> Project | None:
    return db.execute(
        select(Project).where(Project.id == project_id, Project.organization_id == organization_id)
    ).scalar_one_or_none()


def _latest_processed_model(*, db: Session, project_id: UUID) -> BIMModel | None:
    return db.execute(
        select(BIMModel)
        .where(BIMModel.project_id == project_id, BIMModel.processing_status == BIMProcessingStatus.PROCESSED)
        .order_by(BIMModel.created_at.desc())
        .limit(1)
    ).scalar_one_or_none()
