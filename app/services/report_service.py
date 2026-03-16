from __future__ import annotations

import io
import json
import zipfile
from datetime import date, datetime, time, timezone
from typing import Any
from uuid import UUID
import logging

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.attestation import Attestation
from app.models.audit_log import AuditLog
from app.models.evidence_file import EvidenceFile
from app.models.material_entry import MaterialEntry, MaterialStatus
from app.models.mrv_report import MRVReport, MRVReportStatus
from app.models.project import Project
from app.models.user import User
from app.services.audit_service import AuditService

logger = logging.getLogger("infrasentinel")


class ReportService:
    def __init__(self, session: Session) -> None:
        self._session = session

    def generate_project_report(
        self,
        *,
        project_id: UUID,
        period_start: date,
        period_end: date,
        user: User,
    ) -> MRVReport:
        project = self._get_project_for_user(project_id=project_id, user=user)
        if period_start > period_end:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="report_period_start must be before report_period_end",
            )

        start_dt = datetime.combine(period_start, time.min, tzinfo=timezone.utc)
        end_dt = datetime.combine(period_end, time.max, tzinfo=timezone.utc)

        entries = list(
            self._session.execute(
                select(MaterialEntry)
                .where(
                    MaterialEntry.project_id == project.id,
                    MaterialEntry.status.in_([
                        MaterialStatus.APPROVED,
                        MaterialStatus.LOCKED,
                    ]),
                    MaterialEntry.created_at >= start_dt,
                    MaterialEntry.created_at <= end_dt,
                )
                .order_by(MaterialEntry.created_at.asc(), MaterialEntry.id.asc())
            ).scalars().all()
        )

        report_entries: list[dict[str, Any]] = []
        total_emissions = 0.0

        for entry in entries:
            emission_value = float(entry.calculated_emission)
            total_emissions += emission_value
            report_entries.append(
                {
                    "material_entry_id": str(entry.id),
                    "material_name": entry.material_name,
                    "quantity": float(entry.quantity),
                    "emission_factor_snapshot": {
                        "version": entry.factor_version_snapshot,
                        "value": float(entry.factor_value_snapshot),
                        "unit": entry.factor_unit_snapshot,
                        "source": entry.factor_source_snapshot,
                    },
                    "calculated_emission": emission_value,
                    "status": entry.status.value,
                    "created_at": entry.created_at.isoformat(),
                }
            )

        report_data = {
            "project_id": str(project.id),
            "report_period_start": period_start.isoformat(),
            "report_period_end": period_end.isoformat(),
            "material_entries": report_entries,
        }

        report = MRVReport(
            project_id=project.id,
            report_period_start=period_start,
            report_period_end=period_end,
            total_emissions=total_emissions,
            report_data=report_data,
            created_by=user.id,
            status=MRVReportStatus.DRAFT,
        )

        audit = AuditService(self._session)
        with self._session.begin():
            self._session.add(report)
            self._session.flush()
            audit.log(
                performed_by_id=user.id,
                entity_type="MRVReport",
                entity_id=report.id,
                action="report_generated",
                previous_state={},
                new_state={
                    "id": report.id,
                    "project_id": report.project_id,
                    "report_period_start": report.report_period_start.isoformat(),
                    "report_period_end": report.report_period_end.isoformat(),
                    "total_emissions": report.total_emissions,
                    "status": report.status.value,
                    "created_at": report.created_at.isoformat() if report.created_at else None,
                },
            )

        return report

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
