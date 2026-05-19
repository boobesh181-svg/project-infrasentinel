from __future__ import annotations

import importlib
import logging
import time

from fastapi import FastAPI, Request
from fastapi.responses import Response

from app.core.config import get_settings

logger = logging.getLogger("infrasentinel")
_REQUEST_COUNT = None
_REQUEST_LATENCY = None
_AUTH_FAILURE_COUNT = None
_UPLOAD_SIZE_BYTES = None
_ANOMALY_RATE_GAUGE = None


def setup_observability(app: FastAPI) -> None:
    global _REQUEST_COUNT, _REQUEST_LATENCY, _AUTH_FAILURE_COUNT, _UPLOAD_SIZE_BYTES, _ANOMALY_RATE_GAUGE
    settings = get_settings()

    prometheus_client = _load_module("prometheus_client")
    if prometheus_client is not None:
        content_type_latest = getattr(prometheus_client, "CONTENT_TYPE_LATEST")
        generate_latest = getattr(prometheus_client, "generate_latest")
        counter_cls = getattr(prometheus_client, "Counter")
        histogram_cls = getattr(prometheus_client, "Histogram")

        if _REQUEST_COUNT is None:
            _REQUEST_COUNT = counter_cls(
                "http_requests_total",
                "Total HTTP requests",
                ["method", "path", "status"],
            )
        if _REQUEST_LATENCY is None:
            _REQUEST_LATENCY = histogram_cls(
                "http_request_duration_seconds",
                "Request latency in seconds",
                ["method", "path"],
            )
        if _AUTH_FAILURE_COUNT is None:
            _AUTH_FAILURE_COUNT = counter_cls(
                "auth_failures_total",
                "Total authentication failures",
                ["reason"],
            )
        if _UPLOAD_SIZE_BYTES is None:
            _UPLOAD_SIZE_BYTES = histogram_cls(
                "upload_size_bytes",
                "Uploaded payload size in bytes",
                ["content_type"],
            )
        if _ANOMALY_RATE_GAUGE is None:
            _ANOMALY_RATE_GAUGE = getattr(prometheus_client, "Gauge")(
                "ai_anomaly_rate",
                "Latest observed anomaly rate from AI monitoring",
            )

        @app.middleware("http")
        async def prometheus_middleware(request: Request, call_next):
            start = time.perf_counter()
            response = await call_next(request)
            elapsed = time.perf_counter() - start

            path = request.url.path
            _REQUEST_COUNT.labels(request.method, path, str(response.status_code)).inc()
            _REQUEST_LATENCY.labels(request.method, path).observe(elapsed)
            return response

        @app.get("/metrics", include_in_schema=False)
        async def metrics() -> Response:
            return Response(generate_latest(), media_type=content_type_latest)
    else:
        logger.warning("Prometheus client not installed; /metrics endpoint disabled")

    if settings.sentry_dsn:
        try:
            sentry_sdk = _load_module("sentry_sdk")
            sentry_fastapi = _load_module("sentry_sdk.integrations.fastapi")
            if sentry_sdk is None or sentry_fastapi is None:
                raise RuntimeError("sentry_sdk is not installed")

            sentry_sdk.init(  # type: ignore[attr-defined]
                dsn=settings.sentry_dsn,
                environment=settings.environment,
                traces_sample_rate=settings.sentry_traces_sample_rate,
                integrations=[sentry_fastapi.FastApiIntegration()],
            )
            logger.info("Sentry initialized")
        except Exception:
            logger.exception("Failed to initialize Sentry")

    if settings.enable_opentelemetry:
        try:
            otel_fastapi = _load_module("opentelemetry.instrumentation.fastapi")
            if otel_fastapi is None:
                raise RuntimeError("opentelemetry instrumentation is not installed")

            otel_fastapi.FastAPIInstrumentor.instrument_app(app)
            logger.info("OpenTelemetry instrumentation enabled")
        except Exception:
            logger.exception("Failed to initialize OpenTelemetry")


def _load_module(name: str):
    try:
        return importlib.import_module(name)
    except Exception:
        return None


def record_auth_failure(*, reason: str) -> None:
    if _AUTH_FAILURE_COUNT is None:
        return
    _AUTH_FAILURE_COUNT.labels(reason).inc()


def record_upload_size(*, content_type: str, size_bytes: int) -> None:
    if _UPLOAD_SIZE_BYTES is None:
        return
    _UPLOAD_SIZE_BYTES.labels(content_type or "application/octet-stream").observe(max(float(size_bytes), 0.0))


def set_ai_anomaly_rate(*, anomaly_rate: float) -> None:
    if _ANOMALY_RATE_GAUGE is None:
        return
    _ANOMALY_RATE_GAUGE.set(max(0.0, min(1.0, float(anomaly_rate))))
