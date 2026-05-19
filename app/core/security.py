from datetime import datetime, timedelta, timezone
import uuid
from typing import Any, Optional

import bcrypt as _bcrypt
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import get_settings
from app.core.token_revocation import is_token_revoked as _is_token_revoked
from app.core.token_revocation import revoke_token as _revoke_token

if not hasattr(_bcrypt, "__about__"):
    class _BcryptAbout:
        __version__ = getattr(_bcrypt, "__version__", "unknown")

    _bcrypt.__about__ = _BcryptAbout()

_original_hashpw = _bcrypt.hashpw


def _safe_hashpw(secret: bytes, salt: bytes) -> bytes:
    if len(secret) > 72:
        secret = secret[:72]
    return _original_hashpw(secret, salt)


_bcrypt.hashpw = _safe_hashpw

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__truncate_error=False,
)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(
    *,
    subject: str,
    organization_id: str,
    expires_delta: Optional[timedelta] = None,
) -> str:
    settings = get_settings()
    expire = datetime.now(timezone.utc) + (
        expires_delta
        if expires_delta is not None
        else timedelta(minutes=settings.access_token_expire_minutes)
    )
    to_encode: dict[str, Any] = {
        "sub": subject,
        "org": organization_id,
        "iss": settings.jwt_issuer,
        "aud": settings.jwt_audience,
        "exp": expire,
        "jti": str(uuid.uuid4()),
    }
    return jwt.encode(to_encode, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
            options={"verify_aud": False},
        )
    except JWTError as exc:
        raise ValueError("Invalid token") from exc

    issuer = payload.get("iss")
    if issuer is not None and issuer != settings.jwt_issuer:
        raise ValueError("Invalid token issuer")

    audience = payload.get("aud")
    if audience is not None and audience != settings.jwt_audience:
        raise ValueError("Invalid token audience")

    jti = payload.get("jti")
    if isinstance(jti, str) and is_token_revoked(jti):
        raise ValueError("Token has been revoked")

    return payload


def revoke_token_jti(jti: str, *, exp: datetime | None = None) -> None:
    _revoke_token(jti, exp=exp)


def is_token_revoked(jti: str) -> bool:
    return _is_token_revoked(jti)
