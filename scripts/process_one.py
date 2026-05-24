"""Process a single item from the ingest queue (helper for local demos)."""
import json
import sys
import redis

from app.core.config import get_settings
from app.db.session import SessionLocal
from app.models.verification_result import VerificationResult
from app.models.delivery_event import DeliveryEvent


def main():
    settings = get_settings()
    r = redis.from_url(settings.redis_url)
    item = r.brpop("ingest:queue", timeout=1)
    if not item:
        print("no-item")
        return 0
    _, raw = item
    payload = json.loads(raw)
    delivery_id = payload.get("delivery_id")
    confidence = 0.95 if "acme" in (payload.get("supplier", "").lower()) else 0.75
    db = SessionLocal()
    vr = VerificationResult(delivery_event_id=delivery_id, analyzer="oneoff", confidence=confidence, reasoning="one-off")
    db.add(vr)
    de = db.query(DeliveryEvent).filter(DeliveryEvent.id == delivery_id).one_or_none()
    if de:
        de.confidence = confidence
        de.state = "VERIFIED" if confidence > 0.8 else "REVIEW"
        db.add(de)
    db.commit()
    print("processed", delivery_id)
    return 0


if __name__ == "__main__":
    sys.exit(main())
