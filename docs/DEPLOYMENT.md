# Deployment Guide

## Required Environment Variables

Minimum required:

- `DATABASE_URL`
- `JWT_SECRET_KEY`

Recommended production variables:

- `JWT_ALGORITHM` (default: `HS256`)
- `JWT_ISSUER` (default: `infrasentinel`)
- `JWT_AUDIENCE` (default: `api`)
- `ACCESS_TOKEN_EXPIRE_MINUTES` (default: `60`)
- `ENVIRONMENT` (set to `production`)
- `REDIS_URL`
- `CELERY_BROKER_URL`
- `CELERY_RESULT_BACKEND`
- `OBJECT_STORAGE_BACKEND` (`local` or `s3`)
- `OBJECT_STORAGE_BUCKET`
- `OBJECT_STORAGE_BASE_URL`
- `OBJECT_STORAGE_LOCAL_ROOT`
- `CORS_ALLOWED_ORIGINS`
- `CORS_ALLOWED_ORIGIN_REGEX`
- `SENTRY_DSN` (optional)
- `SENTRY_TRACES_SAMPLE_RATE` (optional)
- `ENABLE_OPENTELEMETRY` (optional)

## Database Migrations

Run Alembic migrations before serving traffic:

```bash
alembic upgrade head
```

## Local Runtime Command

Production runtime port target:

```bash
uvicorn app.main:app --port 8001
```

## Container Startup

Build and run production stack:

```bash
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
```

Stop stack:

```bash
docker compose -f docker-compose.prod.yml down
```

## Model Loading Requirements

- Trained model artifacts are loaded from `models/`.
- Startup does not retrain models.
- Startup attempts to load latest model metadata and continues in heuristic fallback mode if model is missing.
- Model hashes are verified before loading.

To train/retrain explicitly (admin token required):

- `POST /ai/train`
- `POST /ai/retrain`

## Monitoring Setup

Metrics endpoint:

- `GET /metrics`

Included metrics cover:

- request totals and latency
- authentication failures
- upload sizes
- AI anomaly rate gauge

Prometheus is configured in:

- `deploy/prometheus.yml`

Prometheus is included in:

- `docker-compose.prod.yml`

## Security Notes

- Tenant isolation is enforced on project/material/workflow/evidence ownership checks.
- Inactive users are rejected at login.
- JWT contains tenant/org and issuer/audience identifiers.
- Token rotation endpoint is available at `POST /auth/rotate`.
- Login and sensitive write endpoints are rate limited.
