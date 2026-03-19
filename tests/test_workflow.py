import io
import json
import os
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
from app.models.bim_material_estimate import BIMMaterialEstimate
from app.models.material_entry import MaterialEntry
from app.models.notification import Notification, ResponseType
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
