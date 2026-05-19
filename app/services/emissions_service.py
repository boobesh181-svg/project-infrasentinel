from __future__ import annotations

import logging
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.emission_factor import EmissionFactor

logger = logging.getLogger("infrasentinel")


class EmissionsService:
    def __init__(self, session: Session) -> None:
        self._session = session

    def calculate_material_emissions(self, materials: list[dict[str, Any]]) -> dict[str, Any]:
        breakdown: list[dict[str, float | str]] = []
        total_emissions = 0.0

        for material in materials:
            name = str(material.get("name", "")).strip()
            quantity = float(material.get("quantity", 0.0))
            unit = str(material.get("unit", "")).strip()

            factor = self._get_latest_factor(material_name=name)
            if factor is None:
                logger.warning("No emission factor found for material '%s'; returning 0 emissions", name)
                breakdown.append({"material": name, "emissions": 0.0})
                continue

            if unit and factor.unit and unit.lower() != factor.unit.lower():
                logger.warning(
                    "Unit mismatch for material '%s': input unit '%s' vs factor unit '%s'; returning 0 emissions",
                    name,
                    unit,
                    factor.unit,
                )
                breakdown.append({"material": name, "emissions": 0.0})
                continue

            emissions = quantity * float(factor.factor_value)
            total_emissions += emissions
            breakdown.append({"material": name, "emissions": round(emissions, 6)})

        return {
            "total_emissions": round(total_emissions, 6),
            "breakdown": breakdown,
        }

    def _get_latest_factor(self, *, material_name: str) -> EmissionFactor | None:
        stmt = (
            select(EmissionFactor)
            .where(
                func.lower(EmissionFactor.material_name) == material_name.lower(),
                EmissionFactor.is_active.is_(True),
            )
            .order_by(EmissionFactor.version.desc())
            .limit(1)
        )
        return self._session.execute(stmt).scalar_one_or_none()
