from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.material_entry import MaterialEntry, MaterialStatus


class MaterialService:
    def __init__(self, session: Session) -> None:
        self._session = session

    def create_entry(
        self,
        *,
        project_id: UUID,
        user_id: UUID,
        material_name: str,
        quantity: float,
        factor_version_snapshot: int,
        factor_value_snapshot: float,
        factor_unit_snapshot: str,
        factor_source_snapshot: str,
    ) -> MaterialEntry:
        with self._session.begin():
            entry = MaterialEntry(
                project_id=project_id,
                material_name=material_name,
                quantity=quantity,
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
