import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db
from app.models.notification import Notification, ResponseType
from app.models.user import User
from app.schemas.notification import NotificationListOut, NotificationOut
from app.services.notification_service import NotificationService

logger = logging.getLogger("infrasentinel")

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=NotificationListOut)
def list_notifications(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    limit: int = Query(50, ge=1),
    offset: int = Query(0, ge=0),
) -> NotificationListOut:
    items_stmt = (
        select(Notification)
        .where(Notification.notified_user_id == user.id)
        .limit(limit)
        .offset(offset)
    )
    count_stmt = select(func.count(Notification.id)).where(Notification.notified_user_id == user.id)
    return NotificationListOut(
        total=int(db.execute(count_stmt).scalar_one()),
        items=list(db.execute(items_stmt).scalars().all()),
    )


@router.post("/{notification_id}/acknowledge", response_model=NotificationOut)
def acknowledge_notification(
    notification_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> NotificationOut:
    notification = db.get(Notification, notification_id)
    if notification is None:
        exists = db.get(Notification, notification_id) is not None
        logger.warning(
            "404 resource not found",
            extra={
                "resource": "notification",
                "requested_id": str(notification_id),
                "user_id": str(user.id),
                "user_email": user.email,
                "user_org": str(user.organization_id),
                "db_exists": exists,
                "org_mismatch": False,
            },
        )
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    if notification.notified_user_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    service = NotificationService(db)
    return service.resolve_notification(
        notification_id=notification_id,
        response_type=ResponseType.ACKNOWLEDGED,
        actor_user_id=user.id,
    )


@router.post("/{notification_id}/dispute", response_model=NotificationOut)
def dispute_notification(
    notification_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> NotificationOut:
    notification = db.get(Notification, notification_id)
    if notification is None:
        exists = db.get(Notification, notification_id) is not None
        logger.warning(
            "404 resource not found",
            extra={
                "resource": "notification",
                "requested_id": str(notification_id),
                "user_id": str(user.id),
                "user_email": user.email,
                "user_org": str(user.organization_id),
                "db_exists": exists,
                "org_mismatch": False,
            },
        )
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    if notification.notified_user_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    service = NotificationService(db)
    return service.resolve_notification(
        notification_id=notification_id,
        response_type=ResponseType.DISPUTED,
        actor_user_id=user.id,
    )
