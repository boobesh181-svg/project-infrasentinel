from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.supplier_invoice import InvoiceStatus, SupplierInvoice
from app.services.audit_service import AuditService
from app.services.invoice_link_service import InvoiceLinkService


class InvoiceService:
    def __init__(self, session: Session) -> None:
        self._session = session
        self._audit = AuditService(session)
        self._linker = InvoiceLinkService(session)

    def create_invoice(self, *, payload: dict, actor_id: UUID) -> SupplierInvoice:
        record = SupplierInvoice(**payload)
        record.updated_at = datetime.now(timezone.utc)
        self._session.add(record)
        self._session.flush()

        self._audit.log(
            performed_by_id=actor_id,
            entity_type="SupplierInvoice",
            entity_id=record.id,
            action="UPLOAD_INVOICE",
            previous_state={},
            new_state={
                "id": str(record.id),
                "status": record.extraction_status.value,
                "supplier_name": record.supplier_name,
                "invoice_number": record.invoice_number,
            },
        )

        self._linker.link_invoice(invoice=record, actor_id=actor_id)
        return record

    def update_invoice(self, *, invoice: SupplierInvoice, updates: dict, actor_id: UUID) -> SupplierInvoice:
        before = {
            "supplier_name": invoice.supplier_name,
            "invoice_number": invoice.invoice_number,
            "material_type": invoice.material_type,
            "expected_quantity": float(invoice.expected_quantity) if invoice.expected_quantity is not None else None,
            "vehicle_number": invoice.vehicle_number,
            "invoice_timestamp": invoice.invoice_timestamp.isoformat() if invoice.invoice_timestamp else None,
        }

        for key, value in updates.items():
            setattr(invoice, key, value)

        invoice.extraction_status = InvoiceStatus.CONFIRMED
        invoice.corrected_by = actor_id
        invoice.corrected_at = datetime.now(timezone.utc)
        invoice.updated_at = datetime.now(timezone.utc)

        self._audit.log(
            performed_by_id=actor_id,
            entity_type="SupplierInvoice",
            entity_id=invoice.id,
            action="UPDATE_INVOICE",
            previous_state=before,
            new_state={
                "supplier_name": invoice.supplier_name,
                "invoice_number": invoice.invoice_number,
                "material_type": invoice.material_type,
                "expected_quantity": float(invoice.expected_quantity) if invoice.expected_quantity is not None else None,
                "vehicle_number": invoice.vehicle_number,
                "invoice_timestamp": invoice.invoice_timestamp.isoformat() if invoice.invoice_timestamp else None,
                "status": invoice.extraction_status.value,
            },
        )
        return invoice

    def list_invoices(
        self,
        *,
        organization_id: UUID,
        limit: int,
        offset: int,
        query: str | None = None,
    ) -> tuple[int, list[SupplierInvoice]]:
        base = select(SupplierInvoice).where(SupplierInvoice.organization_id == organization_id)

        if query:
            normalized = f"%{query.lower()}%"
            base = base.where(
                func.lower(SupplierInvoice.supplier_name).ilike(normalized)
                | func.lower(SupplierInvoice.invoice_number).ilike(normalized)
                | func.lower(SupplierInvoice.vehicle_number).ilike(normalized)
                | func.lower(SupplierInvoice.material_type).ilike(normalized)
            )

        total = int(
            self._session.execute(
                select(func.count(SupplierInvoice.id)).select_from(base.subquery())
            ).scalar_one()
        )
        items = list(
            self._session.execute(
                base.order_by(SupplierInvoice.uploaded_at.desc()).limit(limit).offset(offset)
            ).scalars().all()
        )
        return total, items
