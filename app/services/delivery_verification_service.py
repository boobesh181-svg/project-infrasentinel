from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.delivery_event import DeliveryEvent
from app.models.verification_result import VerificationResult


class DeliveryVerificationService:
    def __init__(self, session: Session) -> None:
        self._session = session

    def record_detection(
        self,
        *,
        delivery_id: UUID,
        detected_plate: str | None,
        detected_material_type: str | None,
        detected_quantity: float | None,
        detection_confidence: float | None,
        anpr_confidence: float | None,
        timestamp: datetime | None,
    ) -> DeliveryEvent:
        event = self._session.get(DeliveryEvent, delivery_id)
        if event is None:
            raise ValueError("delivery not found")

        event.detected_plate = detected_plate or event.detected_plate
        event.detected_material_type = detected_material_type or event.detected_material_type
        if detected_quantity is not None:
            event.detected_quantity = detected_quantity
        if detection_confidence is not None:
            event.detection_confidence = detection_confidence
        if anpr_confidence is not None:
            event.anpr_confidence = anpr_confidence
        event.detected_at = timestamp or datetime.now(timezone.utc)

        suspicious_flags = []
        duplicate_vehicle = self._detect_duplicate_vehicle(event=event)
        if duplicate_vehicle:
            suspicious_flags.append("duplicate_vehicle")

        if event.expected_quantity is not None and event.detected_quantity is not None:
            expected = float(event.expected_quantity)
            detected = float(event.detected_quantity)
            if expected > 0 and abs(expected - detected) / expected > 0.2:
                suspicious_flags.append("quantity_mismatch")

        if anpr_confidence is not None and anpr_confidence < 0.6:
            suspicious_flags.append("low_anpr_confidence")
        if detection_confidence is not None and detection_confidence < 0.6:
            suspicious_flags.append("low_detection_confidence")

        event.duplicate_vehicle = duplicate_vehicle
        event.suspicious_flags = suspicious_flags
        event.state = "FLAGGED" if suspicious_flags else "PROCESSING"

        self._session.add(
            VerificationResult(
                delivery_event_id=event.id,
                analyzer="ai:truck_detection",
                confidence=event.detection_confidence,
                reasoning="Truck detection executed from camera feed.",
            )
        )
        if detected_plate or event.detected_plate:
            self._session.add(
                VerificationResult(
                    delivery_event_id=event.id,
                    analyzer="ai:anpr",
                    confidence=event.anpr_confidence,
                    reasoning=f"ANPR extracted plate {event.detected_plate or detected_plate or 'unknown'}.",
                )
            )
        if suspicious_flags:
            self._session.add(
                VerificationResult(
                    delivery_event_id=event.id,
                    analyzer="ai:suspicious_activity",
                    confidence=0.2,
                    reasoning=f"Flags: {', '.join(suspicious_flags)}",
                )
            )
        else:
            event.state = "VERIFIED"
            self._session.add(
                VerificationResult(
                    delivery_event_id=event.id,
                    analyzer="ai:verification",
                    confidence=0.86,
                    reasoning="No anomalies detected in delivery pipeline.",
                )
            )

        return event

    def _detect_duplicate_vehicle(self, *, event: DeliveryEvent) -> bool:
        plate = event.detected_plate or event.vehicle_plate
        if not plate:
            return False

        window_start = (event.occurred_at or datetime.now(timezone.utc)) - timedelta(hours=12)
        stmt = select(DeliveryEvent).where(
            DeliveryEvent.id != event.id,
            DeliveryEvent.occurred_at >= window_start,
            DeliveryEvent.vehicle_plate.ilike(f"%{plate}%"),
        )
        return self._session.execute(stmt).scalar_one_or_none() is not None
