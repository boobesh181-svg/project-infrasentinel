from datetime import datetime, timedelta, timezone

from app.db.session import SessionLocal
from app.models.emission_factor import EmissionFactor
from app.models.notification import ResponseType
from app.models.organization import Organization
from app.models.project import Project
from app.models.user import User, UserRole
from app.services.material_service import MaterialService
from app.services.notification_service import NotificationService
from app.services.workflow_service import WorkflowService


def main() -> None:
    session = SessionLocal()
    with session.begin():
        org = Organization(name="Acme")
        session.add(org)
        session.flush()

        creator = User(
            organization_id=org.id,
            email="creator@example.com",
            full_name="Creator",
            role=UserRole.CREATOR,
        )
        verifier = User(
            organization_id=org.id,
            email="verifier@example.com",
            full_name="Verifier",
            role=UserRole.VERIFIER,
        )
        admin = User(
            organization_id=org.id,
            email="admin@example.com",
            full_name="Admin",
            role=UserRole.ADMIN,
        )
        session.add_all([creator, verifier, admin])
        session.flush()

        project = Project(organization_id=org.id, owner_id=creator.id, name="Project A")
        session.add(project)
        session.flush()

        factor = EmissionFactor(
            material_name="Steel",
            version=1,
            valid_from=datetime.now(timezone.utc).date(),
            value=1.23,
            unit="kg",
        )
        session.add(factor)
        session.flush()

        creator_id = creator.id
        verifier_id = verifier.id
        admin_id = admin.id
        project_id = project.id
        factor_id = factor.id
    session.close()

    session = SessionLocal()
    material_service = MaterialService(session)
    entry = material_service.create_entry(
        project_id=project_id,
        user_id=creator_id,
        emission_factor_id=factor_id,
        quantity=10.0,
    )
    entry_id = entry.id
    session.close()

    session = SessionLocal()
    notification_service = NotificationService(session)
    notification = notification_service.create_notification(
        user_id=creator_id,
        material_entry_id=entry_id,
        message="Please acknowledge",
        response_deadline=datetime.now(timezone.utc) + timedelta(days=1),
    )
    notification_id = notification.id
    session.close()

    session = SessionLocal()
    notification_service = NotificationService(session)
    notification = notification_service.set_response_type(
        notification_id=notification_id, response_type=ResponseType.ACKNOWLEDGED
    )
    session.close()

    session = SessionLocal()
    workflow_service = WorkflowService(session)
    workflow_service.submit(entry_id=entry_id, actor_user_id=creator_id)
    workflow_service.verify(entry_id=entry_id, actor_user_id=verifier_id)
    workflow_service.approve(entry_id=entry_id, actor_user_id=admin_id)
    workflow_service.lock(entry_id=entry_id, actor_user_id=admin_id)
    session.close()

    print("Workflow complete", notification_id, entry_id)


if __name__ == "__main__":
    main()
