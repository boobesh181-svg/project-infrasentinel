from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.evidence_file import EvidenceFile
from app.models.material_entry import MaterialEntry


DEFAULT_REQUIRED_EVIDENCE: dict[str, set[str]] = {
    "concrete": {"delivery_note", "supplier_invoice", "site_photo"},
    "steel": {"delivery_note", "supplier_invoice", "mill_certificate"},
    "glass": {"delivery_note", "supplier_invoice", "site_photo"},
}


class EvidenceRuleEngine:
    def __init__(self, session: Session) -> None:
        self._session = session

    def validate_for_verification(self, *, entry: MaterialEntry) -> tuple[bool, list[str]]:
        required = DEFAULT_REQUIRED_EVIDENCE.get(entry.material_name.strip().lower(), set())
        if not required:
            return True, []

        stmt = select(EvidenceFile).where(EvidenceFile.material_entry_id == entry.id)
        evidence_files = list(self._session.execute(stmt).scalars().all())
        provided = {item.evidence_type.strip().lower() for item in evidence_files}

        missing = sorted(requirement for requirement in required if requirement not in provided)
        return len(missing) == 0, missing
