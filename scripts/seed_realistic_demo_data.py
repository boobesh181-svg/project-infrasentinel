from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
import hashlib
from pathlib import Path
import random
import re

from sqlalchemy import func, select

from app.core.security import get_password_hash
from app.db.session import SessionLocal
from app.models.audit_log import AuditLog
from app.models.emission_factor import EmissionFactor
from app.models.evidence_file import EvidenceFile
from app.models.material_entry import MaterialEntry, MaterialStatus
from app.models.notification import Notification, ResponseType
from app.models.organization import Organization
from app.models.project import Project
from app.models.user import User, UserRole


RNG_SEED = 20260317
DEFAULT_PASSWORD = "InfrasentinelDemo#2026"
EVIDENCE_ROOT = Path("storage") / "evidence"


@dataclass(frozen=True)
class OrgSeed:
    name: str
    city: str
    domain: str
    created_at: datetime


@dataclass(frozen=True)
class UserSeed:
    name: str
    role: UserRole


@dataclass(frozen=True)
class ProjectSeed:
    name: str
    location: str
    start: date
    end: date
    org_name: str


@dataclass(frozen=True)
class EmissionFactorSeed:
    material_name: str
    factor_value: Decimal
    unit: str
    source: str
    standard_name: str
    region: str
    source_document_url: str
    methodology_reference: str
    version: int
    valid_from: date


@dataclass(frozen=True)
class MaterialTemplate:
    phase: str
    material_name: str
    action: str


def utc_dt(year: int, month: int, day: int, hour: int = 9, minute: int = 0) -> datetime:
    return datetime(year, month, day, hour, minute, tzinfo=timezone.utc)


def to_slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")


def status_rank(status: MaterialStatus) -> int:
    order = {
        MaterialStatus.DRAFT: 0,
        MaterialStatus.SUBMITTED: 1,
        MaterialStatus.VERIFIED: 2,
        MaterialStatus.APPROVED: 3,
        MaterialStatus.LOCKED: 4,
    }
    return order[status]


def generate_status_pool(rng: random.Random) -> list[MaterialStatus]:
    pool: list[MaterialStatus] = []
    pool.extend([MaterialStatus.DRAFT] * 30)
    pool.extend([MaterialStatus.SUBMITTED] * 40)
    pool.extend([MaterialStatus.VERIFIED] * 30)
    pool.extend([MaterialStatus.APPROVED] * 25)
    pool.extend([MaterialStatus.LOCKED] * 15)
    rng.shuffle(pool)
    return pool


def count_rows(session, model) -> int:
    return int(session.execute(select(func.count()).select_from(model)).scalar_one())


def any_core_table_has_data(session) -> tuple[bool, dict[str, int]]:
    counts = {
        "organizations": count_rows(session, Organization),
        "users": count_rows(session, User),
        "projects": count_rows(session, Project),
        "emission_factors": count_rows(session, EmissionFactor),
        "material_entries": count_rows(session, MaterialEntry),
        "evidence_files": count_rows(session, EvidenceFile),
        "audit_logs": count_rows(session, AuditLog),
        "notifications": count_rows(session, Notification),
    }
    return any(v > 0 for v in counts.values()), counts


def seed_organizations(session) -> dict[str, Organization]:
    orgs = [
        OrgSeed(
            name="GreenBuild Construction Pvt Ltd",
            city="Bangalore",
            domain="greenbuild.in",
            created_at=utc_dt(2024, 2, 12),
        ),
        OrgSeed(
            name="EcoInfra Developers Ltd",
            city="Mumbai",
            domain="ecoinfra.in",
            created_at=utc_dt(2024, 3, 18),
        ),
        OrgSeed(
            name="UrbanRise Infrastructure Group",
            city="Hyderabad",
            domain="urbanrise.co.in",
            created_at=utc_dt(2024, 4, 22),
        ),
        OrgSeed(
            name="MetroCore Builders",
            city="Delhi NCR",
            domain="metrocore.in",
            created_at=utc_dt(2024, 5, 6),
        ),
    ]

    result: dict[str, Organization] = {}
    for item in orgs:
        record = Organization(
            name=item.name,
            created_at=item.created_at,
        )
        session.add(record)
        session.flush()
        result[item.name] = record
    return result


def seed_users(session, orgs: dict[str, Organization]) -> tuple[dict[str, User], dict[str, str]]:
    roster: dict[str, list[UserSeed]] = {
        "GreenBuild Construction Pvt Ltd": [
            UserSeed("Rahul Menon", UserRole.ADMIN),
            UserSeed("Kavya Iyer", UserRole.CREATOR),
            UserSeed("Arjun Patel", UserRole.CREATOR),
            UserSeed("Priya Nair", UserRole.VERIFIER),
            UserSeed("Vikram Rao", UserRole.APPROVER),
        ],
        "EcoInfra Developers Ltd": [
            UserSeed("Neha Sharma", UserRole.ADMIN),
            UserSeed("Rohan Desai", UserRole.CREATOR),
            UserSeed("Aisha Khan", UserRole.CREATOR),
            UserSeed("Sanjay Kulkarni", UserRole.VERIFIER),
            UserSeed("Meera Joshi", UserRole.APPROVER),
        ],
        "UrbanRise Infrastructure Group": [
            UserSeed("Anita Verma", UserRole.ADMIN),
            UserSeed("Karthik Reddy", UserRole.CREATOR),
            UserSeed("Divya Menon", UserRole.CREATOR),
            UserSeed("Farhan Ali", UserRole.VERIFIER),
            UserSeed("Girish Rao", UserRole.APPROVER),
        ],
        "MetroCore Builders": [
            UserSeed("Siddharth Malhotra", UserRole.ADMIN),
            UserSeed("Pooja Bansal", UserRole.CREATOR),
            UserSeed("Nikhil Sinha", UserRole.CREATOR),
            UserSeed("Tanvi Arora", UserRole.VERIFIER),
            UserSeed("Aditya Khanna", UserRole.APPROVER),
        ],
    }

    org_domains = {
        "GreenBuild Construction Pvt Ltd": "greenbuild.in",
        "EcoInfra Developers Ltd": "ecoinfra.in",
        "UrbanRise Infrastructure Group": "urbanrise.co.in",
        "MetroCore Builders": "metrocore.in",
    }

    users_by_email: dict[str, User] = {}
    names_to_emails: dict[str, str] = {}
    created_at_base = utc_dt(2024, 6, 1)

    for org_name, user_seeds in roster.items():
        domain = org_domains[org_name]
        org = orgs[org_name]
        for idx, seed in enumerate(user_seeds):
            local = seed.name.lower().replace(" ", ".")
            email = f"{local}@{domain}"
            user = User(
                organization_id=org.id,
                email=email,
                hashed_password=get_password_hash(DEFAULT_PASSWORD),
                role=seed.role,
                is_active=True,
                created_at=created_at_base + timedelta(days=idx),
            )
            session.add(user)
            session.flush()
            users_by_email[email] = user
            names_to_emails[seed.name] = email
    return users_by_email, names_to_emails


def seed_projects(session, orgs: dict[str, Organization], users_by_email: dict[str, User]) -> list[Project]:
    plans = [
        ProjectSeed("Green Tower Phase 1", "Bangalore", date(2024, 2, 1), date(2025, 11, 30), "GreenBuild Construction Pvt Ltd"),
        ProjectSeed("Metro Mall Expansion", "Hyderabad", date(2024, 4, 10), date(2026, 1, 15), "UrbanRise Infrastructure Group"),
        ProjectSeed("Skyline Residences", "Chennai", date(2024, 6, 5), date(2026, 3, 30), "EcoInfra Developers Ltd"),
        ProjectSeed("Riverfront Towers", "Ahmedabad", date(2024, 8, 1), date(2026, 5, 20), "MetroCore Builders"),
        ProjectSeed("EcoPark IT Campus", "Pune", date(2024, 9, 12), date(2026, 6, 30), "EcoInfra Developers Ltd"),
        ProjectSeed("SmartTech Business Park", "Gurgaon", date(2025, 1, 8), date(2026, 12, 20), "MetroCore Builders"),
        ProjectSeed("BayView Commercial Center", "Jakarta", date(2024, 5, 15), date(2026, 2, 28), "UrbanRise Infrastructure Group"),
        ProjectSeed("Central Transit Hub", "Kuala Lumpur", date(2024, 7, 22), date(2026, 4, 15), "GreenBuild Construction Pvt Ltd"),
        ProjectSeed("Harborfront Mixed Use", "Singapore", date(2025, 2, 1), date(2026, 11, 30), "EcoInfra Developers Ltd"),
        ProjectSeed("Lotus Financial District", "Mumbai", date(2025, 3, 10), date(2026, 12, 31), "GreenBuild Construction Pvt Ltd"),
    ]

    org_admin_email = {
        "GreenBuild Construction Pvt Ltd": "rahul.menon@greenbuild.in",
        "EcoInfra Developers Ltd": "neha.sharma@ecoinfra.in",
        "UrbanRise Infrastructure Group": "anita.verma@urbanrise.co.in",
        "MetroCore Builders": "siddharth.malhotra@metrocore.in",
    }

    projects: list[Project] = []
    for item in plans:
        org = orgs[item.org_name]
        owner = users_by_email[org_admin_email[item.org_name]]
        project = Project(
            organization_id=org.id,
            created_by_id=owner.id,
            name=item.name,
            location=item.location,
            reporting_period_start=item.start,
            reporting_period_end=item.end,
            created_at=datetime.combine(item.start - timedelta(days=30), time(10, 0), tzinfo=timezone.utc),
        )
        session.add(project)
        projects.append(project)
    session.flush()
    return projects


def seed_emission_factors(session) -> dict[str, EmissionFactor]:
    factors = [
        EmissionFactorSeed(
            material_name="Concrete C30",
            factor_value=Decimal("0.24"),
            unit="tCO2e/m3",
            source="ICE Database",
            standard_name="ICE v3.0",
            region="India & Southeast Asia",
            source_document_url="https://circularecology.com/embodied-carbon-footprint-database.html",
            methodology_reference="Cradle-to-gate for C30 ready-mix concrete",
            version=1,
            valid_from=date(2024, 1, 1),
        ),
        EmissionFactorSeed(
            material_name="Reinforcement Steel",
            factor_value=Decimal("1.90"),
            unit="tCO2e/ton",
            source="Ecoinvent",
            standard_name="Ecoinvent v3.9",
            region="Asia",
            source_document_url="https://ecoinvent.org",
            methodology_reference="Average EAF route steel production",
            version=1,
            valid_from=date(2024, 1, 1),
        ),
        EmissionFactorSeed(
            material_name="Structural Steel",
            factor_value=Decimal("2.10"),
            unit="tCO2e/ton",
            source="Ecoinvent",
            standard_name="Ecoinvent v3.9",
            region="Asia",
            source_document_url="https://ecoinvent.org",
            methodology_reference="Section steel production and rolling",
            version=1,
            valid_from=date(2024, 1, 1),
        ),
        EmissionFactorSeed(
            material_name="Float Glass",
            factor_value=Decimal("1.20"),
            unit="tCO2e/ton",
            source="ICE Database",
            standard_name="ICE v3.0",
            region="Global",
            source_document_url="https://circularecology.com/embodied-carbon-footprint-database.html",
            methodology_reference="Flat float glass production",
            version=1,
            valid_from=date(2024, 1, 1),
        ),
        EmissionFactorSeed(
            material_name="Aluminium Frames",
            factor_value=Decimal("8.20"),
            unit="tCO2e/ton",
            source="Ecoinvent",
            standard_name="Ecoinvent v3.9",
            region="Global",
            source_document_url="https://ecoinvent.org",
            methodology_reference="Primary aluminium extrusion profile",
            version=1,
            valid_from=date(2024, 1, 1),
        ),
        EmissionFactorSeed(
            material_name="Cement OPC",
            factor_value=Decimal("0.90"),
            unit="tCO2e/ton",
            source="ICE Database",
            standard_name="ICE v3.0",
            region="India",
            source_document_url="https://circularecology.com/embodied-carbon-footprint-database.html",
            methodology_reference="Ordinary Portland Cement production",
            version=1,
            valid_from=date(2024, 1, 1),
        ),
    ]

    by_name: dict[str, EmissionFactor] = {}
    for i, f in enumerate(factors):
        record = EmissionFactor(
            material_name=f.material_name,
            factor_value=f.factor_value,
            unit=f.unit,
            source=f.source,
            standard_name=f.standard_name,
            region=f.region,
            source_document_url=f.source_document_url,
            methodology_reference=f.methodology_reference,
            version=f.version,
            valid_from=f.valid_from,
            valid_to=None,
            is_active=True,
            created_at=utc_dt(2024, 1, 5) + timedelta(days=i),
        )
        session.add(record)
        session.flush()
        by_name[f.material_name] = record
    return by_name


def pick_quantity(material: str, rng: random.Random) -> Decimal:
    if material == "Concrete C30":
        return Decimal(str(round(rng.uniform(150, 500), 2)))
    if material in {"Reinforcement Steel", "Structural Steel", "Cement OPC"}:
        return Decimal(str(round(rng.uniform(20, 100), 2)))
    if material in {"Float Glass", "Aluminium Frames"}:
        return Decimal(str(round(rng.uniform(5, 30), 2)))
    return Decimal("10.00")


def evidence_templates(material: str, phase: str, supplier_slug: str) -> list[tuple[str, str]]:
    phase_slug = to_slug(phase)
    if material == "Concrete C30":
        return [
            (f"delivery_note_concrete_{phase_slug}_{supplier_slug}.pdf", "application/pdf"),
            (f"quality_certificate_c30_{phase_slug}.pdf", "application/pdf"),
            (f"site_photo_concrete_pour_{phase_slug}.jpg", "image/jpeg"),
        ]
    if material in {"Reinforcement Steel", "Structural Steel"}:
        return [
            (f"steel_supplier_invoice_{supplier_slug}_{phase_slug}.pdf", "application/pdf"),
            (f"mill_test_certificate_steel_{phase_slug}.pdf", "application/pdf"),
            (f"site_photo_steel_installation_{phase_slug}.jpg", "image/jpeg"),
        ]
    if material == "Float Glass":
        return [
            (f"glass_delivery_note_{supplier_slug}_{phase_slug}.pdf", "application/pdf"),
            (f"glass_installation_photo_{phase_slug}.jpg", "image/jpeg"),
            (f"glass_quality_certificate_{phase_slug}.pdf", "application/pdf"),
        ]
    return [
        (f"aluminium_invoice_{supplier_slug}_{phase_slug}.pdf", "application/pdf"),
        (f"aluminium_installation_photo_{phase_slug}.jpg", "image/jpeg"),
        (f"aluminium_batch_certificate_{phase_slug}.pdf", "application/pdf"),
    ]


def write_evidence_file(path: Path, logical_name: str, entry_id: str, supplier: str, created_at: datetime) -> tuple[int, str]:
    body = (
        f"Infrasentinel Evidence\n"
        f"File: {logical_name}\n"
        f"Entry: {entry_id}\n"
        f"Supplier: {supplier}\n"
        f"Captured At: {created_at.isoformat()}\n"
    ).encode("utf-8")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(body)
    digest = hashlib.sha256(body).hexdigest()
    return len(body), digest


def seed_material_entries_and_related(
    session,
    projects: Sequence[Project],
    users_by_email: dict[str, User],
    factors: dict[str, EmissionFactor],
) -> dict[str, int]:
    rng = random.Random(RNG_SEED)
    statuses = generate_status_pool(rng)

    org_creators = {
        "GreenBuild Construction Pvt Ltd": [
            users_by_email["kavya.iyer@greenbuild.in"],
            users_by_email["arjun.patel@greenbuild.in"],
        ],
        "EcoInfra Developers Ltd": [
            users_by_email["rohan.desai@ecoinfra.in"],
            users_by_email["aisha.khan@ecoinfra.in"],
        ],
        "UrbanRise Infrastructure Group": [
            users_by_email["karthik.reddy@urbanrise.co.in"],
            users_by_email["divya.menon@urbanrise.co.in"],
        ],
        "MetroCore Builders": [
            users_by_email["pooja.bansal@metrocore.in"],
            users_by_email["nikhil.sinha@metrocore.in"],
        ],
    }
    org_verifier = {
        "GreenBuild Construction Pvt Ltd": users_by_email["priya.nair@greenbuild.in"],
        "EcoInfra Developers Ltd": users_by_email["sanjay.kulkarni@ecoinfra.in"],
        "UrbanRise Infrastructure Group": users_by_email["farhan.ali@urbanrise.co.in"],
        "MetroCore Builders": users_by_email["tanvi.arora@metrocore.in"],
    }
    org_approver = {
        "GreenBuild Construction Pvt Ltd": users_by_email["vikram.rao@greenbuild.in"],
        "EcoInfra Developers Ltd": users_by_email["meera.joshi@ecoinfra.in"],
        "UrbanRise Infrastructure Group": users_by_email["girish.rao@urbanrise.co.in"],
        "MetroCore Builders": users_by_email["aditya.khanna@metrocore.in"],
    }
    org_admin = {
        "GreenBuild Construction Pvt Ltd": users_by_email["rahul.menon@greenbuild.in"],
        "EcoInfra Developers Ltd": users_by_email["neha.sharma@ecoinfra.in"],
        "UrbanRise Infrastructure Group": users_by_email["anita.verma@urbanrise.co.in"],
        "MetroCore Builders": users_by_email["siddharth.malhotra@metrocore.in"],
    }

    phases = [
        ("Foundation", 0.00, 0.20),
        ("Basement", 0.15, 0.35),
        ("Structural Frame", 0.30, 0.65),
        ("Facade Installation", 0.55, 0.85),
        ("Interior Construction", 0.75, 1.00),
    ]

    templates = [
        MaterialTemplate("Foundation", "Concrete C30", "Concrete Pour"),
        MaterialTemplate("Foundation", "Cement OPC", "Cement Delivery"),
        MaterialTemplate("Basement", "Reinforcement Steel", "Rebar Installation"),
        MaterialTemplate("Basement", "Concrete C30", "Concrete Pour"),
        MaterialTemplate("Structural Frame", "Structural Steel", "Steel Columns Installation"),
        MaterialTemplate("Structural Frame", "Reinforcement Steel", "Rebar Cage Installation"),
        MaterialTemplate("Structural Frame", "Concrete C30", "Level Slab Pour"),
        MaterialTemplate("Facade Installation", "Float Glass", "Facade Glass Panel Delivery"),
        MaterialTemplate("Facade Installation", "Aluminium Frames", "Aluminium Window Frame Installation"),
        MaterialTemplate("Interior Construction", "Cement OPC", "Interior Screed Material Delivery"),
        MaterialTemplate("Interior Construction", "Float Glass", "Interior Partition Glass Delivery"),
        MaterialTemplate("Interior Construction", "Aluminium Frames", "Interior Frame Installation"),
    ]

    suppliers = {
        "Concrete C30": "UltraTech Cement Ltd",
        "Reinforcement Steel": "Tata Steel",
        "Structural Steel": "JSW Steel",
        "Float Glass": "Saint-Gobain Glass India",
        "Aluminium Frames": "Hindalco Aluminium",
        "Cement OPC": "ACC Limited",
    }

    counts = {
        "material_entries": 0,
        "evidence_files": 0,
        "audit_logs": 0,
        "notifications": 0,
    }

    status_index = 0
    for project in projects:
        org_name = next(
            name for name, admin_user in org_admin.items() if admin_user.organization_id == project.organization_id
        )
        creators = org_creators[org_name]
        verifier = org_verifier[org_name]
        approver = org_approver[org_name]
        owner = org_admin[org_name]

        total_days = max(30, (project.reporting_period_end - project.reporting_period_start).days)

        for local_idx in range(14):
            status = statuses[status_index]
            status_index += 1

            template = templates[(local_idx + rng.randint(0, len(templates) - 1)) % len(templates)]
            phase_range = next((start, end) for phase, start, end in phases if phase == template.phase)
            start_day = int(total_days * phase_range[0])
            end_day = int(total_days * phase_range[1])
            entry_day_offset = rng.randint(start_day, max(start_day, end_day))
            created_at = datetime.combine(
                project.reporting_period_start + timedelta(days=entry_day_offset),
                time(hour=rng.randint(8, 17), minute=rng.choice([0, 15, 30, 45])),
                tzinfo=timezone.utc,
            )

            creator = creators[local_idx % len(creators)]
            factor = factors[template.material_name]
            quantity = pick_quantity(template.material_name, rng)
            emission = (quantity * Decimal(str(factor.factor_value))).quantize(Decimal("0.000001"))
            supplier = suppliers[template.material_name]

            material_name = f"{template.action} - {template.phase}"
            if template.phase == "Structural Frame" and template.material_name == "Structural Steel":
                material_name = "Structural Steel Columns Installation - Structural Frame"
            if template.phase == "Basement" and template.material_name == "Concrete C30":
                material_name = "Concrete Pour - Basement Foundation"

            submitted_at = None
            verified_at = None
            approved_at = None
            locked_at = None

            if status_rank(status) >= 1:
                submitted_at = created_at + timedelta(hours=rng.randint(4, 36))
            if status_rank(status) >= 2 and submitted_at is not None:
                verified_at = submitted_at + timedelta(days=rng.randint(1, 4), hours=rng.randint(1, 8))
            if status_rank(status) >= 3 and verified_at is not None:
                approved_at = verified_at + timedelta(days=rng.randint(1, 3), hours=rng.randint(1, 5))
            if status_rank(status) >= 4 and approved_at is not None:
                locked_at = approved_at + timedelta(days=rng.randint(1, 5), hours=rng.randint(1, 6))

            entry = MaterialEntry(
                project_id=project.id,
                material_name=material_name,
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
            counts["material_entries"] += 1

            audit_events: list[tuple[str, datetime, User, dict, dict]] = [
                (
                    "CREATE_ENTRY",
                    created_at,
                    creator,
                    {},
                    {
                        "status": "DRAFT",
                        "material_name": material_name,
                        "phase": template.phase,
                        "supplier": supplier,
                        "quantity": float(quantity),
                        "factor": template.material_name,
                    },
                )
            ]
            if submitted_at is not None:
                audit_events.append(
                    (
                        "SUBMIT_ENTRY",
                        submitted_at,
                        creator,
                        {"status": "DRAFT"},
                        {"status": "SUBMITTED", "supplier": supplier},
                    )
                )
            if verified_at is not None:
                audit_events.append(
                    (
                        "VERIFY_ENTRY",
                        verified_at,
                        verifier,
                        {"status": "SUBMITTED"},
                        {"status": "VERIFIED", "verified_by": verifier.email},
                    )
                )
            if approved_at is not None:
                audit_events.append(
                    (
                        "APPROVE_ENTRY",
                        approved_at,
                        approver,
                        {"status": "VERIFIED"},
                        {"status": "APPROVED", "approved_by": approver.email},
                    )
                )
            if locked_at is not None:
                audit_events.append(
                    (
                        "LOCK_ENTRY",
                        locked_at,
                        approver,
                        {"status": "APPROVED"},
                        {"status": "LOCKED", "locked_by": approver.email},
                    )
                )

            for action, ts, actor, prev_state, new_state in audit_events:
                session.add(
                    AuditLog(
                        entity_type="material_entry",
                        entity_id=entry.id,
                        action=action,
                        previous_state=prev_state,
                        new_state=new_state,
                        performed_by_id=actor.id,
                        timestamp=ts,
                    )
                )
                counts["audit_logs"] += 1

            if submitted_at is not None:
                response_deadline = submitted_at + timedelta(hours=48)
                for recipient in (owner, verifier):
                    response_type = ResponseType.NONE
                    responded_at = None

                    if status_rank(status) >= 2:
                        response_type = ResponseType.ACKNOWLEDGED
                        target_time = verified_at if verified_at is not None else submitted_at + timedelta(hours=12)
                        responded_at = min(target_time - timedelta(minutes=30), response_deadline - timedelta(minutes=30))
                    elif status == MaterialStatus.SUBMITTED and rng.random() < 0.2:
                        response_type = ResponseType.DISPUTED
                        responded_at = submitted_at + timedelta(hours=rng.randint(4, 16))

                    session.add(
                        Notification(
                            entity_type="material_entry",
                            entity_id=entry.id,
                            notified_user_id=recipient.id,
                            notified_at=submitted_at + timedelta(minutes=5 if recipient.id == owner.id else 8),
                            response_deadline=response_deadline,
                            response_type=response_type,
                            responded_at=responded_at,
                        )
                    )
                    counts["notifications"] += 1

            if status != MaterialStatus.DRAFT:
                e_templates = evidence_templates(template.material_name, template.phase, to_slug(supplier))
                evidence_count = rng.randint(1, 3)
                selected = e_templates[:evidence_count]

                for idx, (base_name, mime_type) in enumerate(selected, start=1):
                    logical_name = f"{entry.id.hex[:8]}_{idx}_{base_name}"
                    file_path = EVIDENCE_ROOT / str(entry.id) / logical_name
                    size, digest = write_evidence_file(
                        file_path,
                        logical_name,
                        str(entry.id),
                        supplier,
                        created_at,
                    )
                    uploaded_at = (submitted_at or created_at) + timedelta(hours=idx)
                    session.add(
                        EvidenceFile(
                            material_entry_id=entry.id,
                            file_name=logical_name,
                            file_type=mime_type,
                            file_size=size,
                            file_hash=digest,
                            storage_path=str(file_path),
                            uploaded_by=creator.id,
                            uploaded_at=uploaded_at,
                        )
                    )
                    counts["evidence_files"] += 1

    return counts


def main() -> int:
    rng = random.Random(RNG_SEED)
    _ = rng

    with SessionLocal() as session:
        has_data, counts = any_core_table_has_data(session)
        if has_data:
            print("Seed skipped: core tables are not empty.")
            for key, value in counts.items():
                print(f"{key}: {value}")
            return 0

        with session.begin():
            orgs = seed_organizations(session)
            users_by_email, _ = seed_users(session, orgs)
            projects = seed_projects(session, orgs, users_by_email)
            factors = seed_emission_factors(session)
            related_counts = seed_material_entries_and_related(session, projects, users_by_email, factors)

        organizations_created = len(orgs)
        users_created = len(users_by_email)
        projects_created = len(projects)
        factors_created = len(factors)

    print("Seed completed successfully")
    print()
    print(f"Organizations created: {organizations_created}")
    print(f"Users created: {users_created}")
    print(f"Projects created: {projects_created}")
    print(f"Emission factors created: {factors_created}")
    print(f"Material entries created: {related_counts['material_entries']}")
    print(f"Evidence files created: {related_counts['evidence_files']}")
    print(f"Audit logs created: {related_counts['audit_logs']}")
    print(f"Notifications created: {related_counts['notifications']}")
    print(f"Demo user password: {DEFAULT_PASSWORD}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
