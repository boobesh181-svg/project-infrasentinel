from app.infra.celery_app import celery_app


@celery_app.task(name="reports.generate")
def generate_report_task(report_id: str) -> str:
    return f"queued:{report_id}"
