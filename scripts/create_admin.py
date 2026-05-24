from app.db.session import SessionLocal
from app.core.security import get_password_hash
from app.models.user import User, UserRole
from app.models.organization import Organization


def main():
    from sqlalchemy import select

    session = SessionLocal()
    with session.begin():
        org_row = session.execute(select(Organization).limit(1)).scalar_one_or_none()
        if org_row is None:
            org = Organization(name="LocalOrg")
            session.add(org)
            session.flush()
            org_id = org.id
        else:
            org_id = org_row.id

        existing = session.execute(select(User).where(User.email == "admin@example.com")).scalar_one_or_none()
        if existing:
            print("admin@example.com already exists")
            return

        user = User(
            organization_id=org_id,
            email="admin@example.com",
            role=UserRole.ADMIN,
            hashed_password=get_password_hash("admin-pass"),
            is_active=True,
        )
        session.add(user)
    print("created admin@example.com")


if __name__ == "__main__":
    main()
