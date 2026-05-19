from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.material_entry import MaterialEntry, MaterialStatus
from app.models.project import Project
from app.models.user import User


class MaterialService:
    def __init__(self, session: Session) -> None:
        self._session = session

    def create_entry(
        self,
        *,
        project_id: UUID,
        user_id: UUID,
        organization_id: UUID,
        material_name: str,
        quantity: float,
        supplier_name: str | None,
        supplier_email: str | None,
        factor_version_snapshot: int,
        factor_value_snapshot: float,
        factor_unit_snapshot: str,
        factor_source_snapshot: str,
    ) -> MaterialEntry:
        with self._session.begin():
            user = self._session.get(User, user_id)
            if user is None:
                raise ValueError("User not found")

            project = self._session.get(Project, project_id)
            if project is None:
                raise ValueError("Project not found")
            if project.organization_id != organization_id:
                raise ValueError("Forbidden: project is outside your organization")

            entry = MaterialEntry(
                project_id=project_id,
                material_name=material_name,
                quantity=quantity,
                supplier_name=supplier_name,
                supplier_email=supplier_email,
                factor_version_snapshot=factor_version_snapshot,
                factor_value_snapshot=factor_value_snapshot,
                factor_unit_snapshot=factor_unit_snapshot,
                factor_source_snapshot=factor_source_snapshot,
                calculated_emission=quantity * factor_value_snapshot,
                status=MaterialStatus.DRAFT,
                created_by_id=user_id,
                created_at=datetime.now(timezone.utc),
            )
            self._session.add(entry)
            return entry
