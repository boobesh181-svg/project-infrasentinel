from __future__ import annotations

from pathlib import Path


class BIMParserService:
    def parse_ifc_materials(self, file_path: Path) -> dict[str, float]:
        try:
            import ifcopenshell  # type: ignore[import-not-found]
        except Exception as exc:  # pragma: no cover
            raise RuntimeError("ifcopenshell is required for IFC parsing") from exc

        model = ifcopenshell.open(str(file_path))

        # Minimal extraction targets requested by product requirements.
        aggregates: dict[str, float] = {
            "concrete": 0.0,
            "steel": 0.0,
            "glass": 0.0,
        }

        for quantity in model.by_type("IfcElementQuantity"):
            for element in quantity.Quantities or []:
                quantity_value, unit = _extract_quantity_value(element)
                if quantity_value is None:
                    continue

                material_type = _normalize_material_name(quantity.Name or "Unknown")
                if material_type not in aggregates:
                    continue

                # Convert steel weight to tons for storage consistency.
                if material_type == "steel" and unit == "kg":
                    aggregates[material_type] += quantity_value / 1000.0
                else:
                    aggregates[material_type] += quantity_value

        return {
            key: round(value, 6)
            for key, value in aggregates.items()
        }

    def parse_ifc(self, *, file_path: Path) -> list[dict[str, object]]:
        material_totals = self.parse_ifc_materials(file_path)
        unit_map = {
            "concrete": "m3",
            "steel": "ton",
            "glass": "m2",
        }

        return [
            {
                "material_type": material_type,
                "estimated_quantity": quantity,
                "unit": unit_map[material_type],
            }
            for material_type, quantity in material_totals.items()
        ]


def _extract_quantity_value(quantity: object) -> tuple[float | None, str]:
    # IFC quantities can represent volume, area, length, count, and weight.
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


def _normalize_material_name(raw: str) -> str:
    lowered = raw.lower()
    if "concrete" in lowered:
        return "concrete"
    if "steel" in lowered or "rebar" in lowered:
        return "steel"
    if "glass" in lowered:
        return "glass"
    return raw.strip().lower() or "unknown"
