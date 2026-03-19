from collections import defaultdict
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.evidence_file import EvidenceFile
from app.models.material_entry import MaterialEntry
from app.models.project import Project


class EvidenceIntegrityService:
    def __init__(self, session: Session) -> None:
        self._session = session

    def refresh_duplicate_flags(self, *, organization_id: UUID | None = None) -> list[UUID]:
        stmt = (
            select(EvidenceFile, Project.id)
            .join(MaterialEntry, MaterialEntry.id == EvidenceFile.material_entry_id)
            .join(Project, Project.id == MaterialEntry.project_id)
        )
        if organization_id is not None:
            stmt = stmt.where(Project.organization_id == organization_id)

        rows = list(self._session.execute(stmt).all())
        by_hash: dict[str, list[tuple[EvidenceFile, UUID]]] = defaultdict(list)
        for evidence, project_id in rows:
            by_hash[evidence.file_hash].append((evidence, project_id))

        suspicious_entries: set[UUID] = set()
        for evidence_hash, evidence_rows in by_hash.items():
            entry_ids = {evidence.material_entry_id for evidence, _ in evidence_rows}
            is_duplicate_across_entries = len(entry_ids) > 1
            for evidence, _ in evidence_rows:
                evidence.duplicate_flag = is_duplicate_across_entries
                if is_duplicate_across_entries:
                    suspicious_entries.add(evidence.material_entry_id)

        return sorted(suspicious_entries)

    def list_suspicious_entries(self, *, organization_id: UUID) -> list[MaterialEntry]:
        self.refresh_duplicate_flags(organization_id=organization_id)

        stmt = (
            select(MaterialEntry)
            .join(Project, Project.id == MaterialEntry.project_id)
            .join(EvidenceFile, EvidenceFile.material_entry_id == MaterialEntry.id)
            .where(
                Project.organization_id == organization_id,
                EvidenceFile.duplicate_flag.is_(True),
            )
            .distinct()
            .order_by(MaterialEntry.created_at.desc())
        )
        return list(self._session.execute(stmt).scalars().all())
