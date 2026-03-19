from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.models.notification import ResponseType


class NotificationOut(BaseModel):
    id: UUID
    entity_type: str
    entity_id: UUID
    notified_user_id: UUID
    response_type: ResponseType
    response_deadline: datetime
    notified_at: datetime
    responded_at: datetime | None

    class Config:
        orm_mode = True


class NotificationListOut(BaseModel):
    total: int
    items: list[NotificationOut]
