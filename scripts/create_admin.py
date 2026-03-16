import sys
from getpass import getpass

from sqlalchemy import select

from app.core.config import get_settings
from app.core.security import get_password_hash
from app.db.session import SessionLocal
from app.models.organization import Organization
from app.models.user import User, UserRole


def _ensure_organization(session) -> Organization:
    organization = session.execute(select(Organization).limit(1)).scalar_one_or_none()
    if organization is not None:
        return organization

    organization = Organization(name="Default Organization")
    session.add(organization)
    session.flush()
    return organization


def main() -> int:
    _ = get_settings()  # Load env config via BaseSettings

    email = input("Admin email: ").strip()
    if not email:
        print("Email is required.")
        return 1

    password = getpass("Admin password: ").strip()
    if not password:
        print("Password is required.")
        return 1

    with SessionLocal() as session:
        existing_admin = session.execute(
            select(User).where(User.role == UserRole.ADMIN).limit(1)
        ).scalar_one_or_none()
        if existing_admin is not None:
            print("Admin user already exists. No changes made.")
            return 0

        with session.begin():
            organization = _ensure_organization(session)
            admin = User(
                organization_id=organization.id,
                email=email,
                hashed_password=get_password_hash(password),
                role=UserRole.ADMIN,
                is_active=True,
            )
            session.add(admin)

    print("Admin user created successfully.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
