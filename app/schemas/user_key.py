from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class UserKeyCreateIn(BaseModel):
    public_key: str


class UserKeyOut(BaseModel):
    id: UUID
    user_id: UUID
    public_key: str
    created_at: datetime

    class Config:
        orm_mode = True
