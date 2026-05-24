from fastapi import APIRouter

from app.api.ai import router as ai_router
from app.api.analysis import router as analysis_router
from app.api.anti_corruption import router as anti_corruption_router
from app.api.analytics import router as analytics_router
from app.api.bim import router as bim_router
from app.api.audit import router as audit_router
from app.api.auth import router as auth_router
from app.api.attestations import router as attestation_router
from app.api.debug import router as debug_router
from app.api.dashboard import router as dashboard_router
from app.api.ops import router as ops_router
from app.api.emission_factors import router as emission_factor_router
from app.api.evidence import router as evidence_router
from app.api.health import router as health_router
from app.api.integrity import router as integrity_router
from app.api.material_entries import router as material_router
from app.api.material_events import router as material_event_router
from app.api.material_event_evidence import router as material_event_evidence_router
from app.api.notifications import router as notification_router
from app.api.projects import router as project_router
from app.api.project_verification_report import router as project_verification_report_router
from app.api.emissions import router as emissions_router
from app.api.reports import router as report_router
from app.api.suppliers import router as supplier_router
from app.api.supplier_confirmation import router as supplier_confirmation_router
from app.api.user_keys import router as user_keys_router
from app.api.verification import router as verification_router
from app.api.verification_reports import router as verification_report_router

router = APIRouter()
router.include_router(ai_router)
router.include_router(analysis_router)
router.include_router(anti_corruption_router)
router.include_router(auth_router)
router.include_router(attestation_router)
router.include_router(analytics_router)
router.include_router(dashboard_router)
router.include_router(bim_router)
router.include_router(project_router)
router.include_router(project_verification_report_router)
router.include_router(integrity_router)
router.include_router(emission_factor_router)
router.include_router(supplier_router)
router.include_router(supplier_confirmation_router)
router.include_router(user_keys_router)
router.include_router(material_router)
router.include_router(material_event_router)
router.include_router(material_event_evidence_router)
router.include_router(emissions_router)
router.include_router(verification_router)
router.include_router(notification_router)
router.include_router(audit_router)
router.include_router(evidence_router)
router.include_router(report_router)
router.include_router(verification_report_router)
router.include_router(debug_router)
router.include_router(health_router, tags=["health"])
router.include_router(ops_router)
