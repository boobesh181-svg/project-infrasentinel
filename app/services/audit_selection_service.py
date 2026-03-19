import random
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.material_entry import MaterialEntry, MaterialStatus
from app.models.project import Project


class AuditSelectionService:
    def __init__(self, session: Session) -> None:
        self._session = session

    def select_random_audits(self, *, organization_id: UUID, percentage: float = 0.05) -> list[UUID]:
        stmt = (
            select(MaterialEntry)
            .join(Project, Project.id == MaterialEntry.project_id)
            .where(
                Project.organization_id == organization_id,
                MaterialEntry.status.in_([MaterialStatus.SUBMITTED, MaterialStatus.VERIFIED]),
            )
        )
        candidates = list(self._session.execute(stmt).scalars().all())
        if not candidates:
            return []

        selected_count = max(1, int(len(candidates) * percentage))
        selected = random.sample(candidates, k=min(selected_count, len(candidates)))
        for entry in selected:
            entry.audit_required = True
        return [entry.id for entry in selected]
