from datetime import datetime, timezone
import logging
import time
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.docs import get_redoc_html
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.api.health import router as health_router
from app.api.router import router as api_router
from app.core.config import get_settings
from app.core.logging_config import configure_logging
from app.core.observability import setup_observability
from app.core.rate_limit import limiter
from app.core.security import decode_access_token
from app.services.ai_risk_service import AIRiskService

configure_logging()
settings = get_settings()
logger = logging.getLogger("infrasentinel")

cors_allowed_origins = [origin.strip() for origin in settings.cors_allowed_origins.split(",") if origin.strip()]

app = FastAPI(title=settings.project_name, redoc_url=None)
app.state.limiter = limiter
limiter.enabled = settings.rate_limit_enabled
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
if settings.rate_limit_enabled:
	app.add_middleware(SlowAPIMiddleware)
setup_observability(app)


@app.on_event("startup")
async def warmup_ai_models() -> None:
	_validate_runtime_configuration()
	try:
		status_payload = AIRiskService(session=None).model_status()
		if status_payload.get("model_loaded"):
			logger.info(
				"AI model loaded at startup: model=%s version=%s",
				status_payload.get("current_model"),
				status_payload.get("model_version"),
			)
		else:
			logger.warning("No trained AI model available at startup; heuristic fallback remains active")
	except Exception:
		logger.exception("Failed to load AI model at startup; continuing in fallback mode")


@app.get("/", include_in_schema=False)
async def root():
	return {
		"name": settings.project_name,
		"status": "ok",
		"docs": "/docs",
		"redoc": "/redoc",
		"openapi": "/openapi.json",
	}


@app.get("/redoc", include_in_schema=False)
async def redoc_html():
	# Use a stable ReDoc v2 bundle instead of @next to avoid intermittent blank renders.
	return get_redoc_html(
		title=f"{settings.project_name} - ReDoc",
		openapi_url=app.openapi_url,
		redoc_js_url="https://cdn.jsdelivr.net/npm/redoc@2/bundles/redoc.standalone.js",
	)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.perf_counter()
    request_id = request.headers.get("x-request-id") or str(uuid4())
    user_id = None
    user_email = None
    user_org = None

    auth_header = request.headers.get("authorization")
    if auth_header and auth_header.lower().startswith("bearer "):
        token = auth_header.split(" ", 1)[1].strip()
        try:
            payload = decode_access_token(token)
            subject = payload.get("sub")
            org_id = payload.get("org")
            if subject:
                user_id = str(subject)
            if org_id:
                user_org = str(org_id)
        except Exception:
            pass

    response = await call_next(request)
    duration_ms = int((time.perf_counter() - start) * 1000)
    timestamp = datetime.now(timezone.utc).isoformat()

    logger.info(
        "REQUEST request_id=%s time=%s method=%s path=%s query=%s user_id=%s user_email=%s organization_id=%s status_code=%s duration_ms=%s",
        request_id,
        timestamp,
        request.method,
        request.url.path,
        request.url.query,
        user_id,
        user_email,
        user_org,
        response.status_code,
        duration_ms,
    )
    return response
app.add_middleware(
	CORSMiddleware,
	allow_origins=cors_allowed_origins,
	allow_origin_regex=settings.cors_allowed_origin_regex,
	allow_credentials=True,
	allow_methods=["*"],
	allow_headers=["*"],
)
app.include_router(api_router)
app.include_router(health_router)


def _validate_runtime_configuration() -> None:
	if not settings.database_url:
		raise RuntimeError("DATABASE_URL is required")
	if not settings.jwt_secret_key:
		raise RuntimeError("JWT_SECRET_KEY is required")
	if settings.environment.lower() == "production":
		weak_values = {"change_this_secret", "replace_with_secure_secret", "secret", "default"}
		if settings.jwt_secret_key.strip().lower() in weak_values:
			raise RuntimeError("JWT_SECRET_KEY must be a strong value in production")
