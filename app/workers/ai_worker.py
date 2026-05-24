"""Simple AI worker stub — isolates model processing for delivery events.

This worker is intentionally minimal in the repo scaffold: it should be run as a separate process
and subscribe to the real event bus (Redis/Kafka) in a production design. For demo it provides
an example loop that would process events and write VerificationResult entries.
"""
import asyncio
import logging

from app.db.session import SessionLocal
from app.models.verification_result import VerificationResult

logger = logging.getLogger("infrasentinel.ai_worker")


async def process_loop(poll_interval: float = 2.0):
    logger.info("AI worker starting (stub)")
    while True:
        # In production: claim events from Redis stream and process them.
        await asyncio.sleep(poll_interval)
        # This stub does nothing but could be extended to run model inference.


def main() -> None:
    try:
        asyncio.run(process_loop())
    except KeyboardInterrupt:
        logger.info("AI worker stopped")


if __name__ == "__main__":
    main()
