from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.delivery_event import DeliveryEvent
from app.models.invoice_delivery_link import InvoiceDeliveryLink
from app.models.supplier_invoice import SupplierInvoice
from app.services.audit_service import AuditService


class InvoiceLinkService:
    def __init__(self, session: Session) -> None:
        self._session = session
        self._audit = AuditService(session)

    def link_invoice(self, *, invoice: SupplierInvoice, actor_id: UUID | None) -> list[InvoiceDeliveryLink]:
        matches = self._find_delivery_matches(invoice=invoice)
        links: list[InvoiceDeliveryLink] = []

        for event, confidence, reason in matches:
            if self._link_exists(invoice_id=invoice.id, delivery_event_id=event.id):
                continue
            link = InvoiceDeliveryLink(
                invoice_id=invoice.id,
                delivery_event_id=event.id,
                match_confidence=confidence,
                match_reason=reason,
                matched_at=datetime.now(timezone.utc),
            )
            self._session.add(link)
            links.append(link)

            if actor_id is not None:
                self._audit.log(
                    performed_by_id=actor_id,
                entity_type="SupplierInvoice",
                entity_id=invoice.id,
                action="LINK_DELIVERY_EVENT",
                previous_state={},
                new_state={
                    "delivery_event_id": str(event.id),
                    "match_confidence": confidence,
                    "match_reason": reason,
                },
                )
        return links

    def link_delivery_event(self, *, event: DeliveryEvent) -> list[InvoiceDeliveryLink]:
        matches = self._find_invoice_matches(event=event)
        links: list[InvoiceDeliveryLink] = []

        for invoice, confidence, reason in matches:
            if self._link_exists(invoice_id=invoice.id, delivery_event_id=event.id):
                continue
            link = InvoiceDeliveryLink(
                invoice_id=invoice.id,
                delivery_event_id=event.id,
                match_confidence=confidence,
                match_reason=reason,
                matched_at=datetime.now(timezone.utc),
            )
            self._session.add(link)
            links.append(link)

            self._audit.log(
                performed_by_id=invoice.uploaded_by,
                entity_type="SupplierInvoice",
                entity_id=invoice.id,
                action="LINK_DELIVERY_EVENT",
                previous_state={},
                new_state={
                    "delivery_event_id": str(event.id),
                    "match_confidence": confidence,
                    "match_reason": reason,
                },
            )
        return links

    def _find_delivery_matches(self, *, invoice: SupplierInvoice) -> list[tuple[DeliveryEvent, float, str]]:
        if not invoice.vehicle_number and not invoice.supplier_name:
            return []
        if not invoice.invoice_timestamp:
            window_start = datetime.now(timezone.utc) - timedelta(days=1)
        else:
            window_start = invoice.invoice_timestamp
        window_end = window_start + timedelta(days=3)

        stmt = select(DeliveryEvent).where(
            DeliveryEvent.occurred_at >= window_start,
            DeliveryEvent.occurred_at <= window_end,
        )
        if invoice.vehicle_number:
            stmt = stmt.where(DeliveryEvent.vehicle_plate.ilike(f"%{invoice.vehicle_number}%"))
        if invoice.supplier_name:
            stmt = stmt.where(DeliveryEvent.supplier.ilike(f"%{invoice.supplier_name}%"))

        matches: list[tuple[DeliveryEvent, float, str]] = []
        for event in self._session.execute(stmt).scalars().all():
            confidence, reason = self._score_match(invoice=invoice, event=event)
            if confidence >= 0.5:
                matches.append((event, confidence, reason))
        return matches

    def _find_invoice_matches(self, *, event: DeliveryEvent) -> list[tuple[SupplierInvoice, float, str]]:
        if not event.vehicle_plate and not event.supplier:
            return []
        window_start = event.occurred_at - timedelta(days=1)
        window_end = event.occurred_at + timedelta(days=3)

        stmt = select(SupplierInvoice).where(
            SupplierInvoice.invoice_timestamp.is_not(None),
            SupplierInvoice.invoice_timestamp >= window_start,
            SupplierInvoice.invoice_timestamp <= window_end,
        )
        if event.vehicle_plate:
            stmt = stmt.where(SupplierInvoice.vehicle_number.ilike(f"%{event.vehicle_plate}%"))
        if event.supplier:
            stmt = stmt.where(SupplierInvoice.supplier_name.ilike(f"%{event.supplier}%"))

        matches: list[tuple[SupplierInvoice, float, str]] = []
        for invoice in self._session.execute(stmt).scalars().all():
            confidence, reason = self._score_match(invoice=invoice, event=event)
            if confidence >= 0.5:
                matches.append((invoice, confidence, reason))
        return matches

    def _score_match(self, *, invoice: SupplierInvoice, event: DeliveryEvent) -> tuple[float, str]:
        confidence = 0.3
        reasons: list[str] = []

        if invoice.vehicle_number and event.vehicle_plate:
            if invoice.vehicle_number.lower() in event.vehicle_plate.lower():
                confidence += 0.4
                reasons.append("vehicle_match")
        if invoice.supplier_name and event.supplier:
            if invoice.supplier_name.lower() in event.supplier.lower():
                confidence += 0.3
                reasons.append("supplier_match")
        if invoice.expected_quantity is not None and event.expected_quantity is not None:
            expected = float(invoice.expected_quantity)
            detected = float(event.expected_quantity)
            if expected > 0:
                diff_ratio = abs(expected - detected) / expected
                if diff_ratio <= 0.15:
                    confidence += 0.2
                    reasons.append("quantity_match")

        return min(confidence, 1.0), "+".join(reasons) or "heuristic"

    def _link_exists(self, *, invoice_id: UUID, delivery_event_id: UUID) -> bool:
        stmt = select(InvoiceDeliveryLink).where(
            InvoiceDeliveryLink.invoice_id == invoice_id,
            InvoiceDeliveryLink.delivery_event_id == delivery_event_id,
        )
        return self._session.execute(stmt).scalar_one_or_none() is not None
