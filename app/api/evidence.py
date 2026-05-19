import logging
import hashlib
import re
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile, status
from fastapi.responses import FileResponse, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db
from app.core.observability import record_upload_size
from app.core.rate_limit import limiter
from app.models.evidence_file import EvidenceFile
from app.models.material_entry import MaterialEntry, MaterialStatus
from app.models.project import Project
from app.models.user import User
from app.repositories.evidence_repository import EvidenceRepository
from app.schemas.evidence import EvidenceListOut, EvidenceOut
from app.services.evidence_integrity_service import EvidenceIntegrityService
from app.services.audit_service import AuditService
from app.services.evidence_service import EvidenceService
from app.infra.tasks import refresh_duplicate_flags_task
from app.storage import get_file_storage
from app.storage.base import FileStorage

logger = logging.getLogger("infrasentinel")

router = APIRouter(tags=["evidence"])

_ALLOWED_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}
_MAX_UPLOAD_BYTES = 10 * 1024 * 1024


@router.post("/material-entries/{entry_id}/evidence", response_model=EvidenceOut)
@limiter.limit("10/minute")
async def upload_evidence(
    request: Request,
    entry_id: str,
    evidence_type: str = Query("other"),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> EvidenceOut:
    del request
    try:
        entry_uuid = UUID(entry_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid material entry id") from exc

    entry = _get_entry_for_user(db, entry_uuid, user)
    storage = get_file_storage()
    if entry.status == MaterialStatus.LOCKED:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Entry is locked")

    if file.content_type not in _ALLOWED_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported or invalid evidence file type.",
        )

    if not _validate_file_signature(file):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported or invalid evidence file type.",
        )

    try:
        storage_path, file_hash, file_size, original_name = await _save_upload(
            file=file,
            storage=storage,
            max_bytes=_MAX_UPLOAD_BYTES,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    audit = AuditService(db)
    with db.begin_nested():
        evidence = EvidenceFile(
            material_entry_id=entry.id,
            file_name=original_name,
            file_type=file.content_type or "application/octet-stream",
            content_type=file.content_type or "application/octet-stream",
            file_size=file_size,
            file_hash=file_hash,
            evidence_type=evidence_type.strip().lower(),
            duplicate_flag=False,
            storage_path=storage_path,
            uploaded_by=user.id,
            uploaded_at=datetime.now(timezone.utc),
        )
        db.add(evidence)
        db.flush()
        try:
            refresh_duplicate_flags_task.delay(str(user.organization_id))
        except Exception:
            logger.exception("Failed to queue duplicate-flag refresh task, running synchronously")
            EvidenceIntegrityService(db).refresh_duplicate_flags(organization_id=user.organization_id)

        audit.log(
            performed_by_id=user.id,
            entity_type="EvidenceFile",
            entity_id=evidence.id,
            action="UPLOAD_EVIDENCE",
            previous_state={},
            new_state=_snapshot(evidence),
        )
        return evidence


@router.get("/evidence/duplicates", response_model=list[dict[str, object]])
def list_duplicate_evidence_entries(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[dict[str, object]]:
    entries = EvidenceIntegrityService(db).list_suspicious_entries(
        organization_id=user.organization_id
    )
    return [
        {
            "entry_id": str(entry.id),
            "project_id": str(entry.project_id),
            "material_name": entry.material_name,
            "status": entry.status.value,
            "created_at": entry.created_at.isoformat(),
        }
        for entry in entries
    ]


@router.get("/material-entries/{entry_id}/evidence", response_model=EvidenceListOut)
def list_evidence(
    entry_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    limit: int = Query(50, ge=1),
    offset: int = Query(0, ge=0),
) -> EvidenceListOut:
    _get_entry_for_user(db, entry_id, user)
    repo = EvidenceRepository(db)
    return EvidenceListOut(
        total=repo.count_for_entry(entry_id=entry_id),
        items=repo.list_for_entry_paginated(entry_id=entry_id, limit=limit, offset=offset),
    )


@router.get("/evidence/{evidence_id}/download")
def download_evidence(
    evidence_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> FileResponse:
    evidence = _get_evidence_for_user(db, evidence_id, user)
    storage = get_file_storage()
    if not storage.exists(uri=evidence.storage_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File missing")

    with db.begin_nested():
        AuditService(db).log(
            performed_by_id=user.id,
            entity_type="EvidenceFile",
            entity_id=evidence.id,
            action="evidence_downloaded",
            previous_state={},
            new_state=_snapshot(evidence),
        )

    local_path = storage.resolve_local_path(uri=evidence.storage_path)
    if local_path is not None and local_path.exists():
        return FileResponse(
            local_path,
            media_type=evidence.file_type,
            filename=evidence.file_name,
        )

    payload = storage.read_bytes(uri=evidence.storage_path)
    response = Response(content=payload, media_type=evidence.file_type)
    response.headers["content-disposition"] = f'attachment; filename="{evidence.file_name}"'
    return response


@router.get("/evidence/{evidence_id}/verify")
def verify_evidence(
    evidence_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, object]:
    evidence = _get_evidence_for_user(db, evidence_id, user)
    service = EvidenceService(AuditService(db))
    try:
        return service.verify_integrity(evidence=evidence, actor_user_id=user.id)
    except ValueError as exc:
        logger.warning(
            "404 resource not found",
            extra={
                "resource": "evidence",
                "requested_id": str(evidence_id),
                "user_id": str(user.id),
                "user_email": user.email,
                "user_org": str(user.organization_id),
                "db_exists": True,
                "org_mismatch": False,
            },
        )
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


def _get_entry_for_user(db: Session, entry_id: UUID, user: User) -> MaterialEntry:
    stmt = (
        select(MaterialEntry)
        .join(Project, Project.id == MaterialEntry.project_id)
        .where(MaterialEntry.id == entry_id, Project.organization_id == user.organization_id)
    )
    entry = db.execute(stmt).scalar_one_or_none()
    if entry is None:
        if db.get(MaterialEntry, entry_id) is None:
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
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
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


def _get_evidence_for_user(db: Session, evidence_id: UUID, user: User) -> EvidenceFile:
    repo = EvidenceRepository(db)
    stmt = (
        select(EvidenceFile)
        .join(MaterialEntry, MaterialEntry.id == EvidenceFile.material_entry_id)
        .join(Project, Project.id == MaterialEntry.project_id)
        .where(EvidenceFile.id == evidence_id, Project.organization_id == user.organization_id)
    )
    evidence = db.execute(stmt).scalar_one_or_none()
    if evidence is None:
        if repo.get(evidence_id=evidence_id) is None:
            logger.warning(
                "404 resource not found",
                extra={
                    "resource": "evidence",
                    "requested_id": str(evidence_id),
                    "user_id": str(user.id),
                    "user_email": user.email,
                    "user_org": str(user.organization_id),
                    "db_exists": False,
                    "org_mismatch": False,
                },
            )
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
        logger.warning(
            "ORG_MISMATCH",
            extra={
                "resource": "evidence",
                "requested_id": str(evidence_id),
                "user_id": str(user.id),
                "user_email": user.email,
                "user_org": str(user.organization_id),
                "db_exists": True,
                "org_mismatch": True,
            },
        )
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    return evidence


async def _save_upload(*, file: UploadFile, storage: FileStorage, max_bytes: int) -> tuple[str, str, int, str]:
    original_name = _secure_filename(file.filename or "file")
    stored_key = f"evidence/{uuid4()}_{original_name}"
    hasher = hashlib.sha256()
    total = 0

    with tempfile.NamedTemporaryFile(delete=False) as tmp:
        tmp_path = Path(tmp.name)

    try:
        with tmp_path.open("wb") as handle:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                total += len(chunk)
                if total > max_bytes:
                    raise ValueError("File too large")
                hasher.update(chunk)
                handle.write(chunk)

        payload = tmp_path.read_bytes()
        uri = storage.save_bytes(
            key=stored_key,
            data=payload,
            content_type=file.content_type or "application/octet-stream",
        )
        record_upload_size(content_type=file.content_type or "application/octet-stream", size_bytes=total)
        return uri, hasher.hexdigest(), total, original_name
    finally:
        try:
            tmp_path.unlink(missing_ok=True)
        except Exception:
            logger.warning("Failed to clean temporary upload file: %s", str(tmp_path))
        await file.seek(0)


def _validate_file_signature(file: UploadFile) -> bool:
    header = file.file.read(8)
    filename = Path(file.filename or "").name.lower()
    try:
        if file.content_type == "application/pdf":
            return header.startswith(b"%PDF-")
        if file.content_type == "image/jpeg":
            return header.startswith(b"\xFF\xD8\xFF")
        if file.content_type == "image/png":
            return header.startswith(b"\x89PNG\r\n\x1a\n")
        if file.content_type == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
            return filename.endswith(".xlsx") and header.startswith(b"PK")
        return False
    finally:
        try:
            file.file.seek(0)
        except Exception:
            pass


def _secure_filename(name: str) -> str:
    cleaned = Path(name).name.strip()
    if not cleaned:
        return "file"
    cleaned = re.sub(r"[^A-Za-z0-9._-]", "_", cleaned)
    return cleaned[:255]


def _snapshot(evidence: EvidenceFile) -> dict[str, object]:
    return {
        "id": str(evidence.id),
        "material_entry_id": str(evidence.material_entry_id),
        "file_name": evidence.file_name,
        "file_type": evidence.file_type,
        "content_type": evidence.content_type,
        "file_size": evidence.file_size,
        "file_hash": evidence.file_hash,
        "evidence_type": evidence.evidence_type,
        "duplicate_flag": evidence.duplicate_flag,
        "storage_path": evidence.storage_path,
        "uploaded_by": str(evidence.uploaded_by),
        "uploaded_at": evidence.uploaded_at.isoformat(),
    }
