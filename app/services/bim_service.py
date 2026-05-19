from __future__ import annotations

import logging
from collections import defaultdict
from pathlib import Path
from typing import Any

logger = logging.getLogger("infrasentinel")


def parse_ifc_materials(file_path: str) -> list[dict[str, Any]]:
    """Parse an IFC file and extract aggregated material quantities.

    Returns a list of dictionaries with keys: name, quantity, unit.
    """
    path = Path(file_path)
    if not path.exists() or not path.is_file():
        raise FileNotFoundError(f"IFC file not found: {file_path}")

    try:
        import ifcopenshell  # type: ignore[import-not-found]
    except Exception as exc:  # pragma: no cover
        raise RuntimeError("ifcopenshell is required for BIM extraction") from exc

    logger.info("Parsing IFC materials from %s", path)
    model = ifcopenshell.open(str(path))

    ifc_materials = model.by_type("IfcMaterial") or []
    known_materials = {_normalize_name(getattr(mat, "Name", None)) for mat in ifc_materials}
    known_materials.discard("unknown")

    totals: dict[tuple[str, str], float] = defaultdict(float)

    for qset in model.by_type("IfcElementQuantity") or []:
        qset_name = getattr(qset, "Name", "") or ""
        for quantity in getattr(qset, "Quantities", []) or []:
            value, unit = _extract_quantity_and_unit(quantity)
            if value is None:
                continue

            quantity_name = getattr(quantity, "Name", "") or ""
            material_name = _resolve_material_name(quantity_name, qset_name, known_materials)
            if material_name == "unknown":
                continue

            normalized_material = _normalize_name(material_name)
            normalized_value, normalized_unit = _normalize_quantity_unit(
                material_name=normalized_material,
                value=float(value),
                unit=unit,
            )
            totals[(normalized_material.title(), normalized_unit)] += normalized_value

    materials = [
        {
            "name": name,
            "quantity": round(quantity, 6),
            "unit": unit,
        }
        for (name, unit), quantity in sorted(totals.items(), key=lambda item: item[0][0])
    ]

    logger.info("Extracted %s aggregated materials from %s", len(materials), path)
    return materials


def _extract_quantity_and_unit(quantity: Any) -> tuple[float | None, str]:
    for attr, unit in (
        ("VolumeValue", "m3"),
        ("WeightValue", "kg"),
        ("AreaValue", "m2"),
        ("LengthValue", "m"),
        ("CountValue", "count"),
    ):
        value = getattr(quantity, attr, None)
        if value is not None:
            return float(value), unit
    return None, "unknown"


def _resolve_material_name(quantity_name: str, qset_name: str, known_materials: set[str]) -> str:
    from_quantity = _normalize_name(quantity_name)
    if from_quantity in known_materials:
        return from_quantity

    for known in known_materials:
        if known in from_quantity:
            return known

    from_qset = _normalize_name(qset_name)
    if from_qset in known_materials:
        return from_qset

    for known in known_materials:
        if known in from_qset:
            return known

    # Fallback to parsed names when no explicit material relation is available.
    if from_quantity != "unknown":
        return from_quantity
    if from_qset != "unknown":
        return from_qset
    return "unknown"


def _normalize_quantity_unit(*, material_name: str, value: float, unit: str) -> tuple[float, str]:
    # Keep steel in tons for easier cross-checking with procurement reports.
    if material_name in {"steel", "rebar"} and unit == "kg":
        return value / 1000.0, "tons"
    return value, unit


def _normalize_name(raw: str | None) -> str:
    if not raw:
        return "unknown"
    lowered = raw.strip().lower()
    if not lowered:
        return "unknown"
    if "reinforcement" in lowered or "rebar" in lowered:
        return "steel"
    return lowered
