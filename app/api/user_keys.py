from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db
from app.models.user import User
from app.models.user_key import UserKey
from app.schemas.user_key import UserKeyCreateIn, UserKeyOut
from app.services.audit_service import AuditService

router = APIRouter(prefix="/user-keys", tags=["user-keys"])


@router.post("/me", response_model=UserKeyOut)
def register_user_key(
    payload: UserKeyCreateIn,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
) -> UserKeyOut:
    existing = db.execute(select(UserKey).where(UserKey.user_id == actor.id)).scalar_one_or_none()
    if existing is None:
        key = UserKey(user_id=actor.id, public_key=payload.public_key)
        db.add(key)
        db.flush()
        previous_state = {}
    else:
        previous_state = {
            "public_key": existing.public_key,
            "created_at": existing.created_at.isoformat(),
        }
        existing.public_key = payload.public_key
        key = existing
        db.flush()

    AuditService(db).log(
        performed_by_id=actor.id,
        entity_type="UserKey",
        entity_id=key.id,
        action="USER_KEY_REGISTERED",
        previous_state=previous_state,
        new_state={
            "user_id": str(key.user_id),
            "public_key": key.public_key,
            "created_at": key.created_at.isoformat(),
        },
    )
    db.commit()
    db.refresh(key)
    return key


@router.get("/me", response_model=UserKeyOut | None)
def get_my_key(
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
) -> UserKeyOut | None:
    return db.execute(select(UserKey).where(UserKey.user_id == actor.id)).scalar_one_or_none()
