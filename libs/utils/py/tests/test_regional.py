"""aei.regional: the monthly regional test signals a clear spike and stays quiet on a steady series."""

from __future__ import annotations

import pandas as pd
from scipy import stats

from aei.regional import regional_signals, upper_tail


def series(counts: list[int]) -> pd.DataFrame:
    months = [f"{2021 + i // 12}-{i % 12 + 1:02d}" for i in range(len(counts))]
    return pd.DataFrame({"group_sid": 1, "group": "MRSA carriage", "region": "Varsinais-Suomi", "month": months, "cases": counts})


def test_upper_tail_is_poisson_without_overdispersion():
    assert upper_tail(8, 0.6, 1.0) == stats.poisson.sf(7, 0.6)
    assert upper_tail(8, 0.6, 2.0) > upper_tail(8, 0.6, 1.0)  # overdispersion widens the tail


def test_spike_signals_and_steady_series_does_not():
    steady = [3, 4, 2, 3, 5, 3, 4, 3, 2, 4] * 4
    spike = steady[:38] + [15] + steady[39:]
    first_target = "2024-01"  # month index 36
    assert regional_signals(series(steady), first_target=first_target).empty
    found = regional_signals(series(spike), first_target=first_target)
    assert list(found["month"]) == ["2024-03"]
    assert int(found["cases"].iloc[0]) == 15
