"""The scoring harness of benchmarks/METRICS.md: the split, the data, and the metrics.json every experiment writes.

Specification and the choices it makes: benchmarks/overnight-2026-10-17/harness-spec.md. The metric families live in
their own modules, which import this one:

    from aei import harness, score_coverage, score_detection, score_prediction
    records, cultures = harness.data()
    ...
    harness.write_metrics("experiments/0012-slug/out/metrics.json", experiment="0012-slug", method="...", family="coverage",
                          metrics={...}, intervals={...}, n={...}, runtime_s=..., seeds=[2026])
"""

from __future__ import annotations

import json
import math
import time
from functools import lru_cache
from pathlib import Path

from aei.dataset import Culture, IsolateRecord, load_records

ROOT = Path(__file__).resolve().parents[4]
DATA = ROOT / "data" / "synthetic_microbiology_dataset"
THL = ROOT / "data" / "external" / "thl" / "ttr_monthly.csv"
THL_FETCHED = "2026-10-17"

# METRICS.md "Split": tune on the first year, score on the rest.
TUNE = ("2023-10-02", "2024-09-30")
SCORE = ("2024-10-01", "2026-09-27")
# Injection seeds (Artem's addendum, 01:15): screen on 2026 only; 2027 to 2030 are held out to re-score winners.
SCREEN_SEEDS = (2026,)
HELDOUT_SEEDS = (2027, 2028, 2029, 2030)
SEEDS = SCREEN_SEEDS
DATASET = "synthetic_microbiology_dataset, seed 2026, as received 2026-10-09"
FAMILIES = ("detection", "coverage", "prediction", "interpretation")


@lru_cache(maxsize=1)
def data() -> tuple[list[IsolateRecord], list[Culture]]:
    """Isolate records and cultures of the whole dataset, loaded once per process. Do not mutate them."""
    return load_records(DATA)


def in_period(day: str, period: tuple[str, str]) -> bool:
    return period[0] <= day <= period[1]


class Clock:
    """Wall and CPU seconds since construction, for `runtime_s` and `cpu_s`."""

    def __init__(self) -> None:
        self.wall0 = time.perf_counter()
        self.cpu0 = time.process_time()

    @property
    def wall(self) -> float:
        return time.perf_counter() - self.wall0

    @property
    def cpu(self) -> float:
        return time.process_time() - self.cpu0


def _clean(x: object) -> object:
    """JSON-safe: NaN and infinities become None, numpy scalars plain numbers, tuples lists."""
    if isinstance(x, dict):
        return {str(k): _clean(v) for k, v in x.items()}
    if isinstance(x, (list, tuple)):
        return [_clean(v) for v in x]
    if hasattr(x, "item") and not isinstance(x, (str, bytes)):
        x = x.item()
    if isinstance(x, float) and not math.isfinite(x):
        return None
    if isinstance(x, float):
        return float(f"{x:.6g}")
    return x


def write_metrics(
    path: str | Path,
    *,
    experiment: str,
    method: str,
    family: str,
    metrics: dict,
    intervals: dict | None = None,
    n: dict | None = None,
    runtime_s: float,
    cpu_s: float | None = None,
    seeds: list[int] | tuple[int, ...] = (),
    tuned_on_test: bool = False,
    tuned_on: str = f"{TUNE[0]}..{TUNE[1]}",
    notes: str = "",
    **extra: object,
) -> dict:
    """Write `out/metrics.json` in METRICS.md's schema ("Reporting format"); returns what was written. Floats are rounded
    to 6 significant digits so reruns compare equal."""
    if family not in FAMILIES:
        raise ValueError(f"family must be one of {FAMILIES}, not {family!r}")
    doc = {
        "experiment": experiment,
        "method": method,
        "family": family,
        "tuned_on_test": tuned_on_test,
        "tuned_on": tuned_on,
        "metrics": metrics,
        "intervals": intervals or {},
        "n": n or {},
        "runtime_s": round(runtime_s, 1),
        "cpu_s": round(cpu_s, 1) if cpu_s is not None else None,
        "seeds": list(seeds),
        "data": DATASET,
        "notes": notes,
        **extra,
    }
    doc = _clean(doc)
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n")
    return doc
