from fastapi import APIRouter

from app.api.audit import router as audit_router
from app.api.auth import router as auth_router
from app.api.attestations import router as attestation_router
from app.api.debug import router as debug_router
from app.api.emission_factors import router as emission_factor_router
from app.api.evidence import router as evidence_router
from app.api.health import router as health_router
from app.api.material_entries import router as material_router
from app.api.notifications import router as notification_router
from app.api.projects import router as project_router
from app.api.reports import router as report_router

router = APIRouter()
router.include_router(auth_router)
router.include_router(attestation_router)
router.include_router(project_router)
router.include_router(emission_factor_router)
router.include_router(material_router)
router.include_router(notification_router)
router.include_router(audit_router)
router.include_router(evidence_router)
router.include_router(report_router)
router.include_router(debug_router)
router.include_router(health_router, tags=["health"])
