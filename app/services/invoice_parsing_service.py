from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Iterable


@dataclass
class InvoiceParsingResult:
    supplier_name: str | None
    invoice_number: str | None
    material_type: str | None
    expected_quantity: float | None
    vehicle_number: str | None
    invoice_timestamp: datetime | None
    confidence: dict[str, float]


class InvoiceParsingService:
    def parse(self, raw_text: str) -> InvoiceParsingResult:
        lines = self._normalize_lines(raw_text)
        supplier_name, supplier_conf = self._extract_supplier(lines)
        invoice_number, invoice_conf = self._extract_invoice_number(lines)
        material_type, material_conf = self._extract_material(lines)
        expected_quantity, quantity_conf = self._extract_quantity(lines)
        vehicle_number, vehicle_conf = self._extract_vehicle(lines)
        invoice_timestamp, timestamp_conf = self._extract_timestamp(lines)

        confidence = {
            "supplier_name": supplier_conf,
            "invoice_number": invoice_conf,
            "material_type": material_conf,
            "expected_quantity": quantity_conf,
            "vehicle_number": vehicle_conf,
            "invoice_timestamp": timestamp_conf,
        }

        return InvoiceParsingResult(
            supplier_name=supplier_name,
            invoice_number=invoice_number,
            material_type=material_type,
            expected_quantity=expected_quantity,
            vehicle_number=vehicle_number,
            invoice_timestamp=invoice_timestamp,
            confidence=confidence,
        )

    def _normalize_lines(self, raw_text: str) -> list[str]:
        lines = [line.strip() for line in raw_text.splitlines()]
        return [line for line in lines if line]

    def _extract_supplier(self, lines: Iterable[str]) -> tuple[str | None, float]:
        value = self._find_labeled_value(lines, ["supplier", "vendor", "from"])
        if value:
            return value, 0.9
        fallback = next(iter(lines), None)
        return (fallback, 0.45) if fallback else (None, 0.0)

    def _extract_invoice_number(self, lines: Iterable[str]) -> tuple[str | None, float]:
        value = self._find_regex_value(
            lines,
            r"invoice\s*(?:no\.?|number|#|id)?\s*[:#]?\s*([A-Z0-9-]{4,})",
        )
        return (value, 0.9) if value else (None, 0.0)

    def _extract_material(self, lines: Iterable[str]) -> tuple[str | None, float]:
        value = self._find_labeled_value(lines, ["material", "item", "product"])
        return (value, 0.8) if value else (None, 0.0)

    def _extract_quantity(self, lines: Iterable[str]) -> tuple[float | None, float]:
        value = self._find_regex_value(
            lines,
            r"(?:qty|quantity|amount)\s*[:#]?\s*([0-9]+(?:\.[0-9]+)?)",
        )
        if value:
            return float(value), 0.85
        return None, 0.0

    def _extract_vehicle(self, lines: Iterable[str]) -> tuple[str | None, float]:
        value = self._find_regex_value(
            lines,
            r"(?:vehicle|truck|plate|registration)\s*[:#]?\s*([A-Z0-9-]{4,})",
        )
        return (value, 0.8) if value else (None, 0.0)

    def _extract_timestamp(self, lines: Iterable[str]) -> tuple[datetime | None, float]:
        date_value = self._find_regex_value(
            lines,
            r"(?:date|invoice date|issued)\s*[:#]?\s*([0-9]{4}-[0-9]{2}-[0-9]{2}|[0-9]{2}/[0-9]{2}/[0-9]{4})",
        )
        if not date_value:
            return None, 0.0
        parsed = self._parse_date(date_value)
        if parsed is None:
            return None, 0.0
        return parsed, 0.75

    def _find_labeled_value(self, lines: Iterable[str], labels: list[str]) -> str | None:
        for line in lines:
            lowered = line.lower()
            for label in labels:
                if label in lowered:
                    parts = re.split(r"[:#]", line, maxsplit=1)
                    if len(parts) == 2:
                        value = parts[1].strip()
                        if value:
                            return value
        return None

    def _find_regex_value(self, lines: Iterable[str], pattern: str) -> str | None:
        regex = re.compile(pattern, re.IGNORECASE)
        for line in lines:
            match = regex.search(line)
            if match:
                return match.group(1).strip()
        return None

    def _parse_date(self, value: str) -> datetime | None:
        for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y"):
            try:
                parsed = datetime.strptime(value, fmt)
                return parsed.replace(tzinfo=timezone.utc)
            except ValueError:
                continue
        return None
