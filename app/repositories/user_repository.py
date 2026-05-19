from uuid import UUID

from sqlalchemy.orm import Session

from app.models.user import User


class UserRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def get(self, *, user_id: UUID) -> User | None:
        return self._session.get(User, user_id)
