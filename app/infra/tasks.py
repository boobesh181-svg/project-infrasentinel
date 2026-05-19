from uuid import UUID

from app.infra.celery_app import celery_app
from app.db.session import SessionLocal
from app.services.evidence_integrity_service import EvidenceIntegrityService


@celery_app.task(name="reports.generate")
def generate_report_task(report_id: str) -> str:
    return f"queued:{report_id}"


@celery_app.task(name="evidence.refresh_duplicate_flags")
def refresh_duplicate_flags_task(organization_id: str) -> str:
    with SessionLocal() as session:
        EvidenceIntegrityService(session).refresh_duplicate_flags(
            organization_id=UUID(organization_id)
        )
        session.commit()
    return f"refreshed:{organization_id}"
