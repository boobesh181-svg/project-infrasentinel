import io
import json
import os
import sys
import types
from datetime import date, datetime, timedelta, timezone
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException, Request, status
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.dialects.postgresql import JSONB, UUID as PgUUID
from sqlalchemy.ext.compiler import compiles

from app.core.dependencies import get_current_user, get_db
from app.core.security import decode_access_token, get_password_hash
from app.db.base import Base
from app.models.emission_factor import EmissionFactor
from app.models.bim_material import BIMMaterial
from app.models.bim_material_estimate import BIMMaterialEstimate
from app.models.bim_model import BIMModel, BIMProcessingStatus
from app.models.material_entry import MaterialEntry
from app.models.notification import Notification, ResponseType
from app.models.organization import Organization
from app.models.user import User, UserRole
from app.main import app
from app.services import anomaly_service
from app.services.anomaly_service import detect_anomalies, train_anomaly_model
from app.services.bim_service import parse_ifc_materials
from app.services.emissions_service import EmissionsService


@compiles(PgUUID, "sqlite")
def _compile_uuid_sqlite(_type, _compiler, **_kwargs) -> str:
    return "CHAR(36)"


@compiles(JSONB, "sqlite")
def _compile_jsonb_sqlite(_type, _compiler, **_kwargs) -> str:
    return "TEXT"


@pytest.fixture(scope="session")
def engine(tmp_path_factory):
    db_path = tmp_path_factory.mktemp("db") / "test.db"
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
def client(db_session, monkeypatch):
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
    suffix = uuid4().hex[:8]
    org = Organization(name=f"Org-{uuid4()}")
    session.add(org)
    session.flush()

    creator = _create_user(
        session,
        org=org,
        role=UserRole.CREATOR,
        email=f"creator-{suffix}@example.com",
        password="creator-pass",
    )
    verifier = _create_user(
        session,
        org=org,
        role=UserRole.VERIFIER,
        email=f"verifier-{suffix}@example.com",
        password="verifier-pass",
    )
    approver = _create_user(
        session,
        org=org,
        role=UserRole.APPROVER,
        email=f"approver-{suffix}@example.com",
        password="approver-pass",
    )
    admin = _create_user(
        session,
        org=org,
        role=UserRole.ADMIN,
        email=f"admin-{suffix}@example.com",
        password="admin-pass",
    )

    return org, creator, verifier, approver, admin


def test_workflow_end_to_end(client, db_session, tmp_path, monkeypatch):
    monkeypatch.setattr("app.services.risk_engine.RiskEngine._is_abnormal_emission", lambda self, entry: False)
    org, creator, verifier, approver, admin = _seed_users(db_session)
    auditor = _create_user(
        db_session,
        org=org,
        role=UserRole.AUDITOR,
        email=f"auditor-{uuid4().hex[:8]}@example.com",
        password="auditor-pass",
    )
    db_session.commit()

    creator_header = _auth_header(client, creator.email, "creator-pass")
    verifier_header = _auth_header(client, verifier.email, "verifier-pass")
    approver_header = _auth_header(client, approver.email, "approver-pass")
    admin_header = _auth_header(client, admin.email, "admin-pass")
    auditor_header = _auth_header(client, auditor.email, "auditor-pass")

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
        "material_name": "Asphalt",
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
    assert creator_notifications["total"] == 1
    assert verifier_notifications["total"] == 1

    # 5) Verification blocked if no evidence
    verify_resp = client.post(
        f"/material-entries/{entry_id}/verify",
        headers=verifier_header,
    )
    assert verify_resp.status_code == 409
    assert "no evidence" in verify_resp.json()["detail"].lower()

    # 6) Evidence uploaded
    file_content = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\n"
    file_upload = {
        "file": ("evidence.pdf", file_content, "application/pdf"),
    }
    evidence_resp = client.post(
        f"/material-entries/{entry_id}/evidence",
        files=file_upload,
        headers=creator_header,
    )
    assert evidence_resp.status_code == 200
    evidence_path = evidence_resp.json()["storage_path"]

    # 7) Expire pending notification windows and verify
    _expire_entry_notifications(db_session, entry_id)

    ack_verifier = client.post(
        f"/entries/{entry_id}/acknowledge",
        json={"comment": "Verifier acknowledged"},
        headers=verifier_header,
    )
    assert ack_verifier.status_code == 200

    ack_auditor = client.post(
        f"/entries/{entry_id}/acknowledge",
        json={"comment": "Auditor acknowledged"},
        headers=auditor_header,
    )
    assert ack_auditor.status_code == 200

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


def _create_project(client, creator_header, *, name: str = "Project A") -> str:
    project_payload = {
        "name": name,
        "location": "Chennai",
        "reporting_period_start": str(date(2026, 1, 1)),
        "reporting_period_end": str(date(2026, 12, 31)),
    }
    project_resp = client.post("/projects", json=project_payload, headers=creator_header)
    assert project_resp.status_code == 200
    return project_resp.json()["id"]


def _create_entry(
    client,
    creator_header,
    *,
    project_id: str,
    material_name: str,
    supplier_name: str | None = None,
    supplier_email: str | None = None,
) -> str:
    payload = {
        "project_id": project_id,
        "material_name": material_name,
        "quantity": 10.0,
        "supplier_name": supplier_name,
        "supplier_email": supplier_email,
        "factor_version_snapshot": 1,
        "factor_value_snapshot": 1.25,
        "factor_unit_snapshot": "kgCO2e/kg",
        "factor_source_snapshot": "IPCC",
    }
    response = client.post("/material-entries", json=payload, headers=creator_header)
    assert response.status_code == 200
    return response.json()["id"]


def _upload_pdf_evidence(client, creator_header, entry_id: str, *, evidence_type: str, name: str) -> None:
    file_upload = {
        "file": (name, b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\n", "application/pdf"),
    }
    response = client.post(
        f"/material-entries/{entry_id}/evidence?evidence_type={evidence_type}",
        files=file_upload,
        headers=creator_header,
    )
    assert response.status_code == 200


def _expire_entry_notifications(db_session, entry_id: str) -> None:
    notifications = (
        db_session.query(Notification)
        .filter(
            Notification.entity_type == "material_entry",
            Notification.entity_id == UUID(entry_id),
        )
        .all()
    )
    for notification in notifications:
        notification.response_deadline = datetime.now(timezone.utc) - timedelta(minutes=5)
        notification.response_type = ResponseType.ACKNOWLEDGED
        notification.responded_at = datetime.now(timezone.utc)
    db_session.commit()


def test_verify_requires_acknowledgements_and_allows_dispute_flow(client, db_session, monkeypatch):
    monkeypatch.setattr("app.services.risk_engine.RiskEngine._is_abnormal_emission", lambda self, entry: False)
    org, creator, verifier, _, admin = _seed_users(db_session)
    suffix = uuid4().hex[:8]
    auditor = _create_user(
        db_session,
        org=org,
        role=UserRole.AUDITOR,
        email=f"auditor-{suffix}@example.com",
        password="auditor-pass",
    )
    supplier = _create_user(
        db_session,
        org=org,
        role=UserRole.SUPPLIER,
        email=f"supplier-{suffix}@example.com",
        password="supplier-pass",
    )
    db_session.commit()

    creator_header = _auth_header(client, creator.email, "creator-pass")
    verifier_header = _auth_header(client, verifier.email, "verifier-pass")
    auditor_header = _auth_header(client, auditor.email, "auditor-pass")
    supplier_header = _auth_header(client, supplier.email, "supplier-pass")
    admin_header = _auth_header(client, admin.email, "admin-pass")

    project_id = _create_project(client, creator_header, name="Ack Project")
    entry_id = _create_entry(
        client,
        creator_header,
        project_id=project_id,
        material_name="steel",
        supplier_name="Tata Steel",
        supplier_email=supplier.email,
    )

    submit_resp = client.post(f"/material-entries/{entry_id}/submit", headers=creator_header)
    assert submit_resp.status_code == 200

    _upload_pdf_evidence(client, creator_header, entry_id, evidence_type="delivery_note", name="d1.pdf")
    _upload_pdf_evidence(client, creator_header, entry_id, evidence_type="supplier_invoice", name="i1.pdf")
    _upload_pdf_evidence(client, creator_header, entry_id, evidence_type="mill_certificate", name="m1.pdf")

    _expire_entry_notifications(db_session, entry_id)

    blocked_resp = client.post(f"/material-entries/{entry_id}/verify", headers=verifier_header)
    assert blocked_resp.status_code == 409
    assert "acknowledgements" in blocked_resp.json()["detail"].lower()

    ack_verifier = client.post(
        f"/entries/{entry_id}/acknowledge",
        json={"comment": "Verifier acknowledged"},
        headers=verifier_header,
    )
    assert ack_verifier.status_code == 200

    supplier_ack = client.post(
        "/supplier/confirm-delivery",
        json={
            "entry_id": entry_id,
            "confirmation_status": "ACK",
            "comment": "Delivered as expected",
        },
        headers=supplier_header,
    )
    assert supplier_ack.status_code == 200

    auditor_dispute = client.post(
        f"/entries/{entry_id}/dispute",
        json={"comment": "Need one more check"},
        headers=auditor_header,
    )
    assert auditor_dispute.status_code == 200

    still_blocked = client.post(f"/material-entries/{entry_id}/verify", headers=verifier_header)
    assert still_blocked.status_code == 409

    auditor_ack = client.post(
        f"/entries/{entry_id}/acknowledge",
        json={"comment": "Audit complete"},
        headers=auditor_header,
    )
    assert auditor_ack.status_code == 200

    verified = client.post(f"/material-entries/{entry_id}/verify", headers=admin_header)
    assert verified.status_code == 200
    assert verified.json()["status"] == "VERIFIED"


def test_duplicate_evidence_and_high_risk_listing(client, db_session, monkeypatch):
    org, creator, verifier, _, admin = _seed_users(db_session)
    suffix = uuid4().hex[:8]
    supplier = _create_user(
        db_session,
        org=org,
        role=UserRole.SUPPLIER,
        email=f"supplier2-{suffix}@example.com",
        password="supplier-pass",
    )
    auditor = _create_user(
        db_session,
        org=org,
        role=UserRole.AUDITOR,
        email=f"auditor2-{suffix}@example.com",
        password="auditor-pass",
    )
    db_session.commit()

    creator_header = _auth_header(client, creator.email, "creator-pass")
    admin_header = _auth_header(client, admin.email, "admin-pass")
    _ = _auth_header(client, verifier.email, "verifier-pass")
    _ = _auth_header(client, supplier.email, "supplier-pass")
    _ = _auth_header(client, auditor.email, "auditor-pass")

    p1 = _create_project(client, creator_header, name="Dup Project 1")
    p2 = _create_project(client, creator_header, name="Dup Project 2")

    e1 = _create_entry(
        client,
        creator_header,
        project_id=p1,
        material_name="concrete",
        supplier_name="Supplier X",
        supplier_email=supplier.email,
    )
    e2 = _create_entry(
        client,
        creator_header,
        project_id=p2,
        material_name="concrete",
        supplier_name="Supplier X",
        supplier_email=supplier.email,
    )

    assert client.post(f"/material-entries/{e1}/submit", headers=creator_header).status_code == 200
    assert client.post(f"/material-entries/{e2}/submit", headers=creator_header).status_code == 200

    duplicate_file = {
        "file": ("dup.pdf", b"%PDF-1.4\nDUPLICATE-EVIDENCE\n", "application/pdf"),
    }
    r1 = client.post(
        f"/material-entries/{e1}/evidence?evidence_type=delivery_note",
        files=duplicate_file,
        headers=creator_header,
    )
    assert r1.status_code == 200
    r2 = client.post(
        f"/material-entries/{e2}/evidence?evidence_type=delivery_note",
        files=duplicate_file,
        headers=creator_header,
    )
    assert r2.status_code == 200

    entry_one = db_session.get(MaterialEntry, UUID(e1))
    assert entry_one is not None
    entry_one.temporal_anomaly = True
    db_session.commit()

    duplicates_resp = client.get("/evidence/duplicates", headers=admin_header)
    assert duplicates_resp.status_code == 200
    duplicate_ids = {item["entry_id"] for item in duplicates_resp.json()}
    assert e1 in duplicate_ids
    assert e2 in duplicate_ids

    monkeypatch.setattr("app.services.risk_engine.RiskEngine._is_abnormal_emission", lambda self, entry: False)
    high_risk_resp = client.get("/entries/high-risk", headers=admin_header)
    assert high_risk_resp.status_code == 200
    high_risk_ids = {item["entry_id"] for item in high_risk_resp.json()}
    assert e1 in high_risk_ids


def test_bim_discrepancy_analytics_flags_mismatch(client, db_session):
    org, creator, _, _, _ = _seed_users(db_session)
    db_session.commit()

    creator_header = _auth_header(client, creator.email, "creator-pass")
    project_id = _create_project(client, creator_header, name="BIM Project")
    entry_id = _create_entry(
        client,
        creator_header,
        project_id=project_id,
        material_name="concrete",
    )

    entry = db_session.get(MaterialEntry, UUID(entry_id))
    assert entry is not None
    entry.quantity = 40.0
    db_session.add(
        BIMMaterialEstimate(
            project_id=UUID(project_id),
            material_type="concrete",
            estimated_quantity=120.0,
            unit="m3",
        )
    )
    db_session.commit()

    discrepancies_resp = client.get("/analytics/bim-discrepancies", headers=creator_header)
    assert discrepancies_resp.status_code == 200
    assert any(
        item["project_id"] == project_id and item["material_type"].lower() == "concrete"
        for item in discrepancies_resp.json()
    )


def test_project_bim_upload_endpoint_returns_model_id(client, db_session, monkeypatch):
    org, creator, _, _, _ = _seed_users(db_session)
    db_session.commit()

    creator_header = _auth_header(client, creator.email, "creator-pass")
    project_id = _create_project(client, creator_header, name="BIM Upload Project")

    parse_calls: list[tuple[str, str]] = []

    def _fake_parse(project_id_arg, file_path_arg):
        parse_calls.append((str(project_id_arg), str(file_path_arg)))

    monkeypatch.setattr("app.api.projects._parse_ifc_and_store_estimates", _fake_parse)

    upload_resp = client.post(
        f"/projects/{project_id}/bim-upload",
        files={"file": ("model.ifc", b"FAKE-IFC-CONTENT", "application/octet-stream")},
        headers=creator_header,
    )
    assert upload_resp.status_code == 200

    payload = upload_resp.json()
    assert "model_id" in payload
    assert UUID(payload["model_id"])

    assert len(parse_calls) == 1
    called_project_id, called_path = parse_calls[0]
    assert called_project_id == project_id
    assert called_path.endswith("model.ifc")


def test_project_bim_estimates_endpoint_returns_project_summary(client, db_session):
    org, creator, _, _, _ = _seed_users(db_session)
    db_session.commit()

    creator_header = _auth_header(client, creator.email, "creator-pass")
    project_id = _create_project(client, creator_header, name="BIM Estimate Project")

    concrete_entry_id = _create_entry(
        client,
        creator_header,
        project_id=project_id,
        material_name="concrete",
    )
    steel_entry_id = _create_entry(
        client,
        creator_header,
        project_id=project_id,
        material_name="steel",
    )

    concrete_entry = db_session.get(MaterialEntry, UUID(concrete_entry_id))
    steel_entry = db_session.get(MaterialEntry, UUID(steel_entry_id))
    assert concrete_entry is not None
    assert steel_entry is not None
    concrete_entry.quantity = 120.0
    steel_entry.quantity = 10.0

    db_session.add_all(
        [
            BIMMaterialEstimate(
                project_id=UUID(project_id),
                material_type="concrete",
                estimated_quantity=100.0,
                unit="m3",
            ),
            BIMMaterialEstimate(
                project_id=UUID(project_id),
                material_type="steel",
                estimated_quantity=10.0,
                unit="ton",
            ),
        ]
    )
    db_session.commit()

    estimates_resp = client.get(f"/projects/{project_id}/bim-estimates", headers=creator_header)
    assert estimates_resp.status_code == 200

    rows = estimates_resp.json()
    assert len(rows) == 2

    rows_by_material = {item["material"]: item for item in rows}
    assert rows_by_material["concrete"]["estimated"] == 100.0
    assert rows_by_material["concrete"]["reported"] == 120.0
    assert rows_by_material["concrete"]["discrepancy"] == 20.0
    assert rows_by_material["concrete"]["status"] == "WARNING"

    assert rows_by_material["steel"]["estimated"] == 10.0
    assert rows_by_material["steel"]["reported"] == 10.0
    assert rows_by_material["steel"]["discrepancy"] == 0.0
    assert rows_by_material["steel"]["status"] == "OK"


def test_project_bim_discrepancies_endpoint_returns_only_high(client, db_session):
    org, creator, _, _, _ = _seed_users(db_session)
    db_session.commit()

    creator_header = _auth_header(client, creator.email, "creator-pass")
    project_id = _create_project(client, creator_header, name="BIM Discrepancy Project")

    concrete_entry_id = _create_entry(
        client,
        creator_header,
        project_id=project_id,
        material_name="concrete",
    )
    steel_entry_id = _create_entry(
        client,
        creator_header,
        project_id=project_id,
        material_name="steel",
    )

    concrete_entry = db_session.get(MaterialEntry, UUID(concrete_entry_id))
    steel_entry = db_session.get(MaterialEntry, UUID(steel_entry_id))
    assert concrete_entry is not None
    assert steel_entry is not None
    concrete_entry.quantity = 120.0
    steel_entry.quantity = 10.0

    db_session.add_all(
        [
            BIMMaterialEstimate(
                project_id=UUID(project_id),
                material_type="concrete",
                estimated_quantity=400.0,
                unit="m3",
            ),
            BIMMaterialEstimate(
                project_id=UUID(project_id),
                material_type="steel",
                estimated_quantity=10.0,
                unit="ton",
            ),
        ]
    )
    db_session.commit()

    discrepancies_resp = client.get(f"/projects/{project_id}/bim-discrepancies", headers=creator_header)
    assert discrepancies_resp.status_code == 200

    rows = discrepancies_resp.json()
    assert len(rows) == 1
    assert rows[0]["material"] == "concrete"
    assert rows[0]["estimated"] == 400.0
    assert rows[0]["reported"] == 120.0
    assert rows[0]["discrepancy"] == 70.0
    assert rows[0]["status"] == "HIGH"


def test_entry_risk_endpoint_returns_score_level_and_reasons(client, db_session):
    org, creator, _, _, _ = _seed_users(db_session)
    supplier = _create_user(
        db_session,
        org=org,
        role=UserRole.SUPPLIER,
        email=f"supplier-risk-{uuid4().hex[:8]}@example.com",
        password="supplier-pass",
    )
    db_session.commit()

    creator_header = _auth_header(client, creator.email, "creator-pass")

    p1 = _create_project(client, creator_header, name="Risk Project 1")
    p2 = _create_project(client, creator_header, name="Risk Project 2")

    e1 = _create_entry(
        client,
        creator_header,
        project_id=p1,
        material_name="concrete",
        supplier_name="Supplier X",
        supplier_email=supplier.email,
    )
    e2 = _create_entry(
        client,
        creator_header,
        project_id=p2,
        material_name="concrete",
        supplier_name="Supplier X",
        supplier_email=supplier.email,
    )

    duplicate_file = {
        "file": ("dup-risk.pdf", b"%PDF-1.4\nDUP-RISK\n", "application/pdf"),
    }
    assert (
        client.post(
            f"/material-entries/{e1}/evidence?evidence_type=delivery_note",
            files=duplicate_file,
            headers=creator_header,
        ).status_code
        == 200
    )
    assert (
        client.post(
            f"/material-entries/{e2}/evidence?evidence_type=delivery_note",
            files=duplicate_file,
            headers=creator_header,
        ).status_code
        == 200
    )

    entry_one = db_session.get(MaterialEntry, UUID(e1))
    assert entry_one is not None
    entry_one.bim_validation_status = "HIGH"
    db_session.commit()

    risk_resp = client.get(f"/entries/{e1}/risk", headers=creator_header)
    assert risk_resp.status_code == 200
    payload = risk_resp.json()

    assert payload["entry_id"] == e1
    assert payload["risk_level"] == "HIGH"
    assert payload["risk_score"] >= 80
    assert "Duplicate evidence detected" in payload["reasons"]
    assert "BIM discrepancy detected" in payload["reasons"]
    assert "Supplier confirmation missing" in payload["reasons"]


def test_fraud_demo_scenario_flags_high_risk_entry(client, db_session):
    org, creator, _, _, _ = _seed_users(db_session)
    supplier = _create_user(
        db_session,
        org=org,
        role=UserRole.SUPPLIER,
        email=f"supplier-fraud-{uuid4().hex[:8]}@example.com",
        password="supplier-pass",
    )
    db_session.commit()

    creator_header = _auth_header(client, creator.email, "creator-pass")

    project_id = _create_project(client, creator_header, name="Fraud Demo Project")
    other_project_id = _create_project(client, creator_header, name="Fraud Demo Project 2")

    entry_id = _create_entry(
        client,
        creator_header,
        project_id=project_id,
        material_name="concrete",
        supplier_name="Supplier Fraud",
        supplier_email=supplier.email,
    )
    other_entry_id = _create_entry(
        client,
        creator_header,
        project_id=other_project_id,
        material_name="concrete",
        supplier_name="Supplier Fraud",
        supplier_email=supplier.email,
    )

    primary_entry = db_session.get(MaterialEntry, UUID(entry_id))
    assert primary_entry is not None
    primary_entry.quantity = 120.0
    db_session.add(
        BIMMaterialEstimate(
            project_id=UUID(project_id),
            material_type="concrete",
            estimated_quantity=400.0,
            unit="m3",
        )
    )
    db_session.commit()

    assert client.get(f"/projects/{project_id}/bim-discrepancies", headers=creator_header).status_code == 200

    refreshed_entry = db_session.get(MaterialEntry, UUID(entry_id))
    assert refreshed_entry is not None
    refreshed_entry.bim_validation_status = "HIGH"
    db_session.commit()

    duplicate_file = {
        "file": ("fraud-dup.pdf", b"%PDF-1.4\nFRAUD-DUP\n", "application/pdf"),
    }
    assert (
        client.post(
            f"/material-entries/{entry_id}/evidence?evidence_type=delivery_note",
            files=duplicate_file,
            headers=creator_header,
        ).status_code
        == 200
    )
    assert (
        client.post(
            f"/material-entries/{other_entry_id}/evidence?evidence_type=delivery_note",
            files=duplicate_file,
            headers=creator_header,
        ).status_code
        == 200
    )

    risk_resp = client.get(f"/entries/{entry_id}/risk", headers=creator_header)
    assert risk_resp.status_code == 200
    payload = risk_resp.json()

    assert payload["risk_level"] == "HIGH"
    assert payload["risk_score"] >= 80
    assert "Duplicate evidence detected" in payload["reasons"]
    assert "BIM discrepancy detected" in payload["reasons"]
    assert "Supplier confirmation missing" in payload["reasons"]


def test_new_bim_upload_endpoint_extracts_materials(client, db_session, monkeypatch):
    org, creator, _, _, _ = _seed_users(db_session)
    db_session.commit()

    creator_header = _auth_header(client, creator.email, "creator-pass")
    project_id = _create_project(client, creator_header, name="New BIM Upload")

    def _fake_task(model_id: str, _file_path: str) -> None:
        model = db_session.get(BIMModel, UUID(model_id))
        assert model is not None
        model.processing_status = BIMProcessingStatus.PROCESSED
        db_session.add_all(
            [
                BIMMaterial(
                    bim_model_id=model.id,
                    material_name="steel",
                    quantity=110.0,
                    unit="tons",
                    source_element="IfcElementQuantity",
                    confidence_score=0.9,
                ),
                BIMMaterial(
                    bim_model_id=model.id,
                    material_name="concrete",
                    quantity=520.0,
                    unit="m3",
                    source_element="IfcElementQuantity",
                    confidence_score=0.85,
                ),
            ]
        )
        db_session.commit()

    monkeypatch.setattr("app.api.bim._process_model_task", _fake_task)

    upload_resp = client.post(
        f"/projects/{project_id}/bim/upload",
        files={"file": ("tower.ifc", b"FAKE-IFC-CONTENT", "application/octet-stream")},
        headers=creator_header,
    )
    assert upload_resp.status_code == 200

    upload_payload = upload_resp.json()
    assert upload_payload["model"]["project_id"] == project_id
    assert upload_payload["model"]["model_name"] == "tower.ifc"
    assert upload_payload["model"]["processing_status"] in {"UPLOADED", "PROCESSING", "PROCESSED"}

    materials_resp = client.get(f"/projects/{project_id}/bim/materials", headers=creator_header)
    assert materials_resp.status_code == 200
    materials = materials_resp.json()

    names = {item["material_name"] for item in materials}
    assert "steel" in names
    assert "concrete" in names

    by_name = {item["material_name"]: item for item in materials}
    assert by_name["steel"]["unit"] == "tons"
    assert round(float(by_name["steel"]["quantity"]), 3) == 110.0


def test_new_bim_comparison_endpoint_flags_high_risk(client, db_session, monkeypatch):
    org, creator, _, _, _ = _seed_users(db_session)
    db_session.commit()

    creator_header = _auth_header(client, creator.email, "creator-pass")
    project_id = _create_project(client, creator_header, name="New BIM Comparison")

    entry_id = _create_entry(
        client,
        creator_header,
        project_id=project_id,
        material_name="concrete",
    )
    entry = db_session.get(MaterialEntry, UUID(entry_id))
    assert entry is not None
    entry.quantity = 120.0
    db_session.commit()

    def _fake_task(model_id: str, _file_path: str) -> None:
        model = db_session.get(BIMModel, UUID(model_id))
        assert model is not None
        model.processing_status = BIMProcessingStatus.PROCESSED
        db_session.add(
            BIMMaterial(
                bim_model_id=model.id,
                material_name="concrete",
                quantity=400.0,
                unit="m3",
                source_element="IfcElementQuantity",
                confidence_score=0.9,
            )
        )
        db_session.commit()

    monkeypatch.setattr("app.api.bim._process_model_task", _fake_task)

    upload_resp = client.post(
        f"/projects/{project_id}/bim/upload",
        files={"file": ("compare.ifc", b"FAKE-IFC-CONTENT", "application/octet-stream")},
        headers=creator_header,
    )
    assert upload_resp.status_code == 200

    comparison_resp = client.get(f"/projects/{project_id}/bim/comparison", headers=creator_header)
    assert comparison_resp.status_code == 200
    report = comparison_resp.json()

    assert report["project_id"] == project_id
    assert len(report["comparisons"]) >= 1
    assert len(report["anomalies"]) == 1

    anomaly = report["anomalies"][0]
    assert anomaly["material"] == "concrete"
    assert anomaly["expected"] == 400.0
    assert anomaly["reported"] == 120.0
    assert anomaly["difference"] == 280.0
    assert anomaly["risk_level"] == "HIGH_RISK"
    assert anomaly["difference_ratio"] > 0.25


def test_new_bim_endpoints_enforce_organization_isolation(client, db_session):
    org_a, creator_a, _, _, _ = _seed_users(db_session)
    org_b = Organization(name=f"Org-{uuid4()}")
    db_session.add(org_b)
    db_session.flush()
    creator_b = _create_user(
        db_session,
        org=org_b,
        role=UserRole.CREATOR,
        email=f"creator-b-{uuid4().hex[:8]}@example.com",
        password="creator-pass",
    )
    db_session.commit()

    header_a = _auth_header(client, creator_a.email, "creator-pass")
    header_b = _auth_header(client, creator_b.email, "creator-pass")

    project_id = _create_project(client, header_a, name="Isolation BIM")

    assert (
        client.post(
            f"/projects/{project_id}/bim/upload",
            files={"file": ("isolation.ifc", b"FAKE-IFC-CONTENT", "application/octet-stream")},
            headers=header_b,
        ).status_code
        == 404
    )
    assert client.get(f"/projects/{project_id}/bim/materials", headers=header_b).status_code == 404
    assert client.get(f"/projects/{project_id}/bim/comparison", headers=header_b).status_code == 404


def test_bim_service_parse_ifc_materials_extracts_aggregates(tmp_path, monkeypatch):
    class _FakeQuantity:
        def __init__(self, name: str, volume: float | None = None, weight: float | None = None):
            self.Name = name
            self.VolumeValue = volume
            self.WeightValue = weight
            self.AreaValue = None
            self.LengthValue = None
            self.CountValue = None

    class _FakeQSet:
        def __init__(self, name: str, quantities: list[object]):
            self.Name = name
            self.Quantities = quantities

    class _FakeMaterial:
        def __init__(self, name: str):
            self.Name = name

    class _FakeModel:
        def by_type(self, name: str):
            if name == "IfcMaterial":
                return [_FakeMaterial("Concrete"), _FakeMaterial("Steel")]
            if name == "IfcElementQuantity":
                return [
                    _FakeQSet("Concrete", [_FakeQuantity("Concrete", volume=9000.0)]),
                    _FakeQSet("Steel", [_FakeQuantity("Steel", weight=1200000.0)]),
                ]
            return []

    fake_ifcopenshell = types.SimpleNamespace(open=lambda _path: _FakeModel())
    monkeypatch.setitem(sys.modules, "ifcopenshell", fake_ifcopenshell)

    file_path = tmp_path / "sample.ifc"
    file_path.write_text("ISO-10303-21;")

    materials = parse_ifc_materials(str(file_path))

    by_name = {item["name"]: item for item in materials}
    assert by_name["Concrete"]["quantity"] == 9000.0
    assert by_name["Concrete"]["unit"] == "m3"
    assert by_name["Steel"]["quantity"] == 1200.0
    assert by_name["Steel"]["unit"] == "tons"


def test_bim_upload_route_returns_materials(client, db_session, monkeypatch):
    _, creator, _, _, _ = _seed_users(db_session)
    db_session.commit()
    header = _auth_header(client, creator.email, "creator-pass")

    monkeypatch.setattr(
        "app.api.bim.parse_ifc_materials",
        lambda _path: [
            {"name": "Concrete", "quantity": 9000.0, "unit": "m3"},
            {"name": "Steel", "quantity": 1200.0, "unit": "tons"},
        ],
    )

    response = client.post(
        "/bim/upload",
        files={"file": ("model.ifc", b"IFC-DATA", "application/octet-stream")},
        headers=header,
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload == {
        "materials": [
            {"name": "Concrete", "quantity": 9000.0, "unit": "m3"},
            {"name": "Steel", "quantity": 1200.0, "unit": "tons"},
        ]
    }


def test_bim_upload_route_validates_ifc_extension(client, db_session):
    _, creator, _, _, _ = _seed_users(db_session)
    db_session.commit()
    header = _auth_header(client, creator.email, "creator-pass")

    response = client.post(
        "/bim/upload",
        files={"file": ("model.txt", b"not-ifc", "text/plain")},
        headers=header,
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Only IFC files are supported"


def test_emissions_service_calculates_total_and_breakdown(db_session):
    db_session.add_all(
        [
            EmissionFactor(
                material_name="Concrete",
                factor_value=0.133333333333,
                unit="m3",
                source="IPCC",
                standard_name="ISO 14064",
                region="IN",
                source_document_url="https://example.com/concrete",
                methodology_reference="Method-A",
                version=101,
                valid_from=date(2026, 1, 1),
                is_active=True,
            ),
            EmissionFactor(
                material_name="Steel",
                factor_value=0.208333333333,
                unit="tons",
                source="IPCC",
                standard_name="ISO 14064",
                region="IN",
                source_document_url="https://example.com/steel",
                methodology_reference="Method-B",
                version=101,
                valid_from=date(2026, 1, 1),
                is_active=True,
            ),
        ]
    )
    db_session.commit()

    result = EmissionsService(db_session).calculate_material_emissions(
        [
            {"name": "Concrete", "quantity": 9000, "unit": "m3"},
            {"name": "Steel", "quantity": 1200, "unit": "tons"},
        ]
    )

    assert float(result["total_emissions"]) == pytest.approx(1449.9966, abs=1e-4)
    assert result["breakdown"] == [
        {"material": "Concrete", "emissions": 1199.997},
        {"material": "Steel", "emissions": 249.9996},
    ]


def test_emissions_calculate_endpoint_handles_missing_factors(client, db_session):
    _, creator, _, _, _ = _seed_users(db_session)
    db_session.add(
        EmissionFactor(
            material_name="Concrete",
            factor_value=0.1,
            unit="m3",
            source="IPCC",
            standard_name="ISO 14064",
            region="IN",
            source_document_url="https://example.com/concrete",
            methodology_reference="Method-A",
            version=202,
            valid_from=date(2026, 1, 1),
            is_active=True,
        )
    )
    db_session.commit()

    header = _auth_header(client, creator.email, "creator-pass")
    response = client.post(
        "/emissions/calculate",
        json={
            "materials": [
                {"name": "Concrete", "quantity": 100, "unit": "m3"},
                {"name": "UnknownMaterial", "quantity": 50, "unit": "m3"},
            ]
        },
        headers=header,
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["total_emissions"] == 10.0
    assert payload["breakdown"] == [
        {"material": "Concrete", "emissions": 10.0},
        {"material": "UnknownMaterial", "emissions": 0.0},
    ]


def test_emissions_calculate_endpoint_validates_payload(client, db_session):
    _, creator, _, _, _ = _seed_users(db_session)
    db_session.commit()
    header = _auth_header(client, creator.email, "creator-pass")

    response = client.post(
        "/emissions/calculate",
        json={"materials": [{"name": "Concrete", "quantity": -1, "unit": "m3"}]},
        headers=header,
    )

    assert response.status_code == 422


def test_train_anomaly_model_persists_and_detects(monkeypatch, tmp_path):
    model_path = tmp_path / "anomaly.pkl"
    monkeypatch.setattr(anomaly_service, "MODEL_DIR", tmp_path)
    monkeypatch.setattr(anomaly_service, "MODEL_PATH", model_path)

    dataset = [
        {"building_id": "B1", "material": "Concrete", "quantity": 8500},
        {"building_id": "B1", "material": "Steel", "quantity": 1100},
        {"building_id": "B2", "material": "Concrete", "quantity": 8700},
        {"building_id": "B2", "material": "Steel", "quantity": 1150},
        {"building_id": "B3", "material": "Concrete", "quantity": 8600},
        {"building_id": "B3", "material": "Steel", "quantity": 1120},
        {"building_id": "B4", "material": "Concrete", "quantity": 8550},
        {"building_id": "B4", "material": "Steel", "quantity": 1090},
        {"building_id": "B5", "material": "Concrete", "quantity": 8650},
        {"building_id": "B5", "material": "Steel", "quantity": 1130},
    ]

    summary = train_anomaly_model(dataset)
    assert summary["trained_rows"] == 10
    assert model_path.exists()

    result_1 = detect_anomalies(
        [
            {"name": "Concrete", "quantity": 9000},
            {"name": "Steel", "quantity": 1200},
        ]
    )
    result_2 = detect_anomalies(
        [
            {"name": "Concrete", "quantity": 9000},
            {"name": "Steel", "quantity": 1200},
        ]
    )

    assert result_1 == result_2
    assert 0.0 <= float(result_1["risk_score"]) <= 1.0
    assert isinstance(result_1["flags"], list)


def test_analysis_anomaly_endpoint_returns_structured_output(client, db_session, monkeypatch, tmp_path):
    model_path = tmp_path / "anomaly.pkl"
    monkeypatch.setattr(anomaly_service, "MODEL_DIR", tmp_path)
    monkeypatch.setattr(anomaly_service, "MODEL_PATH", model_path)

    dataset = [
        {"building_id": "B1", "material": "Concrete", "quantity": 8000},
        {"building_id": "B1", "material": "Steel", "quantity": 1000},
        {"building_id": "B2", "material": "Concrete", "quantity": 8100},
        {"building_id": "B2", "material": "Steel", "quantity": 1020},
        {"building_id": "B3", "material": "Concrete", "quantity": 7900},
        {"building_id": "B3", "material": "Steel", "quantity": 980},
        {"building_id": "B4", "material": "Concrete", "quantity": 8050},
        {"building_id": "B4", "material": "Steel", "quantity": 1010},
        {"building_id": "B5", "material": "Concrete", "quantity": 7950},
        {"building_id": "B5", "material": "Steel", "quantity": 990},
    ]
    train_anomaly_model(dataset)

    _, creator, _, _, _ = _seed_users(db_session)
    db_session.commit()
    header = _auth_header(client, creator.email, "creator-pass")

    response = client.post(
        "/analysis/anomaly",
        json={
            "materials": [
                {"name": "Concrete", "quantity": 9000},
                {"name": "Steel", "quantity": 1200},
            ]
        },
        headers=header,
    )
    assert response.status_code == 200
    payload = response.json()
    assert "risk_score" in payload
    assert "flags" in payload
    assert 0.0 <= float(payload["risk_score"]) <= 1.0


def test_analysis_anomaly_endpoint_validates_payload(client, db_session):
    _, creator, _, _, _ = _seed_users(db_session)
    db_session.commit()
    header = _auth_header(client, creator.email, "creator-pass")

    response = client.post(
        "/analysis/anomaly",
        json={"materials": [{"name": "Concrete", "quantity": -10}]},
        headers=header,
    )
    assert response.status_code == 422


def test_analysis_anomaly_train_endpoint_admin_only(client, db_session):
    _, creator, _, _, _ = _seed_users(db_session)
    db_session.commit()
    header = _auth_header(client, creator.email, "creator-pass")

    response = client.post(
        "/analysis/anomaly/train",
        json={
            "dataset": [
                {"building_id": "B1", "material": "Concrete", "quantity": 8000},
                {"building_id": "B1", "material": "Steel", "quantity": 1000},
                {"building_id": "B2", "material": "Concrete", "quantity": 8100},
                {"building_id": "B2", "material": "Steel", "quantity": 1020},
                {"building_id": "B3", "material": "Concrete", "quantity": 7900},
                {"building_id": "B3", "material": "Steel", "quantity": 980},
                {"building_id": "B4", "material": "Concrete", "quantity": 8050},
                {"building_id": "B4", "material": "Steel", "quantity": 1010},
                {"building_id": "B5", "material": "Concrete", "quantity": 7950},
                {"building_id": "B5", "material": "Steel", "quantity": 990},
            ]
        },
        headers=header,
    )
    assert response.status_code == 403


def test_analysis_anomaly_train_endpoint_succeeds_for_admin(client, db_session, monkeypatch, tmp_path):
    model_path = tmp_path / "anomaly_train.pkl"
    monkeypatch.setattr(anomaly_service, "MODEL_DIR", tmp_path)
    monkeypatch.setattr(anomaly_service, "MODEL_PATH", model_path)

    _, _, _, _, admin = _seed_users(db_session)
    db_session.commit()
    header = _auth_header(client, admin.email, "admin-pass")

    response = client.post(
        "/analysis/anomaly/train",
        json={
            "dataset": [
                {"building_id": "B1", "material": "Concrete", "quantity": 8000},
                {"building_id": "B1", "material": "Steel", "quantity": 1000},
                {"building_id": "B2", "material": "Concrete", "quantity": 8100},
                {"building_id": "B2", "material": "Steel", "quantity": 1020},
                {"building_id": "B3", "material": "Concrete", "quantity": 7900},
                {"building_id": "B3", "material": "Steel", "quantity": 980},
                {"building_id": "B4", "material": "Concrete", "quantity": 8050},
                {"building_id": "B4", "material": "Steel", "quantity": 1010},
                {"building_id": "B5", "material": "Concrete", "quantity": 7950},
                {"building_id": "B5", "material": "Steel", "quantity": 990},
            ]
        },
        headers=header,
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["trained_rows"] == 10
    assert model_path.exists()
