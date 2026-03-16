import io
import os
from datetime import date
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.dialects.postgresql import JSONB, UUID as PgUUID
from sqlalchemy.ext.compiler import compiles

from app.core.dependencies import get_db
from app.core.security import get_password_hash
from app.db.base import Base
from app.models.organization import Organization
from app.models.user import User, UserRole
from app.main import app


@compiles(PgUUID, "sqlite")
def _compile_uuid_sqlite(_type, _compiler, **_kwargs) -> str:
    return "CHAR(36)"


@compiles(JSONB, "sqlite")
def _compile_jsonb_sqlite(_type, _compiler, **_kwargs) -> str:
    return "TEXT"


@pytest.fixture(scope="session")
def engine(tmp_path_factory):
    db_path = tmp_path_factory.mktemp("db") / "test.db"
    engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
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
def client(db_session, monkeypatch):
    def _override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = _override_get_db

    # Ensure deterministic notification deadline
    monkeypatch.setenv("NOTIFICATION_RESPONSE_HOURS", "1")
    monkeypatch.setenv("EVIDENCE_MAX_BYTES", "10485760")

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
    resp = client.post(
        "/auth/login",
        data={"username": email, "password": password},
    )
    assert resp.status_code == 200
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _seed_users(session):
    org = Organization(name=f"Org-{uuid4()}")
    session.add(org)
    session.flush()

    creator = _create_user(
        session,
        org=org,
        role=UserRole.CREATOR,
        email="creator@example.com",
        password="creator-pass",
    )
    verifier = _create_user(
        session,
        org=org,
        role=UserRole.VERIFIER,
        email="verifier@example.com",
        password="verifier-pass",
    )
    approver = _create_user(
        session,
        org=org,
        role=UserRole.APPROVER,
        email="approver@example.com",
        password="approver-pass",
    )
    admin = _create_user(
        session,
        org=org,
        role=UserRole.ADMIN,
        email="admin@example.com",
        password="admin-pass",
    )

    return org, creator, verifier, approver, admin


def test_workflow_end_to_end(client, db_session, tmp_path):
    org, creator, verifier, approver, admin = _seed_users(db_session)
    db_session.commit()

    creator_header = _auth_header(client, "creator@example.com", "creator-pass")
    verifier_header = _auth_header(client, "verifier@example.com", "verifier-pass")
    approver_header = _auth_header(client, "approver@example.com", "approver-pass")
    admin_header = _auth_header(client, "admin@example.com", "admin-pass")

    # 1) Creator creates project
    project_payload = {
        "name": "Project A",
        "location": "Chennai",
        "reporting_period_start": str(date(2026, 1, 1)),
        "reporting_period_end": str(date(2026, 12, 31)),
    }
    project_resp = client.post("/projects", json=project_payload, headers=creator_header)
    assert project_resp.status_code == 200
    project_id = project_resp.json()["id"]

    # 2) Creator creates MaterialEntry (DRAFT)
    entry_payload = {
        "project_id": project_id,
        "material_name": "Steel",
        "quantity": 10.5,
        "factor_version_snapshot": 1,
        "factor_value_snapshot": 1.25,
        "factor_unit_snapshot": "kgCO2e/kg",
        "factor_source_snapshot": "IPCC",
    }
    entry_resp = client.post(
        "/material-entries",
        json=entry_payload,
        headers=creator_header,
    )
    assert entry_resp.status_code == 200
    entry = entry_resp.json()
    assert entry["status"] == "DRAFT"
    entry_id = entry["id"]

    # 3) Creator submits entry
    submit_resp = client.post(
        f"/material-entries/{entry_id}/submit",
        headers=creator_header,
    )
    assert submit_resp.status_code == 200
    assert submit_resp.json()["status"] == "SUBMITTED"

    # 4) Notifications created for owner and verifier
    creator_notifications = client.get("/notifications", headers=creator_header).json()
    verifier_notifications = client.get("/notifications", headers=verifier_header).json()
    assert len(creator_notifications) == 1
    assert len(verifier_notifications) == 1

    # 5) Verification blocked if no evidence
    verify_resp = client.post(
        f"/material-entries/{entry_id}/verify",
        headers=verifier_header,
    )
    assert verify_resp.status_code == 409
    assert "no evidence" in verify_resp.json()["detail"].lower()

    # 6) Evidence uploaded
    file_content = b"sample evidence"
    file_upload = {
        "file": ("evidence.txt", file_content, "text/plain"),
    }
    evidence_resp = client.post(
        f"/material-entries/{entry_id}/evidence",
        files=file_upload,
        headers=creator_header,
    )
    assert evidence_resp.status_code == 200
    evidence_path = evidence_resp.json()["storage_path"]

    # 7) Clear notifications and verify
    for note in creator_notifications:
        ack = client.post(
            f"/notifications/{note['id']}/acknowledge",
            headers=creator_header,
        )
        assert ack.status_code == 200
    for note in verifier_notifications:
        ack = client.post(
            f"/notifications/{note['id']}/acknowledge",
            headers=verifier_header,
        )
        assert ack.status_code == 200

    verify_resp = client.post(
        f"/material-entries/{entry_id}/verify",
        headers=verifier_header,
    )
    assert verify_resp.status_code == 200
    assert verify_resp.json()["status"] == "VERIFIED"

    # 8) Approval allowed only by APPROVER
    bad_approve = client.post(
        f"/material-entries/{entry_id}/approve",
        headers=verifier_header,
    )
    assert bad_approve.status_code == 403

    approve_resp = client.post(
        f"/material-entries/{entry_id}/approve",
        headers=approver_header,
    )
    assert approve_resp.status_code == 200
    assert approve_resp.json()["status"] == "APPROVED"

    # 9) Lock allowed only by ADMIN
    bad_lock = client.post(
        f"/material-entries/{entry_id}/lock",
        headers=approver_header,
    )
    assert bad_lock.status_code == 403

    lock_resp = client.post(
        f"/material-entries/{entry_id}/lock",
        headers=admin_header,
    )
    assert lock_resp.status_code == 200
    assert lock_resp.json()["status"] == "LOCKED"

    # 10) Locked entries cannot change state
    submit_locked = client.post(
        f"/material-entries/{entry_id}/submit",
        headers=creator_header,
    )
    assert submit_locked.status_code == 409

    # Cleanup evidence file
    if evidence_path and os.path.exists(evidence_path):
        os.remove(evidence_path)
