import hashlib
from pathlib import Path
from uuid import UUID

from app.models.evidence_file import EvidenceFile
from app.services.audit_service import AuditService


class EvidenceService:
    def __init__(self, audit_service: AuditService) -> None:
        self._audit = audit_service

    def verify_integrity(self, *, evidence: EvidenceFile, actor_user_id: UUID) -> dict[str, object]:
        path = Path(evidence.storage_path)
        if not path.exists():
            raise ValueError("Evidence file missing on disk")

        computed_hash = _sha256_file(path)
        integrity_valid = computed_hash == evidence.file_hash

        result = {
            "evidence_id": str(evidence.id),
            "stored_hash": evidence.file_hash,
            "computed_hash": computed_hash,
            "integrity_valid": integrity_valid,
        }

        self._audit.log(
            performed_by_id=actor_user_id,
            entity_type="EvidenceFile",
            entity_id=evidence.id,
            action="evidence_verified",
            previous_state={},
            new_state=result,
        )
        return result


def _sha256_file(path: Path) -> str:
    hasher = hashlib.sha256()
    with path.open("rb") as handle:
        while True:
            chunk = handle.read(1024 * 1024)
            if not chunk:
                break
            hasher.update(chunk)
    return hasher.hexdigest()
