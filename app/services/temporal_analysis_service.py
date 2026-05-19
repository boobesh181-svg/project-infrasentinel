from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.models.material_entry import MaterialEntry


class TemporalAnalysisService:
    def detect_temporal_anomaly(self, *, entry: MaterialEntry) -> bool:
        if entry.submitted_at is None:
            return False

        submitted_at = _as_utc(entry.submitted_at)
        created_at = _as_utc(entry.created_at)

        too_fast_submission = (submitted_at - created_at) <= timedelta(seconds=10)

        too_fast_verification = False
        if entry.verified_at is not None:
            verified_at = _as_utc(entry.verified_at)
            too_fast_verification = (verified_at - submitted_at) <= timedelta(seconds=10)

        return too_fast_submission or too_fast_verification


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)
