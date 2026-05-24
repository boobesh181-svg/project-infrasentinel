"""Processor worker that consumes `ingest:queue` from Redis and writes a verification stub.

This is a simple demo processor: in production you'd use Redis Streams/consumer groups or Kafka.
"""
import json
import logging
import time
from datetime import datetime, timezone

import redis

from app.db.session import SessionLocal
from app.core.config import get_settings
from app.models.verification_result import VerificationResult

logger = logging.getLogger("infrasentinel.processor")


def publish_ops_event(redis_client, payload: dict) -> None:
    try:
        payload = {
            **payload,
            "created_at": payload.get("created_at") or datetime.now(timezone.utc).isoformat(),
        }
        redis_client.publish("ops:events", json.dumps(payload))
    except Exception:
        logger.exception("failed to publish ops event")


def process_item(item: dict):
    # Simple heuristic: if supplier contains 'Acme' mark high confidence
    supplier = item.get("supplier") or ""
    confidence = 0.95 if "acme" in supplier.lower() else 0.75
    reasoning = f"Auto-verified by demo processor; supplier={supplier}"
    return confidence, reasoning


def main_loop(poll_interval: float = 1.0):
    settings = get_settings()
    r = redis.from_url(settings.redis_url)
    db = SessionLocal()
    logger.info("processor started, listening on ingest:queue")
    try:
        while True:
            # BRPOP with timeout
            item = r.brpop("ingest:queue", timeout=5)
            if not item:
                time.sleep(poll_interval)
                continue
            _, raw = item
            try:
                payload = json.loads(raw)
            except Exception:
                logger.exception("invalid payload")
                continue

            delivery_id = payload.get("delivery_id")
            from app.models.delivery_event import DeliveryEvent

            de = db.query(DeliveryEvent).filter(DeliveryEvent.id == delivery_id).one_or_none()
            if de:
                de.state = "PROCESSING"
                db.add(de)
                db.commit()
                publish_ops_event(
                    r,
                    {
                        "type": "delivery_state",
                        "phase": "processing",
                        "state": "PROCESSING",
                        "delivery_id": delivery_id,
                        "site_id": str(de.site_id),
                        "vehicle_plate": de.vehicle_plate,
                        "supplier": de.supplier,
                        "reasoning": "Processor claimed the delivery for verification.",
                    },
                )

            confidence, reasoning = process_item(payload)
            final_state = "VERIFIED" if confidence > 0.8 else "FLAGGED"
            vr = VerificationResult(
                delivery_event_id=delivery_id,
                analyzer="processor:auto",
                confidence=confidence,
                reasoning=reasoning,
            )
            db.add(vr)
            # Optionally update delivery state to REVIEW/VERIFIED
            try:
                if de:
                    de.confidence = confidence
                    de.state = final_state
                    db.add(de)
            except Exception:
                logger.exception("failed to update delivery")

            db.commit()
            publish_ops_event(
                r,
                {
                    "type": "verification_result",
                    "phase": final_state.lower(),
                    "state": final_state,
                    "delivery_id": delivery_id,
                    "site_id": str(de.site_id) if de else None,
                    "vehicle_plate": de.vehicle_plate if de else None,
                    "confidence": confidence,
                    "reasoning": reasoning,
                },
            )
            logger.info("processed delivery %s -> confidence=%.2f", delivery_id, confidence)
    finally:
        db.close()


if __name__ == "__main__":
    main_loop()
