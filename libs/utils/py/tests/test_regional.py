"""aei.regional: the monthly regional test signals a clear spike and stays quiet on a steady series."""

from __future__ import annotations

import pandas as pd
from scipy import stats

from aei.regional import NATIONAL, regional_signals, regional_view, upper_tail


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


def test_view_drops_the_fetch_month_and_adds_the_national_total():
    steady = [3, 4, 2, 3, 5, 3, 4, 3, 2, 4] * 4
    spike = steady[:38] + [15] + steady[39:]
    thl = series(spike).assign(incidence_per_100k=1.0)
    view = regional_view(thl, fetched="2024-04-16")  # months 2021-01 .. 2024-03
    assert view["months"][0] == "2021-01" and view["months"][-1] == "2024-03"
    assert view["regions"] == ["Varsinais-Suomi", NATIONAL]
    assert [s["region"] for s in view["series"]] == [NATIONAL, "Varsinais-Suomi"]
    assert view["series"][0]["incidencePer100k"] is None
    assert {(g["region"], g["month"], g["cases"]) for g in view["signals"]} == {("Varsinais-Suomi", "2024-03", 15), (NATIONAL, "2024-03", 15)}


def test_view_marks_signals_that_survive_bonferroni():
    steady = [3, 4, 2, 3, 5, 3, 4, 3, 2, 4] * 4
    spike = steady[:38] + [15] + steady[39:]
    view = regional_view(series(spike).assign(incidence_per_100k=1.0), fetched="2024-04-16")
    assert view["settings"]["testedSeriesMonths"] == 3 * 2  # 2024-01..03, county and national
    assert all(g["strong"] == (g["p"] < 0.05 / 6) for g in view["signals"])
