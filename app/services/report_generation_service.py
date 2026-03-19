from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog
from app.models.emission_record import EmissionRecord
from app.models.material_event import MaterialEvent
from app.models.project import Project
from app.models.report import Report
from app.models.user import User
from app.services.verification_audit_service import VerificationAuditService


class ReportGenerationService:
    def __init__(self, session: Session) -> None:
        self._session = session
        self._audit = VerificationAuditService(session)

    def generate(
        self,
        *,
        actor: User,
        project_id: UUID,
        period_start,
        period_end,
        format: str,
    ) -> Report:
        project = self._session.get(Project, project_id)
        if project is None or project.organization_id != actor.organization_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

        fmt = format.lower()
        if fmt not in {"json", "csv", "pdf"}:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported format")

        stmt = (
            select(MaterialEvent, EmissionRecord)
            .join(EmissionRecord, EmissionRecord.material_event_id == MaterialEvent.id)
            .where(
                MaterialEvent.organization_id == actor.organization_id,
                MaterialEvent.project_id == project.id,
                MaterialEvent.delivery_date >= period_start,
                MaterialEvent.delivery_date <= period_end,
            )
        )
        rows = self._session.execute(stmt).all()

        total_emission = float(sum(float(row[1].emission_value) for row in rows))
        payload = {
            "project": {
                "id": str(project.id),
                "name": project.name,
                "location": project.location,
            },
            "period": {"start": period_start.isoformat(), "end": period_end.isoformat()},
            "summary": {
                "material_events": len(rows),
                "total_emission": total_emission,
            },
            "material_records": [
                {
                    "material_event_id": str(event.id),
                    "material_type": event.material_type,
                    "quantity": float(event.quantity),
                    "unit": event.unit,
                    "delivery_date": event.delivery_date.isoformat(),
                    "status": event.status.value,
                    "emission_value": float(emission.emission_value),
                }
                for event, emission in rows
            ],
            "audit_summary": self._audit_summary(actor.organization_id, project.id),
        }

        digest = hashlib.sha256(json.dumps(payload, sort_keys=True).encode("utf-8")).hexdigest()

        out_dir = Path("storage") / "reports"
        out_dir.mkdir(parents=True, exist_ok=True)
        report_file = out_dir / f"verification_report_{project.id}_{period_start}_{period_end}.{fmt}"

        if fmt == "json":
            content = json.dumps(payload, indent=2)
        elif fmt == "csv":
            lines = ["material_event_id,material_type,quantity,unit,delivery_date,status,emission_value"]
            for item in payload["material_records"]:
                lines.append(
                    f"{item['material_event_id']},{item['material_type']},{item['quantity']},{item['unit']},{item['delivery_date']},{item['status']},{item['emission_value']}"
                )
            content = "\n".join(lines)
        else:
            content = "Infrasentinel Verification Report\n\n" + json.dumps(payload, indent=2)

        report_file.write_text(content, encoding="utf-8")

        report = Report(
            organization_id=actor.organization_id,
            project_id=project.id,
            generated_by=actor.id,
            report_type="VERIFICATION",
            report_period_start=period_start,
            report_period_end=period_end,
            format=fmt,
            file_url=str(report_file),
            generation_hash=digest,
            created_at=datetime.now(timezone.utc),
            status="GENERATED",
        )
        self._session.add(report)
        self._session.flush()

        self._audit.log(
            organization_id=actor.organization_id,
            entity_type="report",
            entity_id=report.id,
            action="GENERATE_REPORT",
            user_id=actor.id,
            before_state={},
            after_state={"format": fmt, "file_url": report.file_url, "generation_hash": digest},
        )

        return report

    def _audit_summary(self, organization_id, project_id) -> dict[str, int]:
        stmt = (
            select(AuditLog.action, func.count(AuditLog.id))
            .where(
                AuditLog.entity_type.in_(["material_event", "verification_record", "report"]),
                AuditLog.new_state["organization_id"].astext == str(organization_id),
            )
            .group_by(AuditLog.action)
        )
        return {action: int(count) for action, count in self._session.execute(stmt).all()}
