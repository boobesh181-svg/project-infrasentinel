from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
import hashlib
from typing import Iterable

from sqlalchemy import select

from app.core.config import get_settings
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


@dataclass(frozen=True)
class SeedUser:
    email: str
    role: UserRole
    organization_name: str
    password: str


def _utc(dt: datetime) -> datetime:
    return dt.astimezone(timezone.utc)


def _hash_for_file(*parts: str) -> str:
    digest = hashlib.sha256("|".join(parts).encode("utf-8")).hexdigest()
    return digest


def _get_or_create(session, model, defaults: dict | None = None, **filters):
    instance = session.execute(select(model).filter_by(**filters)).scalar_one_or_none()
    if instance is not None:
        return instance, False
    params = dict(filters)
    if defaults:
        params.update(defaults)
    instance = model(**params)
    session.add(instance)
    session.flush()
    return instance, True


def _seed_organizations(session) -> dict[str, Organization]:
    org_names = [
        "GreenBuild Infrastructure Pvt Ltd",
        "UrbanEdge Developers",
        "EcoMaterials Cement Ltd",
        "CarbonVerify Consulting",
        "MetroBuild Authority",
    ]
    organizations: dict[str, Organization] = {}
    for name in org_names:
        org, _ = _get_or_create(session, Organization, name=name)
        organizations[name] = org
    return organizations


def _seed_users(session, organizations: dict[str, Organization]) -> dict[str, User]:
    users = [
        SeedUser(
            email="admin@infrasentinel.local",
            role=UserRole.ADMIN,
            organization_name="GreenBuild Infrastructure Pvt Ltd",
            password="InfrasentinelAdmin#2026",
        ),
        SeedUser(
            email="rahul.menon@greenbuild.in",
            role=UserRole.CREATOR,
            organization_name="GreenBuild Infrastructure Pvt Ltd",
            password="RahulDemo#2026",
        ),
        SeedUser(
            email="kavya.iyer@greenbuild.in",
            role=UserRole.VERIFIER,
            organization_name="GreenBuild Infrastructure Pvt Ltd",
            password="KavyaDemo#2026",
        ),
        SeedUser(
            email="anita.sharma@carbonverify.co",
            role=UserRole.VERIFIER,
            organization_name="CarbonVerify Consulting",
            password="AnitaDemo#2026",
        ),
        SeedUser(
            email="david.wong@urbanedge.com",
            role=UserRole.APPROVER,
            organization_name="UrbanEdge Developers",
            password="DavidDemo#2026",
        ),
        SeedUser(
            email="maria.alvarez@metrobuild.gov",
            role=UserRole.APPROVER,
            organization_name="MetroBuild Authority",
            password="MariaDemo#2026",
        ),
    ]

    created: dict[str, User] = {}
    for seed_user in users:
        org = organizations[seed_user.organization_name]
        user, _ = _get_or_create(
            session,
            User,
            defaults={
                "organization_id": org.id,
                "hashed_password": get_password_hash(seed_user.password),
                "role": seed_user.role,
                "is_active": True,
            },
            email=seed_user.email,
        )
        created[seed_user.email] = user
    return created


def _seed_project(session, org: Organization, creator: User) -> Project:
    project, _ = _get_or_create(
        session,
        Project,
        defaults={
            "organization_id": org.id,
            "created_by_id": creator.id,
            "location": "Bangalore, India",
            "reporting_period_start": date(2026, 1, 1),
            "reporting_period_end": date(2026, 6, 30),
        },
        name="Green Tower Commercial Complex",
    )
    return project


def _seed_emission_factors(session) -> dict[str, EmissionFactor]:
    factors = [
        {
            "material_name": "Portland Cement",
            "factor_value": 0.900000,
            "unit": "tCO2e/ton",
            "source": "ICE Database",
            "standard_name": "ICE v3.0",
            "region": "South Asia",
            "source_document_url": "https://circularecology.com/embodied-carbon-footprint-database.html",
            "methodology_reference": "Cradle-to-gate emissions for cement production",
            "version": 3,
            "valid_from": date(2025, 1, 1),
            "valid_to": None,
            "is_active": True,
        },
        {
            "material_name": "Reinforced Steel",
            "factor_value": 1.850000,
            "unit": "tCO2e/ton",
            "source": "EPD International",
            "standard_name": "EN 15804+A2",
            "region": "Asia Pacific",
            "source_document_url": "https://www.environdec.com/library",
            "methodology_reference": "Average EAF route emissions",
            "version": 1,
            "valid_from": date(2025, 6, 1),
            "valid_to": None,
            "is_active": True,
        },
        {
            "material_name": "Ready-Mix Concrete",
            "factor_value": 0.320000,
            "unit": "tCO2e/m3",
            "source": "Manufacturer Environmental Product Declaration",
            "standard_name": "ISO 14025",
            "region": "India",
            "source_document_url": "https://example.com/epd/ready-mix-concrete",
            "methodology_reference": "Batch plant average, 35 MPa mix",
            "version": 2,
            "valid_from": date(2025, 3, 1),
            "valid_to": None,
            "is_active": True,
        },
        {
            "material_name": "Structural Steel",
            "factor_value": 1.700000,
            "unit": "tCO2e/ton",
            "source": "ICE Database",
            "standard_name": "ICE v3.0",
            "region": "Global",
            "source_document_url": "https://circularecology.com/embodied-carbon-footprint-database.html",
            "methodology_reference": "Average blast furnace route",
            "version": 3,
            "valid_from": date(2025, 1, 1),
            "valid_to": None,
            "is_active": True,
        },
        {
            "material_name": "Glass Panels",
            "factor_value": 1.200000,
            "unit": "tCO2e/ton",
            "source": "EPD International",
            "standard_name": "EN 15804+A2",
            "region": "Europe",
            "source_document_url": "https://www.environdec.com/library",
            "methodology_reference": "Flat glass manufacturing average",
            "version": 1,
            "valid_from": date(2024, 10, 1),
            "valid_to": None,
            "is_active": True,
        },
        {
            "material_name": "Aluminium Frames",
            "factor_value": 9.600000,
            "unit": "tCO2e/ton",
            "source": "Manufacturer Environmental Product Declaration",
            "standard_name": "ISO 14025",
            "region": "Global",
            "source_document_url": "https://example.com/epd/aluminium-frames",
            "methodology_reference": "Primary aluminium, average grid",
            "version": 1,
            "valid_from": date(2025, 2, 1),
            "valid_to": None,
            "is_active": True,
        },
    ]

    created: dict[str, EmissionFactor] = {}
    for factor in factors:
        ef, _ = _get_or_create(
            session,
            EmissionFactor,
            defaults={
                "factor_value": factor["factor_value"],
                "unit": factor["unit"],
                "source": factor["source"],
                "standard_name": factor["standard_name"],
                "region": factor["region"],
                "source_document_url": factor["source_document_url"],
                "methodology_reference": factor["methodology_reference"],
                "valid_from": factor["valid_from"],
                "valid_to": factor["valid_to"],
                "is_active": factor["is_active"],
            },
            material_name=factor["material_name"],
            version=factor["version"],
        )
        created[factor["material_name"]] = ef
    return created


def _create_material_entry(
    session,
    project: Project,
    creator: User,
    verifier: User,
    approver: User,
    ef: EmissionFactor,
    material_name: str,
    quantity: float,
    status: MaterialStatus,
    created_at: datetime,
    verified: bool = False,
    locked: bool = False,
) -> MaterialEntry:
    calculated_emission = float(quantity) * float(ef.factor_value)

    defaults = {
        "project_id": project.id,
        "material_name": material_name,
        "quantity": quantity,
        "factor_version_snapshot": ef.version,
        "factor_value_snapshot": ef.factor_value,
        "factor_unit_snapshot": ef.unit,
        "factor_source_snapshot": ef.source,
        "calculated_emission": calculated_emission,
        "status": status,
        "created_by_id": creator.id,
        "verified_by_id": verifier.id if verified else None,
        "approved_by_id": approver.id if status == MaterialStatus.APPROVED else None,
        "locked_at": created_at if locked else None,
        "created_at": created_at,
    }

    entry, _ = _get_or_create(
        session,
        MaterialEntry,
        defaults=defaults,
        project_id=project.id,
        material_name=material_name,
        quantity=quantity,
        status=status,
        created_by_id=creator.id,
    )
    return entry


def _seed_material_entries(
    session,
    project: Project,
    users: dict[str, User],
    factors: dict[str, EmissionFactor],
) -> list[MaterialEntry]:
    creator = users["rahul.menon@greenbuild.in"]
    verifier = users["anita.sharma@carbonverify.co"]
    approver = users["david.wong@urbanedge.com"]

    base_time = datetime(2026, 2, 5, 9, 30, tzinfo=timezone.utc)

    entries = [
        _create_material_entry(
            session,
            project,
            creator,
            verifier,
            approver,
            factors["Portland Cement"],
            "Portland Cement",
            500.0,
            MaterialStatus.LOCKED,
            base_time,
            verified=True,
            locked=True,
        ),
        _create_material_entry(
            session,
            project,
            creator,
            verifier,
            approver,
            factors["Reinforced Steel"],
            "Reinforced Steel",
            200.0,
            MaterialStatus.VERIFIED,
            base_time + timedelta(days=3),
            verified=True,
        ),
        _create_material_entry(
            session,
            project,
            creator,
            verifier,
            approver,
            factors["Ready-Mix Concrete"],
            "Ready-Mix Concrete",
            1200.0,
            MaterialStatus.SUBMITTED,
            base_time + timedelta(days=6),
        ),
    ]
    return entries


def _seed_evidence_files(
    session,
    entries: Iterable[MaterialEntry],
    uploader: User,
) -> list[EvidenceFile]:
    evidence_files: list[EvidenceFile] = []
    for entry in entries:
        file_specs = [
            ("supplier_invoice.pdf", "application/pdf", 245_000),
            ("delivery_note.pdf", "application/pdf", 120_000),
            ("environmental_product_declaration.pdf", "application/pdf", 420_000),
            ("site_delivery_photo.jpg", "image/jpeg", 1_850_000),
        ]
        # Use two files per entry to keep the demo compact.
        for idx, (file_name, file_type, file_size) in enumerate(file_specs[:2]):
            storage_path = f"storage/evidence/{entry.id}/{file_name}"
            file_hash = _hash_for_file(file_name, str(entry.id), uploader.email)
            uploaded_at = _utc(entry.created_at + timedelta(hours=2 + idx))

            evidence, _ = _get_or_create(
                session,
                EvidenceFile,
                defaults={
                    "file_type": file_type,
                    "file_size": file_size,
                    "file_hash": file_hash,
                    "storage_path": storage_path,
                    "uploaded_by": uploader.id,
                    "uploaded_at": uploaded_at,
                },
                material_entry_id=entry.id,
                file_name=file_name,
            )
            evidence_files.append(evidence)
    return evidence_files


def _seed_notifications(
    session,
    submitted_entry: MaterialEntry,
    verifier: User,
    verifier_response: ResponseType,
    responded_at: datetime | None,
) -> Notification:
    deadline = submitted_entry.created_at + timedelta(days=5)
    notification, _ = _get_or_create(
        session,
        Notification,
        defaults={
            "notified_user_id": verifier.id,
            "notified_at": submitted_entry.created_at + timedelta(hours=1),
            "response_deadline": deadline,
            "response_type": verifier_response,
            "responded_at": responded_at,
        },
        entity_type="MaterialEntry",
        entity_id=submitted_entry.id,
        notified_user_id=verifier.id,
    )
    return notification


def _seed_audit_logs(
    session,
    entry: MaterialEntry,
    actor: User,
    actions: list[tuple[str, dict, dict, datetime]],
) -> list[AuditLog]:
    logs: list[AuditLog] = []
    for action, previous_state, new_state, timestamp in actions:
        log, _ = _get_or_create(
            session,
            AuditLog,
            defaults={
                "previous_state": previous_state,
                "new_state": new_state,
                "performed_by_id": actor.id,
                "timestamp": timestamp,
            },
            entity_type="MaterialEntry",
            entity_id=entry.id,
            action=action,
            performed_by_id=actor.id,
            timestamp=timestamp,
        )
        logs.append(log)
    return logs


def main() -> int:
    _ = get_settings()

    with SessionLocal() as session:
        with session.begin():
            organizations = _seed_organizations(session)
            users = _seed_users(session, organizations)
            project = _seed_project(
                session,
                organizations["GreenBuild Infrastructure Pvt Ltd"],
                users["rahul.menon@greenbuild.in"],
            )
            emission_factors = _seed_emission_factors(session)
            entries = _seed_material_entries(session, project, users, emission_factors)

            uploader = users["rahul.menon@greenbuild.in"]
            _seed_evidence_files(session, entries, uploader)

            submitted_entry = next(
                entry for entry in entries if entry.status == MaterialStatus.SUBMITTED
            )
            _seed_notifications(
                session,
                submitted_entry,
                users["anita.sharma@carbonverify.co"],
                ResponseType.ACKNOWLEDGED,
                submitted_entry.created_at + timedelta(days=1),
            )

            # Audit logs for each entry
            for entry in entries:
                creator = users["rahul.menon@greenbuild.in"]
                verifier = users["anita.sharma@carbonverify.co"]
                actions = [
                    (
                        "CREATED",
                        {},
                        {"status": "DRAFT", "material": entry.material_name},
                        entry.created_at,
                    ),
                ]
                if entry.status in {MaterialStatus.SUBMITTED, MaterialStatus.VERIFIED, MaterialStatus.LOCKED}:
                    actions.append(
                        (
                            "SUBMITTED",
                            {"status": "DRAFT"},
                            {"status": "SUBMITTED"},
                            entry.created_at + timedelta(hours=1),
                        )
                    )
                if entry.status in {MaterialStatus.VERIFIED, MaterialStatus.LOCKED}:
                    actions.append(
                        (
                            "VERIFIED",
                            {"status": "SUBMITTED"},
                            {"status": "VERIFIED"},
                            entry.created_at + timedelta(days=1),
                        )
                    )
                if entry.status == MaterialStatus.LOCKED:
                    actions.append(
                        (
                            "LOCKED",
                            {"status": "VERIFIED"},
                            {"status": "LOCKED"},
                            entry.created_at + timedelta(days=2),
                        )
                    )

                _seed_audit_logs(
                    session,
                    entry,
                    creator if entry.status == MaterialStatus.SUBMITTED else verifier,
                    actions,
                )

    print("Seed data completed successfully.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
