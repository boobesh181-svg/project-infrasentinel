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
from app.models.material_entry import MaterialEntry, MaterialStatus
from app.models.organization import Organization
from app.models.project import Project
from app.models.user import User, UserRole


@compiles(PgUUID, "sqlite")
def _compile_uuid_sqlite(_type, _compiler, **_kwargs) -> str:
    return "CHAR(36)"


@compiles(JSONB, "sqlite")
def _compile_jsonb_sqlite(_type, _compiler, **_kwargs) -> str:
    return "TEXT"


@pytest.fixture(scope="session")
def engine(tmp_path_factory):
    db_path = tmp_path_factory.mktemp("dashboard_db") / "test.db"
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


def _seed_dashboard_data(session):
    suffix = uuid4().hex[:8]
    org = Organization(name=f"DashOrg-{suffix}")
    session.add(org)
    session.flush()

    creator = _create_user(
        session,
        org=org,
        role=UserRole.CREATOR,
        email=f"creator-{suffix}@example.com",
        password="creator-pass",
    )

    project = Project(
        organization_id=org.id,
        created_by_id=creator.id,
        name="Dashboard Project",
        location="Chennai",
        reporting_period_start=date(2026, 1, 1),
        reporting_period_end=date(2026, 12, 31),
    )
    session.add(project)
    session.flush()

    session.add(
        MaterialEntry(
            project_id=project.id,
            material_name="Concrete",
            quantity=100,
            factor_version_snapshot=1,
            factor_value_snapshot=0.25,
            factor_unit_snapshot="tCO2e/m3",
            factor_source_snapshot="seed",
            calculated_emission=25,
            status=MaterialStatus.VERIFIED,
            created_by_id=creator.id,
            verified_by_id=creator.id,
            temporal_anomaly=False,
            audit_required=False,
            ai_risk_score=0.15,
            ai_risk_level="LOW",
        )
    )
    session.add(
        MaterialEntry(
            project_id=project.id,
            material_name="Steel",
            quantity=50,
            factor_version_snapshot=1,
            factor_value_snapshot=1.80,
            factor_unit_snapshot="tCO2e/ton",
            factor_source_snapshot="seed",
            calculated_emission=90,
            status=MaterialStatus.APPROVED,
            created_by_id=creator.id,
            verified_by_id=creator.id,
            temporal_anomaly=True,
            audit_required=True,
            ai_risk_score=0.91,
            ai_risk_level="HIGH",
        )
    )
    session.commit()
    return creator


def test_dashboard_summary_returns_metrics_and_pagination(client, db_session):
    creator = _seed_dashboard_data(db_session)
    header = _auth_header(client, creator.email, "creator-pass")

    resp = client.get("/dashboard/summary?limit=5&offset=0", headers=header)
    assert resp.status_code == 200
    payload = resp.json()

    assert payload["metrics"]["number_of_projects"] >= 1
    assert payload["metrics"]["total_emissions_verified"] >= 0
    assert payload["metrics"]["anomalies_detected"] >= 1
    assert payload["pagination"]["limit"] == 5
    assert payload["pagination"]["offset"] == 0


def test_dashboard_emissions_returns_project_rows(client, db_session):
    creator = _seed_dashboard_data(db_session)
    header = _auth_header(client, creator.email, "creator-pass")

    resp = client.get("/dashboard/emissions?limit=10&offset=0", headers=header)
    assert resp.status_code == 200
    payload = resp.json()

    assert payload["pagination"]["limit"] == 10
    assert len(payload["items"]) >= 1
    assert payload["items"][0]["total_verified_emissions"] >= 0


def test_dashboard_anomalies_only_returns_flagged_entries(client, db_session):
    creator = _seed_dashboard_data(db_session)
    header = _auth_header(client, creator.email, "creator-pass")

    resp = client.get("/dashboard/anomalies?limit=10&offset=0", headers=header)
    assert resp.status_code == 200
    payload = resp.json()

    assert len(payload["items"]) >= 1
    for item in payload["items"]:
        assert (
            item["temporal_anomaly"]
            or item["audit_required"]
            or (item["ai_risk_score"] is not None and item["ai_risk_score"] > 0.6)
        )
