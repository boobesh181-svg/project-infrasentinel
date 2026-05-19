import json
from datetime import date
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException, Request, status
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.dialects.postgresql import JSONB, UUID as PgUUID
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import sessionmaker

from app.core.dependencies import get_current_user, get_db
from app.core.security import decode_access_token, get_password_hash
from app.db.base import Base
from app.main import app
from app.models.organization import Organization
from app.models.user import User, UserRole


@compiles(PgUUID, "sqlite")
def _compile_uuid_sqlite(_type, _compiler, **_kwargs) -> str:
    return "CHAR(36)"


@compiles(JSONB, "sqlite")
def _compile_jsonb_sqlite(_type, _compiler, **_kwargs) -> str:
    return "TEXT"


@pytest.fixture(scope="session")
def engine(tmp_path_factory):
    db_path = tmp_path_factory.mktemp("tenant_isolation_db") / "test.db"
    engine = create_engine(
        f"sqlite:///{db_path}",
        connect_args={"check_same_thread": False},
        json_serializer=lambda value: json.dumps(value, default=str),
    )
    Base.metadata.create_all(bind=engine)
    return engine


@pytest.fixture(scope="function")
def db_session(engine):
    SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture(scope="function")
def client(db_session):
    TestSessionLocal = sessionmaker(bind=db_session.bind, autocommit=False, autoflush=False)

    def _override_get_db():
        request_session = TestSessionLocal()
        try:
            yield request_session
        finally:
            request_session.close()

    def _override_get_current_user(request: Request):
        auth_header = request.headers.get("authorization", "")
        token = auth_header.removeprefix("Bearer ").strip()
        if not token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
            )
        try:
            payload = decode_access_token(token)
            user_id = UUID(payload.get("sub", ""))
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
            ) from exc

        AuthSessionLocal = sessionmaker(bind=db_session.bind, autocommit=False, autoflush=False)
        auth_session = AuthSessionLocal()
        try:
            user = auth_session.get(User, user_id)
            if user is None or not user.is_active:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid authentication credentials",
                )
            auth_session.expunge(user)
            return user
        finally:
            auth_session.close()

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_current_user] = _override_get_current_user

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


def _create_user(session, *, org, role, email, password):
    user = User(
        organization_id=org.id,
        email=email,
        hashed_password=get_password_hash(password),
        role=role,
        is_active=True,
    )
    session.add(user)
    session.flush()
    return user


def _auth_header(client, email, password):
    resp = client.post("/auth/login", data={"username": email, "password": password})
    assert resp.status_code == 200
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _create_project(client, header, name: str) -> str:
    payload = {
        "name": name,
        "location": "Test City",
        "reporting_period_start": str(date(2026, 1, 1)),
        "reporting_period_end": str(date(2026, 12, 31)),
    }
    resp = client.post("/projects", json=payload, headers=header)
    assert resp.status_code == 200
    return resp.json()["id"]


def _create_entry(client, header, project_id: str) -> str:
    payload = {
        "project_id": project_id,
        "material_name": "Concrete",
        "quantity": 10.0,
        "factor_version_snapshot": 1,
        "factor_value_snapshot": 0.25,
        "factor_unit_snapshot": "tCO2e/m3",
        "factor_source_snapshot": "seed",
    }
    resp = client.post("/material-entries", json=payload, headers=header)
    assert resp.status_code == 200
    return resp.json()["id"]


def _seed_two_orgs(db_session):
    suffix = uuid4().hex[:6]
    org_a = Organization(name=f"OrgA-{suffix}")
    org_b = Organization(name=f"OrgB-{suffix}")
    db_session.add_all([org_a, org_b])
    db_session.flush()

    creator_a = _create_user(
        db_session,
        org=org_a,
        role=UserRole.CREATOR,
        email=f"creator-a-{suffix}@example.com",
        password="creator-pass",
    )
    verifier_a = _create_user(
        db_session,
        org=org_a,
        role=UserRole.VERIFIER,
        email=f"verifier-a-{suffix}@example.com",
        password="verifier-pass",
    )

    creator_b = _create_user(
        db_session,
        org=org_b,
        role=UserRole.CREATOR,
        email=f"creator-b-{suffix}@example.com",
        password="creator-pass",
    )

    db_session.commit()
    return creator_a, verifier_a, creator_b


def test_user_cannot_access_project_from_other_org(client, db_session):
    creator_a, _, creator_b = _seed_two_orgs(db_session)

    header_a = _auth_header(client, creator_a.email, "creator-pass")
    header_b = _auth_header(client, creator_b.email, "creator-pass")

    project_b = _create_project(client, header_b, "Project-B")
    resp = client.get(f"/projects/{project_b}", headers=header_a)

    assert resp.status_code == 403


def test_user_cannot_create_entry_for_other_org_project(client, db_session):
    creator_a, _, creator_b = _seed_two_orgs(db_session)

    header_a = _auth_header(client, creator_a.email, "creator-pass")
    header_b = _auth_header(client, creator_b.email, "creator-pass")

    project_b = _create_project(client, header_b, "Project-B-Entry")
    payload = {
        "project_id": project_b,
        "material_name": "Steel",
        "quantity": 11.0,
        "factor_version_snapshot": 1,
        "factor_value_snapshot": 1.2,
        "factor_unit_snapshot": "tCO2e/ton",
        "factor_source_snapshot": "seed",
    }

    resp = client.post("/material-entries", json=payload, headers=header_a)
    assert resp.status_code == 403


def test_workflow_actions_fail_across_tenants(client, db_session):
    creator_a, verifier_a, creator_b = _seed_two_orgs(db_session)

    header_b = _auth_header(client, creator_b.email, "creator-pass")
    header_verifier_a = _auth_header(client, verifier_a.email, "verifier-pass")

    project_b = _create_project(client, header_b, "Project-B-Workflow")
    entry_b = _create_entry(client, header_b, project_b)

    submit_resp = client.post(f"/material-entries/{entry_b}/submit", headers=header_b)
    assert submit_resp.status_code == 200

    verify_resp = client.post(f"/material-entries/{entry_b}/verify", headers=header_verifier_a)
    assert verify_resp.status_code in {403, 404}
