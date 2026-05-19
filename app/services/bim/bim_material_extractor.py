from __future__ import annotations

from collections import defaultdict


_MATERIAL_ALIASES = {
    "concrete": "concrete",
    "cement": "concrete",
    "reinforced concrete": "concrete",
    "steel": "steel",
    "rebar": "steel",
    "reinforcement": "steel",
    "glass": "glass",
    "facade glass": "glass",
}


_UNIT_CONVERSION = {
    ("kg", "tons"): 0.001,
    ("ton", "tons"): 1.0,
    ("tons", "tons"): 1.0,
    ("m3", "m3"): 1.0,
    ("m2", "m2"): 1.0,
}


_STANDARD_UNIT = {
    "concrete": "m3",
    "steel": "tons",
    "glass": "m2",
}


class BIMMaterialExtractor:
    def normalize_material_name(self, name: str) -> str:
        lowered = name.strip().lower()
        for alias, canonical in _MATERIAL_ALIASES.items():
            if alias in lowered:
                return canonical
        return lowered or "unknown"

    def convert_quantity(self, *, quantity: float, from_unit: str, material_name: str) -> tuple[float, str]:
        standard_unit = _STANDARD_UNIT.get(material_name, from_unit.lower())
        key = (from_unit.lower(), standard_unit)
        factor = _UNIT_CONVERSION.get(key)
        if factor is None:
            return quantity, from_unit.lower()
        return quantity * factor, standard_unit

    def aggregate(self, raw_materials: list[dict[str, object]]) -> list[dict[str, object]]:
        grouped: dict[tuple[str, str], dict[str, object]] = defaultdict(
            lambda: {"quantity": 0.0, "sources": set(), "confidence_sum": 0.0, "count": 0}
        )

        for item in raw_materials:
            material_name = self.normalize_material_name(str(item.get("material") or item.get("material_name") or "unknown"))
            quantity = float(item.get("quantity") or 0.0)
            unit = str(item.get("unit") or "unknown").lower()
            source_element = str(item.get("source_element") or "unknown")
            confidence = float(item.get("confidence_score") or 0.8)

            converted_quantity, normalized_unit = self.convert_quantity(
                quantity=quantity,
                from_unit=unit,
                material_name=material_name,
            )

            key = (material_name, normalized_unit)
            grouped[key]["quantity"] += converted_quantity
            grouped[key]["sources"].add(source_element)
            grouped[key]["confidence_sum"] += confidence
            grouped[key]["count"] += 1

        normalized: list[dict[str, object]] = []
        for (material_name, unit), values in grouped.items():
            count = max(int(values["count"]), 1)
            normalized.append(
                {
                    "material_name": material_name,
                    "quantity": round(float(values["quantity"]), 6),
                    "unit": unit,
                    "source_element": ",".join(sorted(values["sources"])),
                    "confidence_score": round(float(values["confidence_sum"]) / count, 4),
                }
            )

        normalized.sort(key=lambda value: str(value["material_name"]))
        return normalized
