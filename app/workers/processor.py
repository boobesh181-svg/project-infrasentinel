"""Processor worker that consumes `ingest:queue` from Redis and writes a verification stub.

This is a simple demo processor: in production you'd use Redis Streams/consumer groups or Kafka.
"""
import json
import logging
import time

import redis

from app.db.session import SessionLocal
from app.core.config import get_settings
from app.models.verification_result import VerificationResult

logger = logging.getLogger("infrasentinel.processor")


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
            confidence, reasoning = process_item(payload)
            vr = VerificationResult(
                delivery_event_id=delivery_id,
                analyzer="processor:auto",
                confidence=confidence,
                reasoning=reasoning,
            )
            db.add(vr)
            # Optionally update delivery state to REVIEW/VERIFIED
            try:
                from app.models.delivery_event import DeliveryEvent

                de = db.query(DeliveryEvent).filter(DeliveryEvent.id == delivery_id).one_or_none()
                if de:
                    de.confidence = confidence
                    de.state = "VERIFIED" if confidence > 0.8 else "REVIEW"
                    db.add(de)
            except Exception:
                logger.exception("failed to update delivery")

            db.commit()
            try:
                # Publish an ops event for realtime subscribers
                r.publish("ops:events", json.dumps({
                    "type": "verification_result",
                    "delivery_id": delivery_id,
                    "confidence": confidence,
                    "reasoning": reasoning,
                    "state": de.state if de else "UNKNOWN",
                }))
            except Exception:
                logger.exception("failed to publish ops event")
            logger.info("processed delivery %s -> confidence=%.2f", delivery_id, confidence)
    finally:
        db.close()


if __name__ == "__main__":
    main_loop()
