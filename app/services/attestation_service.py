import logging
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.attestation import Attestation
from app.models.material_entry import MaterialEntry
from app.models.project import Project
from app.models.user import User
from app.schemas.attestation import AttestationCreate
from app.services.audit_service import AuditService

logger = logging.getLogger("infrasentinel")

_ALLOWED_TYPES = {"OBSERVED", "SUPPLIED", "VERIFIED"}
_SUPPORTED_ENTITY_TYPES = {"material_entry"}


class AttestationService:
    def __init__(self, session: Session) -> None:
        self._session = session

    def create_attestation(self, *, payload: AttestationCreate, user: User) -> Attestation:
        if payload.attestation_type not in _ALLOWED_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unsupported attestation type",
            )
        if payload.entity_type not in _SUPPORTED_ENTITY_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unsupported entity type",
            )

        entity_id = payload.entity_id
        self._assert_material_entry_access(entity_id=entity_id, user=user)

        attestation = Attestation(
            entity_type=payload.entity_type,
            entity_id=entity_id,
            attestor_user_id=user.id,
            attestation_type=payload.attestation_type,
            comment=payload.comment,
        )

        audit = AuditService(self._session)
        try:
            with self._session.begin():
                self._session.add(attestation)
                self._session.flush()
                audit.log(
                    performed_by_id=user.id,
                    entity_type=payload.entity_type,
                    entity_id=entity_id,
                    action="attestation_created",
                    previous_state={},
                    new_state={
                        "id": attestation.id,
                        "entity_type": attestation.entity_type,
                        "entity_id": attestation.entity_id,
                        "attestor_user_id": attestation.attestor_user_id,
                        "attestation_type": attestation.attestation_type,
                        "comment": attestation.comment,
                        "created_at": attestation.created_at.isoformat()
                        if attestation.created_at
                        else None,
                    },
                )
        except IntegrityError as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Duplicate attestation for this user",
            ) from exc

        return attestation

    def get_entity_attestations(
        self, *, entity_type: str, entity_id: UUID, user: User
    ) -> list[Attestation]:
        if entity_type not in _SUPPORTED_ENTITY_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unsupported entity type",
            )

        self._assert_material_entry_access(entity_id=entity_id, user=user)

        stmt = (
            select(Attestation)
            .where(
                Attestation.entity_type == entity_type,
                Attestation.entity_id == entity_id,
            )
            .order_by(Attestation.created_at.asc())
        )
        return list(self._session.execute(stmt).scalars().all())

    def has_supplier_attestation(self, *, entity_id: UUID) -> bool:
        return self._has_attestation(entity_id=entity_id, attestation_type="SUPPLIED")

    def has_observer_attestation(self, *, entity_id: UUID) -> bool:
        return self._has_attestation(entity_id=entity_id, attestation_type="OBSERVED")

    def _has_attestation(self, *, entity_id: UUID, attestation_type: str) -> bool:
        stmt = select(Attestation.id).where(
            Attestation.entity_type == "material_entry",
            Attestation.entity_id == entity_id,
            Attestation.attestation_type == attestation_type,
        )
        return self._session.execute(stmt).first() is not None

    def _assert_material_entry_access(self, *, entity_id: UUID, user: User) -> None:
        stmt = (
            select(MaterialEntry)
            .join(Project, Project.id == MaterialEntry.project_id)
            .where(MaterialEntry.id == entity_id, Project.organization_id == user.organization_id)
        )
        entry = self._session.execute(stmt).scalar_one_or_none()
        if entry is None:
            if self._session.get(MaterialEntry, entity_id) is None:
                logger.warning(
                    "404 resource not found",
                    extra={
                        "resource": "material_entry",
                        "requested_id": str(entity_id),
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
                    "resource": "material_entry",
                    "requested_id": str(entity_id),
                    "user_id": str(user.id),
                    "user_email": user.email,
                    "user_org": str(user.organization_id),
                    "db_exists": True,
                    "org_mismatch": True,
                },
            )
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
