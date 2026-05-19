from __future__ import annotations

from pathlib import Path


def _extract_quantity_value(quantity: object) -> tuple[float | None, str]:
    for field_name, unit in (
        ("VolumeValue", "m3"),
        ("WeightValue", "kg"),
        ("AreaValue", "m2"),
        ("LengthValue", "m"),
        ("CountValue", "count"),
    ):
        value = getattr(quantity, field_name, None)
        if value is not None:
            return float(value), unit
    return None, "unknown"


def parse_ifc(file_path: str | Path) -> list[dict[str, object]]:
    try:
        import ifcopenshell  # type: ignore[import-not-found]
    except Exception as exc:
        raise RuntimeError("ifcopenshell is required for IFC parsing") from exc

    model = ifcopenshell.open(str(file_path))
    extracted: list[dict[str, object]] = []

    for quantity_set in model.by_type("IfcElementQuantity"):
        source_element = str(getattr(quantity_set, "Name", "IfcElementQuantity") or "IfcElementQuantity")
        for quantity in getattr(quantity_set, "Quantities", []) or []:
            value, unit = _extract_quantity_value(quantity)
            if value is None:
                continue

            material_name = str(getattr(quantity, "Name", "unknown") or "unknown")
            extracted.append(
                {
                    "material": material_name,
                    "quantity": value,
                    "unit": unit,
                    "source_element": source_element,
                    "confidence_score": 0.8,
                }
            )

    if not extracted:
        for material in model.by_type("IfcMaterial"):
            name = str(getattr(material, "Name", "unknown") or "unknown")
            extracted.append(
                {
                    "material": name,
                    "quantity": 0.0,
                    "unit": "unknown",
                    "source_element": "IfcMaterial",
                    "confidence_score": 0.5,
                }
            )

    return extracted
