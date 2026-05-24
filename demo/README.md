InfraSentinel — Ops Demo
=========================

This folder contains a minimal demo setup to run the Operations Command Center locally: a Docker Compose file, seed events, a playback script, and workers.

How to run (preferred: Docker Desktop)
-------------------------------------

1. Build and start the demo stack (Postgres, Redis, API, AI worker):

```bash
cd project-infrasentinel
docker compose -f infra/docker-compose.ops.yml up -d --build
```

2. Run Alembic migrations to create the new tables:

```bash
docker compose -f infra/docker-compose.ops.yml exec api alembic upgrade head
```

3. Start the demo processor (consumes `ingest:queue` and writes verification stubs):

```bash
docker compose -f infra/docker-compose.ops.yml exec -d api python -m app.workers.processor
```

4. Seed the demo events (playback script posts to the API ingest endpoint):

```bash
python scripts/playback_demo.py http://localhost:8000/ops/ingest
```

5. Open the frontend (if running) at the configured port (Vite default 5173) or interact with the API directly at `http://localhost:8000`.

Troubleshooting
---------------
- If `docker compose` fails with a Docker API error, ensure Docker Desktop / daemon is running.
- If Postgres is not ready when running Alembic, wait a few seconds and retry the `alembic upgrade head` command.
- If you prefer running services locally without Docker, set the following env vars in a `.env` file at the repo root:

```
DATABASE_URL=postgresql+psycopg2://infrasentinel:infrasentinel@localhost:5432/infrasentinel
JWT_SECRET_KEY=demo_secret
REDIS_URL=redis://localhost:6379/0
```

Then run the API in your Python venv and run migrations:

```bash
python -m venv .venv
.venv\Scripts\Activate.ps1  # Windows PowerShell
pip install -r requirements.txt
alembic upgrade head
python -m app.main
```

Notes
-----
- The demo uses a simple Redis list `ingest:queue` for ingestion. The `app/workers/processor.py` BRPOPs items and creates `VerificationResult` records.
- Migration `alembic/versions/20260524_0020_add_delivery_verification.py` creates the core tables used by the Ops UI.
- If you want me to attempt running migrations here, start Docker on your machine or tell me to run migrations against an existing Postgres instance.
