from datetime import datetime, timezone
import logging
import time
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.docs import get_redoc_html

from app.api.health import router as health_router
from app.api.router import router as api_router
from app.core.config import get_settings
from app.core.security import decode_access_token
from app.db.session import SessionLocal
from app.models.user import User

settings = get_settings()
logger = logging.getLogger("infrasentinel")

app = FastAPI(title=settings.project_name, redoc_url=None)


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
			if subject:
				with SessionLocal() as db:
					user = db.get(User, subject)
					if user is not None:
						user_id = str(user.id)
						user_email = user.email
						user_org = str(user.organization_id)
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
	allow_origins=[
		"http://localhost:5173",
		"http://127.0.0.1:5173",
		"http://localhost:5174",
		"http://127.0.0.1:5174",
	],
	allow_credentials=True,
	allow_methods=["*"],
	allow_headers=["*"],
)
app.include_router(api_router)
app.include_router(health_router)
