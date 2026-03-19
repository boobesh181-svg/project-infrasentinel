from collections import defaultdict
from datetime import timedelta
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.evidence_file import EvidenceFile
from app.models.material_entry import MaterialEntry
from app.models.project import Project


class TemporalIntegrityService:
    def __init__(self, session: Session) -> None:
        self._session = session

    def evaluate_entry(self, *, entry: MaterialEntry) -> bool:
        stmt = (
            select(EvidenceFile)
            .where(EvidenceFile.material_entry_id == entry.id)
            .order_by(EvidenceFile.uploaded_at.asc())
        )
        evidence_files = list(self._session.execute(stmt).scalars().all())
        if not evidence_files:
            entry.temporal_anomaly = False
            return False

        late_upload = False
        if entry.submitted_at:
            # Flag if evidence arrived far after submission.
            late_upload = any(
                evidence.uploaded_at > entry.submitted_at + timedelta(hours=24)
                for evidence in evidence_files
            )

        # Flag unusually dense upload bursts (>=5 files within 5 minutes).
        burst_detected = False
        windows: defaultdict[int, int] = defaultdict(int)
        for evidence in evidence_files:
            key = int(evidence.uploaded_at.timestamp() // 300)
            windows[key] += 1
            if windows[key] >= 5:
                burst_detected = True
                break

        anomaly = late_upload or burst_detected
        entry.temporal_anomaly = anomaly
        return anomaly

    def evaluate_organization(self, *, organization_id: UUID) -> list[UUID]:
        stmt = (
            select(MaterialEntry)
            .join(Project, Project.id == MaterialEntry.project_id)
            .where(Project.organization_id == organization_id)
        )
        entries = list(self._session.execute(stmt).scalars().all())
        anomalous_entries: list[UUID] = []
        for entry in entries:
            if self.evaluate_entry(entry=entry):
                anomalous_entries.append(entry.id)
        return anomalous_entries
