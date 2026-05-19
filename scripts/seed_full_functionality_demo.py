from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
import hashlib
from pathlib import Path

from sqlalchemy import select

from app.core.security import get_password_hash
from app.db.session import SessionLocal
from app.models.emission_factor import EmissionFactor
from app.models.evidence_file import EvidenceFile
from app.models.material_entry import MaterialEntry, MaterialStatus
from app.models.organization import Organization
from app.models.project import Project
from app.models.user import User, UserRole

DEMO_ORG_NAME = "Infrasentinel Full Functionality Demo Org"
DEFAULT_PASSWORD = "InfrasentinelDemo#2026"
EVIDENCE_ROOT = Path("storage") / "evidence"

USERS = {
    "admin.demo@infrasentinel.local": UserRole.ADMIN,
    "verifier.demo@infrasentinel.local": UserRole.VERIFIER,
    "auditor.demo@infrasentinel.local": UserRole.AUDITOR,
    "contractor.demo@infrasentinel.local": UserRole.CONTRACTOR_MANAGER,
    "supplier.demo@infrasentinel.local": UserRole.SUPPLIER,
}

PROJECT_SPECS = [
    ("Smart Metro Hub", "Bangalore", date(2026, 1, 1), date(2026, 12, 31)),
    ("Green Hospital Block", "Hyderabad", date(2026, 2, 1), date(2027, 1, 31)),
    ("Transit Tower Annex", "Pune", date(2026, 3, 1), date(2027, 2, 28)),
]

FACTOR_SPECS = [
    ("Concrete C30", Decimal("0.240000"), "tCO2e/m3", "ICE Database"),
    ("Reinforcement Steel", Decimal("1.900000"), "tCO2e/ton", "Ecoinvent"),
    ("Structural Steel", Decimal("2.100000"), "tCO2e/ton", "Ecoinvent"),
    ("Float Glass", Decimal("1.200000"), "tCO2e/ton", "ICE Database"),
]


def _ensure_org(session) -> Organization:
    org = session.execute(select(Organization).where(Organization.name == DEMO_ORG_NAME)).scalar_one_or_none()
    if org is not None:
        return org
    org = Organization(name=DEMO_ORG_NAME)
    session.add(org)
    session.flush()
    return org


def _ensure_user(session, org_id, email: str, role: UserRole) -> User:
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


def _ensure_factor(
    session,
    *,
    material_name: str,
    factor_value: Decimal,
    unit: str,
    source: str,
) -> EmissionFactor:
    factor = session.execute(
        select(EmissionFactor)
        .where(EmissionFactor.material_name == material_name, EmissionFactor.version == 1)
    ).scalar_one_or_none()
    if factor is not None:
        return factor

    factor = EmissionFactor(
        material_name=material_name,
        factor_value=factor_value,
        unit=unit,
        source=source,
        standard_name="Demo Standard",
        region="India",
        source_document_url="https://example.com/demo-factors",
        methodology_reference="Demo seed factor for realistic workflow testing",
        version=1,
        valid_from=date(2025, 1, 1),
        valid_to=None,
        is_active=True,
        created_at=datetime.now(timezone.utc),
    )
    session.add(factor)
    session.flush()
    return factor


def _ensure_project(session, org_id, creator_id, name: str, location: str, start: date, end: date) -> Project:
    project = session.execute(
        select(Project).where(Project.organization_id == org_id, Project.name == name)
    ).scalar_one_or_none()
    if project is not None:
        return project

    project = Project(
        organization_id=org_id,
        created_by_id=creator_id,
        name=name,
        location=location,
        reporting_period_start=start,
        reporting_period_end=end,
        created_at=datetime.combine(start, time(9, 0), tzinfo=timezone.utc),
    )
    session.add(project)
    session.flush()
    return project


def _file_hash(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def _write_evidence(entry_id: str, file_name: str, text: str) -> tuple[str, int, str]:
    path = EVIDENCE_ROOT / entry_id / file_name
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = text.encode("utf-8")
    path.write_bytes(payload)
    return str(path), len(payload), _file_hash(payload)


def _seed_entries_for_project(
    session,
    *,
    project: Project,
    contractor: User,
    verifier: User,
    admin: User,
    supplier: User,
    factors: dict[str, EmissionFactor],
    index_offset: int,
) -> int:
    existing_count = int(
        session.execute(
            select(MaterialEntry).where(MaterialEntry.project_id == project.id)
        ).scalars().all().__len__()
    )
    if existing_count > 0:
        return 0

    blueprints = [
        ("Foundation Concrete", "Concrete C30", Decimal("320.0"), MaterialStatus.LOCKED, 0.12, "LOW", False, False),
        ("Basement Reinforcement", "Reinforcement Steel", Decimal("85.0"), MaterialStatus.APPROVED, 0.42, "MEDIUM", False, False),
        ("Podium Structural Steel", "Structural Steel", Decimal("64.0"), MaterialStatus.VERIFIED, 0.78, "HIGH", True, True),
        ("Facade Glass Panels", "Float Glass", Decimal("24.0"), MaterialStatus.SUBMITTED, 0.23, "LOW", False, False),
        ("Transfer Slab Concrete", "Concrete C30", Decimal("280.0"), MaterialStatus.DRAFT, 0.10, "LOW", False, False),
    ]

    created = 0
    for i, (label, factor_key, quantity, status, ai_risk, ai_level, temporal_flag, audit_required) in enumerate(blueprints):
        factor = factors[factor_key]
        created_at = datetime(2026, 1, 15, 9, 30, tzinfo=timezone.utc) + timedelta(days=(index_offset * 14) + i * 6)
        submitted_at = created_at + timedelta(hours=8) if status in {
            MaterialStatus.SUBMITTED,
            MaterialStatus.VERIFIED,
            MaterialStatus.APPROVED,
            MaterialStatus.LOCKED,
        } else None
        verified_at = submitted_at + timedelta(days=2) if status in {
            MaterialStatus.VERIFIED,
            MaterialStatus.APPROVED,
            MaterialStatus.LOCKED,
        } and submitted_at is not None else None
        locked_at = verified_at + timedelta(days=2) if status == MaterialStatus.LOCKED and verified_at is not None else None

        emission = (quantity * Decimal(str(float(factor.factor_value)))).quantize(Decimal("0.000001"))

        entry = MaterialEntry(
            project_id=project.id,
            material_name=label,
            quantity=quantity,
            supplier_name="Apex Supplies Pvt Ltd",
            supplier_email=supplier.email,
            factor_version_snapshot=factor.version,
            factor_value_snapshot=factor.factor_value,
            factor_unit_snapshot=factor.unit,
            factor_source_snapshot=factor.source,
            calculated_emission=emission,
            status=status,
            created_by_id=contractor.id,
            verified_by_id=verifier.id if verified_at else None,
            approved_by_id=admin.id if status in {MaterialStatus.APPROVED, MaterialStatus.LOCKED} else None,
            submitted_at=submitted_at,
            verified_at=verified_at,
            locked_at=locked_at,
            audit_required=audit_required,
            temporal_anomaly=temporal_flag,
            bim_discrepancy_score=Decimal("0.35") if temporal_flag else Decimal("0.08"),
            bim_validation_status="FLAGGED" if temporal_flag else "PASS",
            ai_risk_score=Decimal(str(ai_risk)),
            ai_risk_level=ai_level,
            ai_anomaly_reason="volume mismatch vs baseline" if temporal_flag else "within expected range",
            signature=f"demo-signature-{project.id.hex[:8]}-{i}",
            signature_algorithm="HMAC-SHA256",
            created_at=created_at,
        )
        session.add(entry)
        session.flush()
        created += 1

        if status != MaterialStatus.DRAFT:
            docs = [
                (f"delivery_note_{entry.id.hex[:8]}.pdf", "application/pdf", "delivery_note"),
                (f"supplier_invoice_{entry.id.hex[:8]}.pdf", "application/pdf", "invoice"),
            ]
            if status in {MaterialStatus.VERIFIED, MaterialStatus.APPROVED, MaterialStatus.LOCKED}:
                docs.append((f"site_photo_{entry.id.hex[:8]}.jpg", "image/jpeg", "site_photo"))

            for file_name, content_type, evidence_type in docs:
                storage_path, file_size, digest = _write_evidence(
                    str(entry.id),
                    file_name,
                    f"Demo evidence for {entry.material_name} in project {project.name}",
                )
                session.add(
                    EvidenceFile(
                        material_entry_id=entry.id,
                        file_name=file_name,
                        file_type=content_type,
                        content_type=content_type,
                        file_size=file_size,
                        file_hash=digest,
                        evidence_type=evidence_type,
                        storage_path=storage_path,
                        uploaded_by=contractor.id,
                        uploaded_at=created_at + timedelta(hours=1),
                    )
                )

    return created


def main() -> int:
    with SessionLocal() as session:
        with session.begin():
            org = _ensure_org(session)

            users = {
                email: _ensure_user(session, org.id, email, role)
                for email, role in USERS.items()
            }

            factors = {}
            for material_name, factor_value, unit, source in FACTOR_SPECS:
                factors[material_name] = _ensure_factor(
                    session,
                    material_name=material_name,
                    factor_value=factor_value,
                    unit=unit,
                    source=source,
                )

            projects = [
                _ensure_project(
                    session,
                    org.id,
                    users["admin.demo@infrasentinel.local"].id,
                    name,
                    location,
                    start,
                    end,
                )
                for name, location, start, end in PROJECT_SPECS
            ]

            total_created_entries = 0
            for idx, project in enumerate(projects):
                total_created_entries += _seed_entries_for_project(
                    session,
                    project=project,
                    contractor=users["contractor.demo@infrasentinel.local"],
                    verifier=users["verifier.demo@infrasentinel.local"],
                    admin=users["admin.demo@infrasentinel.local"],
                    supplier=users["supplier.demo@infrasentinel.local"],
                    factors=factors,
                    index_offset=idx,
                )

        print("Demo identity and feature data ready.")
        print("Use these login credentials (same password for all):")
        print(f"Password: {DEFAULT_PASSWORD}")
        for email, role in USERS.items():
            print(f"- {role.value}: {email}")
        print(f"Projects ensured: {len(PROJECT_SPECS)}")
        print(f"Material entries created this run: {total_created_entries}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
