from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.invoice_delivery_link import InvoiceDeliveryLink
from app.models.supplier_invoice import SupplierInvoice
from app.models.weighbridge_event import WeighbridgeEvent, WeighbridgeStatus
from app.services.audit_service import AuditService


class WeighbridgeService:
    def __init__(self, session: Session) -> None:
        self._session = session
        self._audit = AuditService(session)

    def capture_gross(
        self,
        *,
        organization_id: UUID,
        actor_id: UUID,
        delivery_event_id: UUID,
        invoice_id: UUID | None,
        gross_weight: float,
        unit: str,
    ) -> WeighbridgeEvent:
        expected_quantity, resolved_invoice_id = self._resolve_invoice_quantity(
            delivery_event_id=delivery_event_id,
            invoice_id=invoice_id,
        )

        record = WeighbridgeEvent(
            organization_id=organization_id,
            delivery_event_id=delivery_event_id,
            invoice_id=resolved_invoice_id,
            gross_weight=gross_weight,
            unit=unit,
            expected_quantity=expected_quantity,
            status=WeighbridgeStatus.GROSS_CAPTURED,
            gross_captured_at=datetime.now(timezone.utc),
            created_by=actor_id,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        self._session.add(record)
        self._session.flush()

        self._audit.log(
            performed_by_id=actor_id,
            entity_type="WeighbridgeEvent",
            entity_id=record.id,
            action="CAPTURE_GROSS_WEIGHT",
            previous_state={},
            new_state={
                "delivery_event_id": str(delivery_event_id),
                "gross_weight": gross_weight,
                "unit": unit,
            },
        )
        return record

    def capture_tare(
        self,
        *,
        record_id: UUID,
        actor_id: UUID,
        tare_weight: float,
        mismatch_threshold: float,
    ) -> WeighbridgeEvent:
        record = self._session.get(WeighbridgeEvent, record_id)
        if record is None:
            raise ValueError("weighbridge event not found")

        record.tare_weight = tare_weight
        record.net_weight = max(record.gross_weight - tare_weight, 0.0)
        record.tare_captured_at = datetime.now(timezone.utc)
        record.mismatch_threshold = mismatch_threshold
        record.updated_at = datetime.now(timezone.utc)

        flags: list[str] = []
        if record.net_weight == 0:
            flags.append("zero_net_weight")

        mismatch_percent = None
        if record.expected_quantity is not None and record.expected_quantity > 0:
            mismatch_percent = abs(record.net_weight - record.expected_quantity) / record.expected_quantity
            record.mismatch_percent = mismatch_percent
            if mismatch_percent > mismatch_threshold:
                flags.append("quantity_mismatch")

        record.anomaly_flags = flags
        record.status = WeighbridgeStatus.MISMATCH if flags else WeighbridgeStatus.VERIFIED

        self._audit.log(
            performed_by_id=actor_id,
            entity_type="WeighbridgeEvent",
            entity_id=record.id,
            action="CAPTURE_TARE_WEIGHT",
            previous_state={},
            new_state={
                "tare_weight": tare_weight,
                "net_weight": record.net_weight,
                "mismatch_percent": mismatch_percent,
                "status": record.status.value,
            },
        )
        return record

    def get_latest_for_delivery(self, *, delivery_event_id: UUID) -> WeighbridgeEvent | None:
        stmt = (
            select(WeighbridgeEvent)
            .where(WeighbridgeEvent.delivery_event_id == delivery_event_id)
            .order_by(WeighbridgeEvent.created_at.desc())
        )
        return self._session.execute(stmt).scalar_one_or_none()

    def _resolve_invoice_quantity(
        self, *, delivery_event_id: UUID, invoice_id: UUID | None
    ) -> tuple[float | None, UUID | None]:
        if invoice_id:
            invoice = self._session.get(SupplierInvoice, invoice_id)
            if invoice is not None:
                return float(invoice.expected_quantity) if invoice.expected_quantity is not None else None, invoice.id

        stmt = select(InvoiceDeliveryLink).where(
            InvoiceDeliveryLink.delivery_event_id == delivery_event_id
        )
        link = self._session.execute(stmt).scalar_one_or_none()
        if link is None:
            return None, None

        invoice = self._session.get(SupplierInvoice, link.invoice_id)
        if invoice is None:
            return None, None

        return float(invoice.expected_quantity) if invoice.expected_quantity is not None else None, invoice.id
