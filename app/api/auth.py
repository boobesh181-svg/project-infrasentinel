from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db, oauth2_scheme
from app.core.observability import record_auth_failure
from app.core.rate_limit import limiter
from app.core.security import create_access_token, decode_access_token, revoke_token_jti, verify_password
from app.models.user import User
from app.schemas.auth import Token

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=Token)
@limiter.limit("5/minute")
def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
) -> Token:
    del request
    stmt = select(User).where(User.email == form_data.username)
    user = db.execute(stmt).scalar_one_or_none()
    if user is None or not user.is_active or not verify_password(form_data.password, user.hashed_password):
        reason = "invalid_credentials"
        if user is not None and not user.is_active:
            reason = "inactive_user"
        record_auth_failure(reason=reason)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    access_token = create_access_token(subject=str(user.id), organization_id=str(user.organization_id))
    return Token(access_token=access_token, token_type="bearer")


@router.post("/rotate", response_model=Token)
def rotate_access_token(
    token: str = Depends(oauth2_scheme),
    actor: User = Depends(get_current_user),
) -> Token:
    payload = decode_access_token(token)
    jti = payload.get("jti")
    if isinstance(jti, str):
        exp = payload.get("exp")
        exp_dt = None
        if isinstance(exp, (int, float)):
            exp_dt = datetime.fromtimestamp(float(exp), tz=timezone.utc)
        revoke_token_jti(jti, exp=exp_dt)

    rotated = create_access_token(subject=str(actor.id), organization_id=str(actor.organization_id))
    return Token(access_token=rotated, token_type="bearer")
