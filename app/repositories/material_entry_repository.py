from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.material_entry import MaterialEntry


class MaterialEntryRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def get_for_update(self, *, entry_id: UUID) -> MaterialEntry | None:
        stmt = select(MaterialEntry).where(MaterialEntry.id == entry_id).with_for_update()
        return self._session.execute(stmt).scalar_one_or_none()

    def get(self, *, entry_id: UUID) -> MaterialEntry | None:
        return self._session.get(MaterialEntry, entry_id)
