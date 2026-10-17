"""aei.regional: the monthly regional test signals a clear spike and stays quiet on a steady series."""

from __future__ import annotations

import json
import runpy
import sys
from pathlib import Path

import pandas as pd
import pytest
from scipy import stats

from aei.forecasts import monthly_forecasts
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


def test_steady_forecast_uses_the_selected_24_month_level_and_90_percent_interval():
    thl = series([500] * 12 + [10] * 24 + [10000]).assign(region_sid=1, incidence_per_100k=1.0)
    forecast = next(f for f in monthly_forecasts(thl, fetched="2024-01-16") if f["phenotype"] == "MRSA")
    assert forecast == {
        "phenotype": "MRSA", "region": "Varsinais-Suomi", "month": "2024-01",
        "mean": 10.0, "low": int(stats.poisson.ppf(0.05, 10)),
        "high": int(stats.poisson.ppf(0.95, 10)), "level": 0.9,
    }
    assert forecast["low"] <= forecast["mean"] <= forecast["high"]


def test_forecast_pools_nonempty_county_dispersion_and_keeps_national_separate():
    a = series([2, 18] * 12).assign(region="A")  # chi2 = 153.6, mean = 10
    b = series([10] * 24).assign(region="B")
    empty = series([0] * 24).assign(region="Empty")
    national = series([100] * 24).assign(region=NATIONAL)
    rows = monthly_forecasts(pd.concat([a, b, empty, national]), fetched="2023-01-16", national_region=NATIONAL)
    forecasts = {r["region"]: r for r in rows if r["phenotype"] == "MRSA"}
    phi = 153.6 / (2 * 23)  # empty windows and the national total do not enter the pool
    predictive = stats.nbinom(10 / (phi - 1), 1 / phi)
    assert forecasts["B"]["low"] == predictive.ppf(0.05)
    assert forecasts["B"]["high"] == predictive.ppf(0.95)
    assert forecasts[NATIONAL]["high"] == stats.poisson.ppf(0.95, 100)
    assert forecasts["Empty"]["mean"] == 0.1
    assert forecasts["Empty"]["high"] == stats.poisson.ppf(0.95, 0.1)


def test_forecast_fills_missing_months_and_requires_24_calendar_months():
    thl = series([10] * 24)
    missing = thl[thl["month"] != "2021-06"]
    forecast = next(f for f in monthly_forecasts(missing, fetched="2023-01-16") if f["phenotype"] == "MRSA")
    assert forecast["mean"] == pytest.approx(230 / 24)
    assert monthly_forecasts(thl.iloc[:23], fetched="2023-01-16") == []
    assert monthly_forecasts(thl.iloc[:0], fetched="2023-01-16") == []


def test_view_writes_forecasts_from_only_the_history_it_shows():
    thl = series([10] * 36 + [10000]).assign(incidence_per_100k=1.0)
    view = regional_view(thl, fetched="2024-01-16")
    assert len(view["forecasts"]) == 6
    assert len(view["series"]) == 2
    assert all(f["month"] == "2024-01" and f["mean"] == 10 for f in view["forecasts"] if f["phenotype"] == "MRSA")
    assert "0020" in view["settings"]["forecastMethod"]
    assert "D-045" in view["settings"]["forecastMethod"]


def test_fetch_script_writes_forecasts_to_regional_json_without_a_network_fetch(tmp_path, monkeypatch):
    thl = series([10] * 24).assign(region_sid=1, incidence_per_100k=1.0)
    script = Path(__file__).resolve().parents[4] / "scripts" / "fetch_thl_ttr.py"
    main = runpy.run_path(str(script))["main"]
    monkeypatch.setitem(main.__globals__, "fetch_ttr_monthly", lambda: thl)
    monkeypatch.setattr(sys, "argv", [str(script), "--out", str(tmp_path)])
    main()
    view = json.loads((tmp_path / "regional.json").read_text())
    assert len(view["forecasts"]) == 6
    assert all(f["mean"] == 10 and f["month"] == "2023-01" for f in view["forecasts"] if f["phenotype"] == "MRSA")
    assert "0020" in view["settings"]["forecastMethod"]


def test_forecasts_sum_report_groups_before_fitting_and_omit_vre():
    # Anti-correlated report groups have constant phenotype totals: summing
    # separately fitted report-group intervals would incorrectly widen this band.
    a = series([0, 20] * 12)
    b = series([20, 0] * 12).assign(group="MRSA blood/CSF", group_sid=2)
    vre = series([100] * 24).assign(group="VRE carriage", group_sid=3)
    thl = pd.concat([a, b, vre]).assign(incidence_per_100k=1.0)
    view = regional_view(thl, fetched="2023-01-16")
    assert {f["phenotype"] for f in view["forecasts"]} == {"MRSA", "ESBL", "CPE"}
    mrsa = [f for f in view["forecasts"] if f["phenotype"] == "MRSA"]
    assert {f["region"] for f in mrsa} == {"Varsinais-Suomi", NATIONAL}
    for f in mrsa:
        assert "group" not in f
        assert f["mean"] == 20
        assert (f["low"], f["high"]) == tuple(stats.poisson.ppf([0.05, 0.95], 20))
    assert "phenotype total" in view["settings"]["forecastMethod"]
    assert "VRE omitted" in view["settings"]["forecastMethod"]
