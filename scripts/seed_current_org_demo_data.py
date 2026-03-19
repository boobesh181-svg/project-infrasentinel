from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
import hashlib
from pathlib import Path
import random

from sqlalchemy import func, select

from app.core.security import get_password_hash
from app.db.session import SessionLocal
from app.models.audit_log import AuditLog
from app.models.emission_factor import EmissionFactor
from app.models.evidence_file import EvidenceFile
from app.models.material_entry import MaterialEntry, MaterialStatus
from app.models.notification import Notification, ResponseType
from app.models.project import Project
from app.models.user import User, UserRole

TARGET_EMAIL = "boobesh181@gmail.com"
DEFAULT_PASSWORD = "InfrasentinelDemo#2026"
EVIDENCE_ROOT = Path("storage") / "evidence"


def status_rank(status: MaterialStatus) -> int:
    return {
        MaterialStatus.DRAFT: 0,
        MaterialStatus.SUBMITTED: 1,
        MaterialStatus.VERIFIED: 2,
        MaterialStatus.APPROVED: 3,
        MaterialStatus.LOCKED: 4,
    }[status]


def get_or_create_role_user(session, org_id, role: UserRole, email: str) -> User:
    user = session.execute(select(User).where(User.email == email)).scalar_one_or_none()
    if user is not None:
        return user
    user = User(
        organization_id=org_id,
        email=email,
        hashed_password=get_password_hash(DEFAULT_PASSWORD),
        role=role,
        is_active=True,
        created_at=datetime.now(timezone.utc),
    )
    session.add(user)
    session.flush()
    return user


def ensure_factors(session) -> dict[str, EmissionFactor]:
    wanted = {
        "Concrete C30": Decimal("0.24"),
        "Reinforcement Steel": Decimal("1.90"),
        "Structural Steel": Decimal("2.10"),
        "Float Glass": Decimal("1.20"),
        "Aluminium Frames": Decimal("8.20"),
        "Cement OPC": Decimal("0.90"),
    }
    factors: dict[str, EmissionFactor] = {}
    for name, value in wanted.items():
        ef = session.execute(
            select(EmissionFactor)
            .where(EmissionFactor.material_name == name)
            .order_by(EmissionFactor.version.desc())
        ).scalars().first()
        if ef is None:
            ef = EmissionFactor(
                material_name=name,
                factor_value=value,
                unit="tCO2e/m3" if "Concrete" in name else "tCO2e/ton",
                source="ICE/Ecoinvent",
                standard_name="Demo Registry",
                region="India",
                source_document_url="https://example.com/demo-factor",
                methodology_reference="Demo seeding baseline",
                version=1,
                valid_from=date(2024, 1, 1),
                valid_to=None,
                is_active=True,
                created_at=datetime.now(timezone.utc),
            )
            session.add(ef)
            session.flush()
        factors[name] = ef
    return factors


def write_evidence(path: Path, name: str, entry_id: str) -> tuple[int, str]:
    payload = f"Evidence file={name}\nentry={entry_id}\n".encode("utf-8")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(payload)
    return len(payload), hashlib.sha256(payload).hexdigest()


def main() -> int:
    rng = random.Random(20260317)

    with SessionLocal() as session:
        owner = session.execute(select(User).where(User.email == TARGET_EMAIL)).scalar_one_or_none()
        if owner is None:
            print(f"User not found: {TARGET_EMAIL}")
            return 1

        existing_projects = session.execute(
            select(func.count(Project.id)).where(Project.organization_id == owner.organization_id)
        ).scalar_one()
        if existing_projects > 0:
            print("Current organization already has projects. Nothing to add.")
            return 0

        org_id = owner.organization_id

    with SessionLocal() as session:
        owner = session.execute(select(User).where(User.email == TARGET_EMAIL)).scalar_one()

        creator1 = get_or_create_role_user(session, org_id, UserRole.CREATOR, "site.engineer1@infrasentinel.demo")
        creator2 = get_or_create_role_user(session, org_id, UserRole.CREATOR, "site.engineer2@infrasentinel.demo")
        verifier = get_or_create_role_user(session, org_id, UserRole.VERIFIER, "sustainability.officer@infrasentinel.demo")
        approver = get_or_create_role_user(session, org_id, UserRole.APPROVER, "project.manager@infrasentinel.demo")

        factors = ensure_factors(session)

        project_specs = [
            ("Demo Tower Phase A", "Bangalore", date(2025, 1, 1), date(2026, 6, 30)),
            ("Transit Hub Expansion", "Hyderabad", date(2025, 2, 10), date(2026, 8, 30)),
            ("Eco Business Park", "Pune", date(2025, 3, 15), date(2026, 12, 31)),
        ]

        projects: list[Project] = []
        for name, location, start, end in project_specs:
            p = Project(
                organization_id=org_id,
                created_by_id=owner.id,
                name=name,
                location=location,
                reporting_period_start=start,
                reporting_period_end=end,
                created_at=datetime.combine(start, time(10, 0), tzinfo=timezone.utc),
            )
            session.add(p)
            projects.append(p)
        session.flush()

        statuses = ([MaterialStatus.DRAFT] * 9 + [MaterialStatus.SUBMITTED] * 12 + [MaterialStatus.VERIFIED] * 8 + [MaterialStatus.APPROVED] * 5 + [MaterialStatus.LOCKED] * 2)
        rng.shuffle(statuses)

        templates = [
            ("Concrete Pour - Foundation", "Concrete C30", Decimal("180"), Decimal("420")),
            ("Rebar Installation - Basement", "Reinforcement Steel", Decimal("25"), Decimal("95")),
            ("Steel Columns Installation - Structural Frame", "Structural Steel", Decimal("20"), Decimal("80")),
            ("Facade Glass Panel Delivery - Facade Installation", "Float Glass", Decimal("6"), Decimal("28")),
            ("Aluminium Frame Installation - Facade", "Aluminium Frames", Decimal("5"), Decimal("20")),
            ("Cement OPC Delivery - Interior", "Cement OPC", Decimal("30"), Decimal("90")),
        ]

        material_entries = 0
        evidence_files = 0
        audit_logs = 0
        notifications = 0

        for i, status in enumerate(statuses):
                project = projects[i % len(projects)]
                label, factor_name, qmin, qmax = templates[i % len(templates)]
                factor = factors[factor_name]
                quantity = Decimal(str(round(rng.uniform(float(qmin), float(qmax)), 2)))
                emission = (quantity * Decimal(str(factor.factor_value))).quantize(Decimal("0.000001"))

                created_at = datetime.combine(
                    project.reporting_period_start + timedelta(days=15 + i * 7),
                    time(hour=9 + (i % 6), minute=15),
                    tzinfo=timezone.utc,
                )
                submitted_at = created_at + timedelta(hours=8) if status_rank(status) >= 1 else None
                verified_at = submitted_at + timedelta(days=2) if status_rank(status) >= 2 and submitted_at else None
                approved_at = verified_at + timedelta(days=1) if status_rank(status) >= 3 and verified_at else None
                locked_at = approved_at + timedelta(days=1) if status_rank(status) >= 4 and approved_at else None

                creator = creator1 if i % 2 == 0 else creator2
                entry = MaterialEntry(
                    project_id=project.id,
                    material_name=label,
                    quantity=quantity,
                    factor_version_snapshot=factor.version,
                    factor_value_snapshot=factor.factor_value,
                    factor_unit_snapshot=factor.unit,
                    factor_source_snapshot=factor.source,
                    calculated_emission=emission,
                    status=status,
                    created_by_id=creator.id,
                    verified_by_id=verifier.id if status_rank(status) >= 2 else None,
                    approved_by_id=approver.id if status_rank(status) >= 3 else None,
                    locked_at=locked_at,
                    created_at=created_at,
                )
                session.add(entry)
                session.flush()
                material_entries += 1

                events = [("CREATE_ENTRY", created_at, creator, {}, {"status": "DRAFT"})]
                if submitted_at:
                    events.append(("SUBMIT_ENTRY", submitted_at, creator, {"status": "DRAFT"}, {"status": "SUBMITTED"}))
                if verified_at:
                    events.append(("VERIFY_ENTRY", verified_at, verifier, {"status": "SUBMITTED"}, {"status": "VERIFIED"}))
                if approved_at:
                    events.append(("APPROVE_ENTRY", approved_at, approver, {"status": "VERIFIED"}, {"status": "APPROVED"}))
                if locked_at:
                    events.append(("LOCK_ENTRY", locked_at, approver, {"status": "APPROVED"}, {"status": "LOCKED"}))

                for action, ts, actor, prev_state, new_state in events:
                    session.add(AuditLog(entity_type="material_entry", entity_id=entry.id, action=action, previous_state=prev_state, new_state=new_state, performed_by_id=actor.id, timestamp=ts))
                    audit_logs += 1

                if submitted_at:
                    deadline = submitted_at + timedelta(hours=48)
                    for recipient in (owner, verifier):
                        session.add(
                            Notification(
                                entity_type="material_entry",
                                entity_id=entry.id,
                                notified_user_id=recipient.id,
                                notified_at=submitted_at + timedelta(minutes=5),
                                response_deadline=deadline,
                                response_type=ResponseType.ACKNOWLEDGED if status_rank(status) >= 2 else ResponseType.NONE,
                                responded_at=(verified_at - timedelta(minutes=15)) if status_rank(status) >= 2 and verified_at else None,
                            )
                        )
                        notifications += 1

                if status != MaterialStatus.DRAFT:
                    names = [
                        f"delivery_note_{entry.id.hex[:8]}.pdf",
                        f"supplier_invoice_{entry.id.hex[:8]}.pdf",
                    ]
                    if status_rank(status) >= 2:
                        names.append(f"site_photo_{entry.id.hex[:8]}.jpg")
                    for n in names:
                        p = EVIDENCE_ROOT / str(entry.id) / n
                        size, digest = write_evidence(p, n, str(entry.id))
                        session.add(
                            EvidenceFile(
                                material_entry_id=entry.id,
                                file_name=n,
                                file_type="image/jpeg" if n.endswith(".jpg") else "application/pdf",
                                file_size=size,
                                file_hash=digest,
                                storage_path=str(p),
                                uploaded_by=creator.id,
                                uploaded_at=(submitted_at or created_at) + timedelta(hours=1),
                            )
                        )
                        evidence_files += 1

        session.commit()

        print("Seeded data for current organization successfully.")
        print(f"Projects created: {len(project_specs)}")
        print(f"Material entries created: {material_entries}")
        print(f"Evidence files created: {evidence_files}")
        print(f"Audit logs created: {audit_logs}")
        print(f"Notifications created: {notifications}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
