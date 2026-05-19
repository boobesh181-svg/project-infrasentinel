from __future__ import annotations

from collections import deque
from dataclasses import dataclass
from statistics import fmean
from typing import Iterable


@dataclass(frozen=True)
class DriftResult:
    drift_score: float
    threshold: float
    drift_detected: bool
    recommendation: str


class ModelMonitoringService:
    """Lightweight in-memory monitoring for risk score behavior."""

    def __init__(self, max_samples: int = 1000, drift_threshold: float = 0.25) -> None:
        self._max_samples = max_samples
        self._drift_threshold = drift_threshold
        self._anomaly_scores: deque[float] = deque(maxlen=max_samples)
        self._predicted_high: deque[int] = deque(maxlen=max_samples)
        self._actual_false_positive: deque[int] = deque(maxlen=max_samples)

    def record(
        self,
        *,
        anomaly_score: float,
        predicted_high_risk: bool,
        false_positive: bool | None = None,
    ) -> None:
        score = min(max(float(anomaly_score), 0.0), 1.0)
        self._anomaly_scores.append(score)
        self._predicted_high.append(1 if predicted_high_risk else 0)
        if false_positive is not None:
            self._actual_false_positive.append(1 if false_positive else 0)

    def summary(self) -> dict[str, float | int | list[float]]:
        count = len(self._anomaly_scores)
        if count == 0:
            return {
                "samples": 0,
                "anomaly_rate": 0.0,
                "false_positive_rate": 0.0,
                "score_distribution": [0.0, 0.0, 0.0, 0.0],
            }

        scores = list(self._anomaly_scores)
        anomaly_rate = sum(1 for score in scores if score >= 0.6) / count
        false_positive_rate = (
            sum(self._actual_false_positive) / len(self._actual_false_positive)
            if self._actual_false_positive
            else 0.0
        )

        return {
            "samples": count,
            "anomaly_rate": round(anomaly_rate, 4),
            "false_positive_rate": round(false_positive_rate, 4),
            "score_distribution": _distribution_quartiles(scores),
        }

    def detect_drift(self, *, training_distribution: Iterable[float]) -> DriftResult:
        current = list(self._anomaly_scores)
        baseline = [float(value) for value in training_distribution]
        if not baseline or not current:
            return DriftResult(
                drift_score=0.0,
                threshold=self._drift_threshold,
                drift_detected=False,
                recommendation="insufficient_data",
            )

        baseline_mean = fmean(baseline)
        current_mean = fmean(current)
        baseline_std = _stddev(baseline)
        current_std = _stddev(current)

        mean_delta = abs(current_mean - baseline_mean)
        std_delta = abs(current_std - baseline_std)
        drift_score = min(1.0, mean_delta + (0.5 * std_delta))
        detected = drift_score >= self._drift_threshold

        return DriftResult(
            drift_score=round(drift_score, 4),
            threshold=self._drift_threshold,
            drift_detected=detected,
            recommendation="retrain_recommended" if detected else "stable",
        )


def _distribution_quartiles(values: list[float]) -> list[float]:
    ordered = sorted(values)
    if not ordered:
        return [0.0, 0.0, 0.0, 0.0]
    n = len(ordered)

    def _idx(p: float) -> int:
        return min(max(int(round((n - 1) * p)), 0), n - 1)

    return [
        round(float(ordered[_idx(0.25)]), 4),
        round(float(ordered[_idx(0.50)]), 4),
        round(float(ordered[_idx(0.75)]), 4),
        round(float(ordered[-1]), 4),
    ]


def _stddev(values: list[float]) -> float:
    if len(values) <= 1:
        return 0.0
    mean = fmean(values)
    variance = sum((value - mean) ** 2 for value in values) / len(values)
    return variance ** 0.5
