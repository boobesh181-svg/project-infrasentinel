from __future__ import annotations

import io
import json
import logging
import zipfile
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from reportlab.lib import colors  # pyright: ignore[reportMissingImports]
from reportlab.lib.pagesizes import A4  # pyright: ignore[reportMissingImports]
from reportlab.lib.styles import getSampleStyleSheet  # pyright: ignore[reportMissingImports]
from reportlab.lib.units import mm  # pyright: ignore[reportMissingImports]
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle  # pyright: ignore[reportMissingImports]
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.models.attestation import Attestation
from app.models.audit_log import AuditLog
from app.models.evidence_file import EvidenceFile
from app.models.material_entry import MaterialEntry
from app.models.mrv_report import MRVReport
from app.models.project import Project
from app.models.user import User
from app.services.audit_service import AuditService
from app.services.integrity_service import IntegrityScoringService

logger = logging.getLogger("infrasentinel")

class VerificationReportService:
    """Build a project verification report in both JSON and PDF formats."""

    def __init__(self, session: Session, user: User) -> None:
        self._session = session
        self._user = user

    def generate_project_report(self, project_id: UUID) -> dict[str, Any]:
        project = self._get_project_for_actor(project_id=project_id)

        material_rows = self._load_material_rows(project_id=project_id)
        emissions = self._load_emissions_section(project_id=project_id)
        anomaly_results = self._load_anomaly_section(project_id=project_id)
        integrity = IntegrityScoringService(self._session).calculate_project_score(project_id=project_id)
        audit_logs = self._load_audit_logs_section(project_id=project_id)

        payload = {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "project_summary": {
                "project_id": str(project.id),
                "name": project.name,
                "location": project.location,
                "reporting_period_start": project.reporting_period_start.isoformat(),
                "reporting_period_end": project.reporting_period_end.isoformat(),
                "material_entry_count": len(material_rows),
            },
            "materials_extracted": material_rows,
            "carbon_emissions": emissions,
            "anomaly_detection_results": anomaly_results,
            "integrity_score": integrity,
            "audit_logs": audit_logs,
        }

        pdf_bytes = self._build_pdf_report(payload=payload)
        logger.info(
            "Verification report generated project_id=%s materials=%s audit_logs=%s",
            str(project_id),
            len(material_rows),
            len(audit_logs),
        )
        return {
            "json": payload,
            "pdf_bytes": pdf_bytes,
        }

    def _load_material_rows(self, *, project_id: UUID) -> list[dict[str, Any]]:
        stmt = (
            select(
                MaterialEntry.id,
                MaterialEntry.material_name,
                MaterialEntry.quantity,
                MaterialEntry.calculated_emission,
                MaterialEntry.status,
                MaterialEntry.created_at,
            )
            .where(MaterialEntry.project_id == project_id)
            .order_by(MaterialEntry.created_at.desc())
        )
        rows = self._session.execute(stmt).all()
        return [
            {
                "material_entry_id": str(entry_id),
                "material_name": material_name,
                "quantity": self._to_float(quantity),
                "calculated_emission": self._to_float(calculated_emission),
                "status": status.value if hasattr(status, "value") else str(status),
                "created_at": created_at.isoformat() if created_at else None,
            }
            for entry_id, material_name, quantity, calculated_emission, status, created_at in rows
        ]

    def _load_emissions_section(self, *, project_id: UUID) -> dict[str, Any]:
        summary_stmt = select(
            func.count(MaterialEntry.id),
            func.coalesce(func.sum(MaterialEntry.calculated_emission), 0),
            func.coalesce(func.avg(MaterialEntry.calculated_emission), 0),
        ).where(MaterialEntry.project_id == project_id)
        total_entries, total_emissions, avg_emissions = self._session.execute(summary_stmt).one()

        by_material_stmt = (
            select(
                MaterialEntry.material_name,
                func.count(MaterialEntry.id),
                func.coalesce(func.sum(MaterialEntry.calculated_emission), 0),
            )
            .where(MaterialEntry.project_id == project_id)
            .group_by(MaterialEntry.material_name)
            .order_by(func.sum(MaterialEntry.calculated_emission).desc())
        )
        by_material = [
            {
                "material": material_name,
                "entry_count": int(entry_count or 0),
                "total_emission": self._to_float(total_emission),
            }
            for material_name, entry_count, total_emission in self._session.execute(by_material_stmt).all()
        ]

        return {
            "total_entries": int(total_entries or 0),
            "total_emissions": self._to_float(total_emissions),
            "average_emission_per_entry": self._to_float(avg_emissions),
            "by_material": by_material,
        }

    def _load_anomaly_section(self, *, project_id: UUID) -> dict[str, Any]:
        stmt = select(
            func.count(MaterialEntry.id),
            func.coalesce(func.avg(MaterialEntry.ai_risk_score), 0),
            func.sum(case((MaterialEntry.temporal_anomaly.is_(True), 1), else_=0)),
            func.sum(case((MaterialEntry.audit_required.is_(True), 1), else_=0)),
        ).where(MaterialEntry.project_id == project_id)
        total_entries, avg_ai_risk, temporal_count, audit_required_count = self._session.execute(stmt).one()

        risk_value = self._to_float(avg_ai_risk)
        if risk_value <= 1.0:
            risk_value *= 100.0

        return {
            "entries_analyzed": int(total_entries or 0),
            "average_ai_risk_score": round(risk_value, 2),
            "temporal_anomaly_count": int(temporal_count or 0),
            "audit_required_count": int(audit_required_count or 0),
        }

    def _load_audit_logs_section(self, *, project_id: UUID) -> list[dict[str, Any]]:
        entry_ids_subquery = (
            select(MaterialEntry.id).where(MaterialEntry.project_id == project_id)
        )
        stmt = (
            select(
                AuditLog.id,
                AuditLog.entity_type,
                AuditLog.entity_id,
                AuditLog.action,
                AuditLog.performed_by_id,
                AuditLog.timestamp,
            )
            .where(
                (AuditLog.entity_type == "Project") & (AuditLog.entity_id == project_id)
                | ((AuditLog.entity_type == "MaterialEntry") & (AuditLog.entity_id.in_(entry_ids_subquery)))
            )
            .order_by(AuditLog.timestamp.desc())
            .limit(200)
        )
        rows = self._session.execute(stmt).all()
        return [
            {
                "id": str(audit_id),
                "entity_type": entity_type,
                "entity_id": str(entity_id),
                "action": action,
                "performed_by_id": str(performed_by_id),
                "timestamp": timestamp.isoformat() if timestamp else None,
            }
            for audit_id, entity_type, entity_id, action, performed_by_id, timestamp in rows
        ]

    def _build_pdf_report(self, *, payload: dict[str, Any]) -> bytes:
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=16 * mm,
            rightMargin=16 * mm,
            topMargin=14 * mm,
            bottomMargin=14 * mm,
            title="Infrastructure Verification Report",
        )
        styles = getSampleStyleSheet()
        story: list[Any] = []

        story.append(Paragraph("Infrastructure Verification Report", styles["Title"]))
        story.append(Spacer(1, 8))

        summary = payload["project_summary"]
        summary_rows = [
            ["Project", str(summary["name"])],
            ["Location", str(summary["location"])],
            ["Period", f"{summary['reporting_period_start']} to {summary['reporting_period_end']}"],
            ["Material Entries", str(summary["material_entry_count"])],
            ["Generated At", str(payload["generated_at"])],
        ]
        story.append(Paragraph("1. Project Summary", styles["Heading2"]))
        story.append(self._styled_table(summary_rows, [120 * mm, 60 * mm]))
        story.append(Spacer(1, 8))

        story.append(Paragraph("2. Materials Extracted", styles["Heading2"]))
        materials = payload["materials_extracted"]
        material_table_data = [["Material", "Quantity", "Emission", "Status"]]
        for row in materials[:30]:
            material_table_data.append(
                [
                    str(row["material_name"]),
                    f"{float(row['quantity']):.2f}",
                    f"{float(row['calculated_emission']):.2f}",
                    str(row["status"]),
                ]
            )
        if len(material_table_data) == 1:
            material_table_data.append(["No material entries", "-", "-", "-"])
        story.append(self._styled_table(material_table_data, [60 * mm, 35 * mm, 35 * mm, 40 * mm], header=True))
        story.append(Spacer(1, 8))

        emissions = payload["carbon_emissions"]
        story.append(Paragraph("3. Carbon Emissions", styles["Heading2"]))
        emissions_rows = [
            ["Total Entries", str(emissions["total_entries"])],
            ["Total Emissions", f"{float(emissions['total_emissions']):.2f}"],
            ["Average Per Entry", f"{float(emissions['average_emission_per_entry']):.2f}"],
        ]
        story.append(self._styled_table(emissions_rows, [120 * mm, 60 * mm]))
        story.append(Spacer(1, 8))

        anomaly = payload["anomaly_detection_results"]
        story.append(Paragraph("4. Anomaly Detection Results", styles["Heading2"]))
        anomaly_rows = [
            ["Entries Analyzed", str(anomaly["entries_analyzed"])],
            ["Average AI Risk Score", f"{float(anomaly['average_ai_risk_score']):.2f}"],
            ["Temporal Anomaly Count", str(anomaly["temporal_anomaly_count"])],
            ["Audit Required Count", str(anomaly["audit_required_count"])],
        ]
        story.append(self._styled_table(anomaly_rows, [120 * mm, 60 * mm]))
        story.append(Spacer(1, 8))

        integrity = payload["integrity_score"]
        story.append(Paragraph("5. Integrity Score", styles["Heading2"]))
        integrity_rows = [
            ["Integrity Score", str(integrity["integrity_score"])],
            ["Material Verification", str(integrity["breakdown"]["material_verification"])],
            ["Emission Accuracy", str(integrity["breakdown"]["emission_accuracy"])],
            ["Anomaly Risk", str(integrity["breakdown"]["anomaly_risk"])],
            ["Evidence Completeness", str(integrity["breakdown"]["evidence_completeness"])],
        ]
        story.append(self._styled_table(integrity_rows, [120 * mm, 60 * mm]))
        story.append(Spacer(1, 8))

        story.append(Paragraph("6. Audit Logs", styles["Heading2"]))
        audit_table_data = [["Timestamp", "Entity", "Action", "By"]]
        for row in payload["audit_logs"][:40]:
            audit_table_data.append(
                [
                    str(row["timestamp"] or "-"),
                    str(row["entity_type"]),
                    str(row["action"]),
                    str(row["performed_by_id"]),
                ]
            )
        if len(audit_table_data) == 1:
            audit_table_data.append(["No audit logs", "-", "-", "-"])
        story.append(self._styled_table(audit_table_data, [50 * mm, 30 * mm, 55 * mm, 50 * mm], header=True))

        try:
            doc.build(story)
        except Exception as exc:
            logger.exception("Failed to build verification report PDF")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to generate verification report PDF",
            ) from exc
        return buffer.getvalue()

    def _styled_table(self, rows: list[list[str]], col_widths: list[float], header: bool = False) -> Table:
        table = Table(rows, colWidths=col_widths, repeatRows=1 if header else 0)
        base_style = [
            ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#D1D5DB")),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]
        if header:
            base_style.extend(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0F172A")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ]
            )
        table.setStyle(TableStyle(base_style))
        return table

    def _get_project_for_actor(self, *, project_id: UUID) -> Project:
        project = self._session.get(Project, project_id)
        if project is None:
            logger.warning(
                "Verification report project not found project_id=%s user_id=%s",
                str(project_id),
                str(self._user.id),
            )
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
        if project.organization_id != self._user.organization_id:
            logger.warning(
                "Verification report forbidden project_id=%s user_id=%s",
                str(project_id),
                str(self._user.id),
            )
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
        return project

    @staticmethod
    def _to_float(value: Any) -> float:
        if value is None:
            return 0.0
        if isinstance(value, Decimal):
            return float(value)
        return float(value)

    def get_report(self, *, report_id: UUID, user: User) -> MRVReport:
        return self._get_report_for_user(report_id=report_id, user=user)

    def export_report(self, *, report_id: UUID, user: User) -> bytes:
        report = self._get_report_for_user(report_id=report_id, user=user)
        entry_ids = self._extract_entry_ids(report)

        attestations = self._load_attestations(entry_ids)
        evidence = self._load_evidence(entry_ids)
        audit_logs = self._load_report_audit_logs(report.id)

        report_payload = {
            "id": str(report.id),
            "project_id": str(report.project_id),
            "report_period_start": report.report_period_start.isoformat(),
            "report_period_end": report.report_period_end.isoformat(),
            "total_emissions": report.total_emissions,
            "status": report.status.value,
            "created_by": str(report.created_by),
            "created_at": report.created_at.isoformat() if report.created_at else None,
        }

        material_entries_payload = report.report_data.get("material_entries", [])

        attestations_payload = [
            {
                "id": str(item.id),
                "entity_type": item.entity_type,
                "entity_id": str(item.entity_id),
                "attestor_user_id": str(item.attestor_user_id),
                "attestation_type": item.attestation_type,
                "comment": item.comment,
                "created_at": item.created_at.isoformat() if item.created_at else None,
            }
            for item in attestations
        ]

        evidence_payload = [
            {
                "id": str(item.id),
                "material_entry_id": str(item.material_entry_id),
                "file_hash": item.file_hash,
                "file_name": item.file_name,
                "upload_timestamp": item.uploaded_at.isoformat() if item.uploaded_at else None,
            }
            for item in evidence
        ]

        audit_payload = [
            {
                "id": str(item.id),
                "entity_type": item.entity_type,
                "entity_id": str(item.entity_id),
                "action": item.action,
                "performed_by_id": str(item.performed_by_id),
                "previous_state": item.previous_state,
                "new_state": item.new_state,
                "timestamp": item.timestamp.isoformat() if item.timestamp else None,
            }
            for item in audit_logs
        ]

        bundle = {
            "report.json": report_payload,
            "material_entries.json": material_entries_payload,
            "attestations.json": attestations_payload,
            "evidence_manifest.json": evidence_payload,
            "audit_log.json": audit_payload,
        }

        audit = AuditService(self._session)
        with self._session.begin():
            audit.log(
                performed_by_id=user.id,
                entity_type="MRVReport",
                entity_id=report.id,
                action="report_exported",
                previous_state={},
                new_state={
                    "id": report.id,
                    "exported_at": datetime.now(timezone.utc).isoformat(),
                },
            )

        return self._build_zip(bundle)

    def _build_zip(self, bundle: dict[str, Any]) -> bytes:
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for filename, payload in bundle.items():
                archive.writestr(
                    filename,
                    json.dumps(payload, sort_keys=True, separators=(",", ":")),
                )
        return buffer.getvalue()

    def _extract_entry_ids(self, report: MRVReport) -> list[UUID]:
        entries = report.report_data.get("material_entries", [])
        entry_ids = []
        for entry in entries:
            entry_id = entry.get("material_entry_id")
            if not entry_id:
                continue
            try:
                entry_ids.append(UUID(str(entry_id)))
            except ValueError:
                continue
        return entry_ids

    def _load_attestations(self, entry_ids: list[UUID]) -> list[Attestation]:
        if not entry_ids:
            return []
        stmt = select(Attestation).where(
            Attestation.entity_type == "material_entry",
            Attestation.entity_id.in_(entry_ids),
        )
        return list(self._session.execute(stmt).scalars().all())

    def _load_evidence(self, entry_ids: list[UUID]) -> list[EvidenceFile]:
        if not entry_ids:
            return []
        stmt = select(EvidenceFile).where(EvidenceFile.material_entry_id.in_(entry_ids))
        return list(self._session.execute(stmt).scalars().all())

    def _load_report_audit_logs(self, report_id: UUID) -> list[AuditLog]:
        stmt = (
            select(AuditLog)
            .where(AuditLog.entity_type == "MRVReport", AuditLog.entity_id == report_id)
            .order_by(AuditLog.timestamp.asc())
        )
        return list(self._session.execute(stmt).scalars().all())

    def _get_project_for_user(self, *, project_id: UUID, user: User) -> Project:
        project = self._session.get(Project, project_id)
        if project is None:
            logger.warning(
                "404 resource not found",
                extra={
                    "resource": "project",
                    "requested_id": str(project_id),
                    "user_id": str(user.id),
                    "user_email": user.email,
                    "user_org": str(user.organization_id),
                    "db_exists": False,
                    "org_mismatch": False,
                },
            )
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
        if project.organization_id != user.organization_id:
            logger.warning(
                "ORG_MISMATCH",
                extra={
                    "resource": "project",
                    "requested_id": str(project_id),
                    "user_id": str(user.id),
                    "user_email": user.email,
                    "user_org": str(user.organization_id),
                    "db_exists": True,
                    "org_mismatch": True,
                },
            )
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
        return project

    def _get_report_for_user(self, *, report_id: UUID, user: User) -> MRVReport:
        stmt = (
            select(MRVReport)
            .join(Project, Project.id == MRVReport.project_id)
            .where(MRVReport.id == report_id, Project.organization_id == user.organization_id)
        )
        report = self._session.execute(stmt).scalar_one_or_none()
        if report is None:
            if self._session.get(MRVReport, report_id) is None:
                logger.warning(
                    "404 resource not found",
                    extra={
                        "resource": "report",
                        "requested_id": str(report_id),
                        "user_id": str(user.id),
                        "user_email": user.email,
                        "user_org": str(user.organization_id),
                        "db_exists": False,
                        "org_mismatch": False,
                    },
                )
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
            logger.warning(
                "ORG_MISMATCH",
                extra={
                    "resource": "report",
                    "requested_id": str(report_id),
                    "user_id": str(user.id),
                    "user_email": user.email,
                    "user_org": str(user.organization_id),
                    "db_exists": True,
                    "org_mismatch": True,
                },
            )
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
        return report
