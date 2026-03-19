from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.material_entry import MaterialStatus
from app.models.material_event import MaterialEvent
from app.models.project import Project
from app.models.supplier import Supplier
from app.models.user import User, UserRole
from app.schemas.material_event import MaterialEventCreate, MaterialEventUpdate
from app.services.verification_audit_service import VerificationAuditService


class MaterialEventService:
    def __init__(self, session: Session) -> None:
        self._session = session
        self._audit = VerificationAuditService(session)

    def create(self, *, payload: MaterialEventCreate, actor: User) -> MaterialEvent:
        if actor.role not in {UserRole.SITE_ENGINEER, UserRole.CREATOR, UserRole.ADMIN}:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

        project = self._session.get(Project, payload.project_id)
        if project is None or project.organization_id != actor.organization_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

        supplier = self._session.get(Supplier, payload.supplier_id)
        if supplier is None or supplier.organization_id != actor.organization_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")

        record = MaterialEvent(
            organization_id=actor.organization_id,
            project_id=payload.project_id,
            supplier_id=payload.supplier_id,
            material_type=payload.material_type,
            quantity=payload.quantity,
            unit=payload.unit,
            delivery_date=payload.delivery_date,
            status=MaterialStatus.DRAFT,
            created_at=datetime.now(timezone.utc),
            created_by=actor.id,
        )
        self._session.add(record)
        self._session.flush()

        self._audit.log(
            organization_id=actor.organization_id,
            entity_type="material_event",
            entity_id=record.id,
            action="CREATE_MATERIAL_EVENT",
            user_id=actor.id,
            before_state={},
            after_state={"status": record.status.value, "material_type": record.material_type},
        )
        return record

    def update_draft(self, *, event_id: UUID, payload: MaterialEventUpdate, actor: User) -> MaterialEvent:
        record = self._session.get(MaterialEvent, event_id)
        if record is None or record.organization_id != actor.organization_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Material event not found")
        if record.status != MaterialStatus.DRAFT:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Only DRAFT events are editable")
        if record.created_by != actor.id and actor.role != UserRole.ADMIN:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only creator can edit draft")

        previous = {
            "supplier_id": str(record.supplier_id),
            "material_type": record.material_type,
            "quantity": float(record.quantity),
            "unit": record.unit,
            "delivery_date": record.delivery_date.isoformat(),
            "status": record.status.value,
        }

        if payload.supplier_id is not None:
            supplier = self._session.get(Supplier, payload.supplier_id)
            if supplier is None or supplier.organization_id != actor.organization_id:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")
            record.supplier_id = payload.supplier_id
        if payload.material_type is not None:
            record.material_type = payload.material_type
        if payload.quantity is not None:
            record.quantity = payload.quantity
        if payload.unit is not None:
            record.unit = payload.unit
        if payload.delivery_date is not None:
            record.delivery_date = payload.delivery_date

        self._audit.log(
            organization_id=actor.organization_id,
            entity_type="material_event",
            entity_id=record.id,
            action="UPDATE_MATERIAL_EVENT_DRAFT",
            user_id=actor.id,
            before_state=previous,
            after_state={
                "supplier_id": str(record.supplier_id),
                "material_type": record.material_type,
                "quantity": float(record.quantity),
                "unit": record.unit,
                "delivery_date": record.delivery_date.isoformat(),
                "status": record.status.value,
            },
        )
        return record

    def transition(self, *, event_id: UUID, target: MaterialStatus, actor: User) -> MaterialEvent:
        record = self._session.get(MaterialEvent, event_id)
        if record is None or record.organization_id != actor.organization_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Material event not found")

        transitions = {
            MaterialStatus.DRAFT: {MaterialStatus.SUBMITTED},
            MaterialStatus.SUBMITTED: {MaterialStatus.UNDER_REVIEW},
            MaterialStatus.UNDER_REVIEW: {MaterialStatus.VERIFIED, MaterialStatus.DRAFT},
            MaterialStatus.VERIFIED: {MaterialStatus.APPROVED},
            MaterialStatus.APPROVED: {MaterialStatus.LOCKED},
            MaterialStatus.LOCKED: set(),
        }

        if target not in transitions.get(record.status, set()):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Invalid state transition")

        if target == MaterialStatus.SUBMITTED and actor.id != record.created_by and actor.role != UserRole.ADMIN:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only creator can submit")
        if target in {MaterialStatus.UNDER_REVIEW, MaterialStatus.VERIFIED} and actor.role not in {
            UserRole.VERIFIER,
            UserRole.ESG_ANALYST,
            UserRole.ADMIN,
        }:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Verifier role required")
        if target in {MaterialStatus.APPROVED, MaterialStatus.LOCKED} and actor.role not in {
            UserRole.APPROVER,
            UserRole.CONTRACTOR_MANAGER,
            UserRole.ADMIN,
        }:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Approver role required")

        previous_status = record.status
        record.status = target

        action_map = {
            MaterialStatus.SUBMITTED: "SUBMIT_FOR_VERIFICATION",
            MaterialStatus.UNDER_REVIEW: "START_REVIEW",
            MaterialStatus.VERIFIED: "VERIFY_RECORD",
            MaterialStatus.APPROVED: "APPROVE_RECORD",
            MaterialStatus.LOCKED: "LOCK_RECORD",
            MaterialStatus.DRAFT: "RETURN_TO_DRAFT",
        }
        self._audit.log(
            organization_id=actor.organization_id,
            entity_type="material_event",
            entity_id=record.id,
            action=action_map[target],
            user_id=actor.id,
            before_state={"status": previous_status.value},
            after_state={"status": target.value},
        )
        return record

    def list(self, *, actor: User, limit: int, offset: int) -> tuple[int, list[MaterialEvent]]:
        base = select(MaterialEvent).where(MaterialEvent.organization_id == actor.organization_id)
        total = int(
            self._session.execute(
                select(func.count(MaterialEvent.id)).where(MaterialEvent.organization_id == actor.organization_id)
            ).scalar_one()
        )
        items = list(
            self._session.execute(base.order_by(MaterialEvent.created_at.desc()).limit(limit).offset(offset)).scalars().all()
        )
        return total, items
