from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.evidence_file import EvidenceFile


class EvidenceRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def list_for_entry(self, *, entry_id: UUID) -> list[EvidenceFile]:
        stmt = select(EvidenceFile).where(EvidenceFile.material_entry_id == entry_id)
        return list(self._session.execute(stmt).scalars().all())

    def list_for_entry_paginated(self, *, entry_id: UUID, limit: int, offset: int) -> list[EvidenceFile]:
        stmt = (
            select(EvidenceFile)
            .where(EvidenceFile.material_entry_id == entry_id)
            .limit(limit)
            .offset(offset)
        )
        return list(self._session.execute(stmt).scalars().all())

    def count_for_entry(self, *, entry_id: UUID) -> int:
        stmt = select(func.count(EvidenceFile.id)).where(EvidenceFile.material_entry_id == entry_id)
        return int(self._session.execute(stmt).scalar_one())

    def get(self, *, evidence_id: UUID) -> EvidenceFile | None:
        return self._session.get(EvidenceFile, evidence_id)
