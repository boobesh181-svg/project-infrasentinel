from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.emission_factor import EmissionFactor
from app.models.emission_record import EmissionRecord
from app.models.material_entry import MaterialStatus
from app.models.material_event import MaterialEvent
from app.models.user import User
from app.services.verification_audit_service import VerificationAuditService


class EmissionRecordService:
    def __init__(self, session: Session) -> None:
        self._session = session
        self._audit = VerificationAuditService(session)

    def calculate(self, *, material_event_id: UUID, calculation_method: str, actor: User) -> EmissionRecord:
        event = self._session.get(MaterialEvent, material_event_id)
        if event is None or event.organization_id != actor.organization_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Material event not found")

        if event.status not in {MaterialStatus.SUBMITTED, MaterialStatus.UNDER_REVIEW, MaterialStatus.VERIFIED, MaterialStatus.APPROVED, MaterialStatus.LOCKED}:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Event must be submitted before calculation")

        factor = self._session.execute(
            select(EmissionFactor)
            .where(EmissionFactor.material_name == event.material_type, EmissionFactor.is_active.is_(True))
            .order_by(EmissionFactor.version.desc())
        ).scalar_one_or_none()
        if factor is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No active emission factor for material type")

        emission_value = float(event.quantity) * float(factor.factor_value)
        record = EmissionRecord(
            organization_id=actor.organization_id,
            material_event_id=event.id,
            factor_value_snapshot=factor.factor_value,
            factor_source_snapshot=factor.source,
            factor_reference_snapshot=factor.source_document_url,
            calculation_method=calculation_method,
            emission_value=emission_value,
            created_at=datetime.now(timezone.utc),
            created_by=actor.id,
            status="CALCULATED",
        )
        self._session.add(record)
        self._session.flush()

        self._audit.log(
            organization_id=actor.organization_id,
            entity_type="emission_record",
            entity_id=record.id,
            action="CALCULATE_EMISSION",
            user_id=actor.id,
            before_state={},
            after_state={
                "material_event_id": str(event.id),
                "factor_value_snapshot": float(record.factor_value_snapshot),
                "emission_value": float(record.emission_value),
            },
        )
        return record
