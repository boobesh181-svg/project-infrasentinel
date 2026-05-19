from __future__ import annotations

from datetime import datetime, timedelta, timezone
import logging
import time

from redis import Redis
from redis.exceptions import RedisError

from app.core.config import get_settings

logger = logging.getLogger("infrasentinel.auth")

_REVOKED_TOKEN_KEY_PREFIX = "auth:revoked:jti:"
_redis_client: Redis | None = None
_redis_disabled_until: float = 0.0
_REDIS_RETRY_COOLDOWN_SECONDS = 30


def _get_redis_client() -> Redis:
    global _redis_client
    if _redis_client is None:
        settings = get_settings()
        _redis_client = Redis.from_url(
            settings.redis_url,
            decode_responses=True,
            socket_connect_timeout=0.2,
            socket_timeout=0.2,
            health_check_interval=30,
        )
    return _redis_client


def _redis_temporarily_disabled() -> bool:
    return time.time() < _redis_disabled_until


def _mark_redis_unavailable() -> None:
    global _redis_disabled_until
    _redis_disabled_until = time.time() + _REDIS_RETRY_COOLDOWN_SECONDS


def _revoked_token_key(jti: str) -> str:
    return f"{_REVOKED_TOKEN_KEY_PREFIX}{jti}"


def _ttl_seconds(exp: datetime | None) -> int:
    now = datetime.now(timezone.utc)
    if exp is None:
        settings = get_settings()
        exp = now + timedelta(minutes=settings.access_token_expire_minutes)

    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)

    ttl = int((exp - now).total_seconds())
    return max(ttl, 1)


def revoke_token(jti: str, *, exp: datetime | None = None) -> None:
    if not jti:
        return

    if _redis_temporarily_disabled():
        logger.warning("Skipping token revocation write because Redis is temporarily unavailable")
        return

    try:
        _get_redis_client().set(_revoked_token_key(jti), "1", ex=_ttl_seconds(exp))
    except RedisError:
        _mark_redis_unavailable()
        logger.warning("Failed to revoke token jti in Redis; revocation store temporarily unavailable")


def is_token_revoked(jti: str) -> bool:
    if not jti:
        return False

    if _redis_temporarily_disabled():
        return False

    try:
        return bool(_get_redis_client().exists(_revoked_token_key(jti)))
    except RedisError:
        _mark_redis_unavailable()
        logger.warning("Failed to read token revocation status from Redis; revocation checks temporarily bypassed")
        return False
