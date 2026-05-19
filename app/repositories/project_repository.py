from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.project import Project


class ProjectRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def get_for_org(self, *, project_id: UUID, organization_id: UUID) -> Project | None:
        stmt = select(Project).where(Project.id == project_id, Project.organization_id == organization_id)
        return self._session.execute(stmt).scalar_one_or_none()
