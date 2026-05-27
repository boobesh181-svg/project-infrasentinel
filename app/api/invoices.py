import hashlib
import logging
import re
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile, status
from fastapi.responses import FileResponse, Response
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db
from app.core.observability import record_upload_size
from app.core.rate_limit import limiter
from app.models.supplier_invoice import InvoiceStatus, SupplierInvoice
from app.models.user import User
from app.schemas.invoice import SupplierInvoiceListOut, SupplierInvoiceOut, SupplierInvoiceUpdate
from app.services.invoice_extraction_service import InvoiceExtractionService
from app.services.invoice_parsing_service import InvoiceParsingService
from app.services.invoice_service import InvoiceService
from app.storage import get_file_storage
from app.storage.base import FileStorage

logger = logging.getLogger("infrasentinel")

router = APIRouter(prefix="/invoices", tags=["invoices"])

_ALLOWED_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
}
_MAX_UPLOAD_BYTES = 10 * 1024 * 1024


@router.post("", response_model=SupplierInvoiceOut)
@limiter.limit("10/minute")
async def upload_invoice(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> SupplierInvoiceOut:
    del request

    if file.content_type not in _ALLOWED_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported or invalid invoice file type.",
        )

    if not _validate_file_signature(file):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported or invalid invoice file type.",
        )

    storage = get_file_storage()
    try:
        storage_path, file_hash, file_size, original_name = await _save_upload(
            file=file,
            storage=storage,
            max_bytes=_MAX_UPLOAD_BYTES,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    extraction = InvoiceExtractionService().extract_text(
        file_path=Path(storage_path),
        content_type=file.content_type or "application/octet-stream",
    )
    parsing = InvoiceParsingService().parse(extraction.raw_text or "")
    confidence = _build_confidence(parsing.confidence)

    status_value = extraction.status
    if status_value not in {status.value for status in InvoiceStatus}:
        status_value = InvoiceStatus.NEEDS_REVIEW.value

    if status_value != InvoiceStatus.FAILED.value and _missing_required_fields(parsing):
        status_value = InvoiceStatus.NEEDS_REVIEW.value

    payload = {
        "organization_id": user.organization_id,
        "uploaded_by": user.id,
        "supplier_name": parsing.supplier_name,
        "invoice_number": parsing.invoice_number,
        "material_type": parsing.material_type,
        "expected_quantity": parsing.expected_quantity,
        "vehicle_number": parsing.vehicle_number,
        "invoice_timestamp": parsing.invoice_timestamp,
        "raw_text": extraction.raw_text,
        "extraction_confidence": confidence,
        "extraction_status": InvoiceStatus(status_value),
        "extraction_errors": extraction.errors,
        "file_name": original_name,
        "file_type": file.content_type or "application/octet-stream",
        "content_type": file.content_type or "application/octet-stream",
        "file_size": file_size,
        "file_hash": file_hash,
        "storage_path": storage_path,
        "uploaded_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }

    service = InvoiceService(db)
    record = service.create_invoice(payload=payload, actor_id=user.id)
    db.commit()
    db.refresh(record)
    return record


@router.get("", response_model=SupplierInvoiceListOut)
def list_invoices(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    limit: int = Query(50, ge=1),
    offset: int = Query(0, ge=0),
    query: str | None = Query(default=None),
) -> SupplierInvoiceListOut:
    service = InvoiceService(db)
    total, items = service.list_invoices(
        organization_id=user.organization_id,
        limit=limit,
        offset=offset,
        query=query,
    )
    return SupplierInvoiceListOut(total=total, items=items)


@router.get("/{invoice_id}", response_model=SupplierInvoiceOut)
def get_invoice(
    invoice_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> SupplierInvoiceOut:
    invoice = db.get(SupplierInvoice, invoice_id)
    if invoice is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")
    if invoice.organization_id != user.organization_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    return invoice


@router.patch("/{invoice_id}", response_model=SupplierInvoiceOut)
def update_invoice(
    invoice_id: UUID,
    payload: SupplierInvoiceUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> SupplierInvoiceOut:
    invoice = db.get(SupplierInvoice, invoice_id)
    if invoice is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")
    if invoice.organization_id != user.organization_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    updates = payload.dict(exclude_unset=True)
    service = InvoiceService(db)
    service.update_invoice(invoice=invoice, updates=updates, actor_id=user.id)
    db.commit()
    db.refresh(invoice)
    return invoice


@router.get("/{invoice_id}/download")
def download_invoice(
    invoice_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> FileResponse:
    invoice = db.get(SupplierInvoice, invoice_id)
    if invoice is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")
    if invoice.organization_id != user.organization_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    storage = get_file_storage()
    if not storage.exists(uri=invoice.storage_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File missing")

    local_path = storage.resolve_local_path(uri=invoice.storage_path)
    if local_path is not None and local_path.exists():
        return FileResponse(
            local_path,
            media_type=invoice.file_type,
            filename=invoice.file_name,
        )

    payload = storage.read_bytes(uri=invoice.storage_path)
    response = Response(content=payload, media_type=invoice.file_type)
    response.headers["content-disposition"] = f'attachment; filename="{invoice.file_name}"'
    return response


def _build_confidence(fields: dict[str, float]) -> dict:
    if not fields:
        return {"overall": 0.0, "fields": {}}
    overall = sum(fields.values()) / len(fields)
    return {
        "overall": round(overall, 3),
        "fields": {key: round(value, 3) for key, value in fields.items()},
    }


def _missing_required_fields(parsed) -> bool:
    required = [
        parsed.supplier_name,
        parsed.invoice_number,
        parsed.expected_quantity,
        parsed.vehicle_number,
        parsed.invoice_timestamp,
    ]
    return any(value in (None, "") for value in required)


async def _save_upload(*, file: UploadFile, storage: FileStorage, max_bytes: int) -> tuple[str, str, int, str]:
    original_name = _secure_filename(file.filename or "file")
    stored_key = f"invoices/{uuid4()}_{original_name}"
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
        return filename.endswith(".pdf") or filename.endswith(".jpg") or filename.endswith(".jpeg") or filename.endswith(".png")
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
