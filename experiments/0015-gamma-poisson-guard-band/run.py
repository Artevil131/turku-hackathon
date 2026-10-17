"""Experiment 0015: the Gamma-Poisson surprise test with a guard band and BH control (ENGINE.md 3.3) on D1 to D7 and I1. Plan:
README.md.

    uv run python experiments/0015-gamma-poisson-guard-band/run.py

Stage 1 picks a setting on the tuning year only (`aei.score_detection.tune_curve`: 40 rare and 40 common ESBL clusters of 4
injected 2024-04-01 to 2024-08-15, noise over 2024-04-01 to 2024-09-30). Stage 2 scores that setting, without and with the
weekly alert budget, through `aei.score_detection.score_detector` (seed 2026, 200 trials per cell), and every setting of the
grid on the scoring period (exploratory). Stage 3 runs the checks (BH and p against independent computations, event counts
against a brute-force loop, the trial fast path against the from-scratch computation, `check_causal` on three cut dates).
Stage 4 writes out/results.md, out/metrics.json (the chosen setting, no budget), out/metrics-budget.json, out/grid.json and
the figures. The test itself is in gamma_poisson.py; the card and the curves are drawn in figure.py.
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import numpy as np
from scipy import special
from statsmodels.stats.multitest import multipletests

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import control  # noqa: E402
import figure  # noqa: E402
import gamma_poisson as gp  # noqa: E402

from aei import harness  # noqa: E402
from aei import score_detection as sd  # noqa: E402
from aei.dates import add_days, days_between  # noqa: E402
from aei.inject import FAMILIES, LARGE_UNITS, seed_trials  # noqa: E402

OUT = HERE / "out"
BASELINES = harness.ROOT / "benchmarks" / "overnight-2026-10-17" / "baselines"
EXPERIMENT = "0015-gamma-poisson-guard-band"
TUNABLE = [(s, g, l) for s in (13, 26) for g in (0, 4) for l in (1, 4)]  # S, g, L in weeks
EXPLORATORY = [(52, 0, 4), (52, 4, 4)]  # need 56 weeks of history: not tunable on year 1
ABLATION = [(26, 0, 1), (26, 0, 4), (26, 4, 1), (26, 4, 4)]  # settings of the phenotype-series-only ablation (not in the plan)
NOISE_LIMIT = sd.HEADLINE_NOISE  # episodes a year
TUNED_ON = "2024-04-01..2024-09-30"
CAUSAL_CUTS = ["2024-12-11", "2025-06-18", "2026-03-11"]  # three Wednesdays, so the budget's weekly ranking is cut mid-week
KS = sd.KS
BLOCK = 40  # trials per block of the descriptive spread


def label(st: tuple[int, int, int]) -> str:
    return f"S {st[0]} g {st[1]} L {st[2]}"


def make(engine: gp.Engine | None, st: tuple[int, int, int], *, budget: bool = False, level: float | None = None, organism_series: bool = True) -> gp.GammaPoisson:
    s, g, l = st
    return gp.GammaPoisson(
        name=f"Gamma-Poisson surprise, S {s} wk, guard {g} wk, window {l} wk" + (", budget 3 per week" if budget else "") + ("" if organism_series else ", phenotype series only"),
        S=s, g=g, L=l, budget=budget, engine=engine, default_level=level, organism_series=organism_series,
    )


# --- stage 1: the tuning year ----------------------------------------------------------------------------------------------


def operating_row(rows: list[dict]) -> dict | None:
    """The loosest level whose tuning-year noise (scaled to a year) is at most 5 episodes a year."""
    return next((r for r in rows if r["noise_per_year"] <= NOISE_LIMIT), None)


def choose(tune: dict) -> tuple[tuple[int, int, int], dict, list[tuple]]:
    """The plan's rule: per setting its operating row; the highest rare-family rate, ties by the common ESBL rate, then by
    fewer episodes, then by the shorter S (then g, then L, so the choice is deterministic). Returns the setting, its row and
    the ranked list of (setting, row)."""
    ranked = []
    for st, rows in tune.items():
        r = operating_row(rows)
        if r is not None:
            ranked.append((st, r))
    ranked.sort(key=lambda x: (-x[1]["rare_hit"], -x[1]["common_esbl_hit"], x[1]["noise_count"], x[0][0], x[0][1], x[0][2]))
    return ranked[0][0], ranked[0][1], ranked


# --- stage 3: checks ------------------------------------------------------------------------------------------------------


def brute_force_counts(records, series: gp.Series, lo: str, hi: str) -> int:
    """Events of one series dated lo..hi by the definition, in plain Python: a patient's isolate of the series in the unit
    that has no earlier isolate of the same patient in the series in the 365 days before, one per patient and day."""
    by: dict[str, list[str]] = {}
    for r in records:
        if series.key in gp.memberships(r):
            by.setdefault(r.patient_id, []).append(r.sample_date)
    count = 0
    for dates in by.values():
        dates.sort()
        for i, d in enumerate(dates):
            first = i == 0 or (dates[i - 1] != d and days_between(dates[i - 1], d) > gp.DEDUP_DAYS)
            if first and lo <= d <= hi:
                count += 1
    return count


def check_numerics(engine: gp.Engine, records, st: tuple[int, int, int]) -> dict:
    """BH against statsmodels on every day, p against a direct sum of the negative binomial pmf, y and C against the brute
    force loop, for the setting `st`."""
    w = engine.world
    S, g, L = st
    days = np.arange(gp.first_valid_day(S, g, L), w.n_days)
    T = gp.run_tests(w, w.cum, days, S, g, L)
    worst_q = 0.0
    for j in range(len(days)):
        t = T.tested[:, j]
        if t.any():
            worst_q = max(worst_q, float(np.abs(multipletests(T.p[t, j], method="fdr_bh")[1] - T.q[t, j]).max()))
    rng = np.random.default_rng(1)
    cells = np.argwhere(T.tested)
    beta = S * (1 + gp.K)
    pn = beta / (beta + L)
    worst_p = 0.0
    sel = cells[rng.choice(len(cells), 60, replace=False)]
    for si, dj in sel:
        a, y = float(T.alpha[si, dj]), int(T.y[si, dj])
        pmf = [math.exp(special.gammaln(a + j) - special.gammaln(a) - special.gammaln(j + 1) + a * math.log(pn) + j * math.log1p(-pn)) for j in range(y)]
        direct = max(1.0 - sum(pmf), gp.P_FLOOR)
        worst_p = max(worst_p, abs(direct - float(T.p[si, dj])) / max(float(T.p[si, dj]), 1e-9))
    mism = 0
    for si, dj in sel[:12]:
        d = int(days[dj])
        s = w.series[si]
        w_lo = add_days(w.dates[d], -(7 * L - 1))
        b_hi = add_days(w_lo, -(7 * g) - 1)
        b_lo = add_days(b_hi, -(7 * S - 1))
        y_brute = brute_force_counts(records, s, w_lo, w.dates[d])
        c_brute = brute_force_counts(records, s, b_lo, b_hi)
        c_engine = int(w.cum.E[si, w.day_of[b_hi] + 1] - w.cum.E[si, w.day_of[b_lo]])
        mism += int(y_brute != int(T.y[si, dj])) + int(c_brute != c_engine)
    return {
        "setting": label(st),
        "bh_vs_statsmodels_max_abs_diff": worst_q,
        "p_vs_direct_pmf_max_rel_diff": worst_p,
        "brute_force_cells": 12,
        "brute_force_mismatches": mism,
        "tested_cells": int(T.tested.sum()),
        "tested_per_day_mean": float(T.m.mean()),
        "tested_per_day_min": int(T.m.min()),
        "tested_per_day_max": int(T.m.max()),
        "alpha_zero_cells": int((T.tested & (T.alpha == 0)).sum()),
    }


def check_fast_path(engine: gp.Engine, records, cultures, st: tuple[int, int, int], trials: int = 6, organism_series: bool = True) -> dict:
    """The engine's trial fast path against the from-scratch computation on the same trials (seed 2026, `trials` per cell,
    all families and gap settings): same signals, same q, same budget masks."""
    fast = make(engine, st, budget=True, organism_series=organism_series)
    ref = make(None, st, budget=True, organism_series=organism_series)
    hf = seed_trials(fast, records, cultures, 2026, trials=trials)
    hr = seed_trials(ref, records, cultures, 2026, trials=trials)

    def key(s):
        return (s.date, s.key, s.ward, s.observed, s.profile)

    n = signals = bad = 0
    worst = 0.0
    for fam in hf:
        for cell in hf[fam]:
            for a, b in zip(hf[fam][cell], hr[fam][cell], strict=True):
                n += 1
                A, B = sorted(a.signals, key=key), sorted(b.signals, key=key)
                signals += len(A)
                if [key(s) for s in A] != [key(s) for s in B]:
                    bad += 1
                    continue
                for x, y in zip(A, B, strict=True):
                    worst = max(worst, abs(x.p - y.p) / y.p, abs(x.expected - y.expected) / max(y.expected, 1e-12))
    return {"setting": label(st) + ("" if organism_series else ", phenotype series only"), "trials": n, "signals": signals, "trials_that_differ": bad, "max_rel_diff": worst}


def block_counts(det: gp.GammaPoisson, level: float, records, cultures) -> tuple[dict[str, list[int]], dict]:
    """Detections per consecutive block of 40 trials of each cell of the seed-2026 stream (descriptive spread, not
    independent runs), and, for the rare and common ESBL cells at k 3, 4 and 6, where the detections come from: which
    kind of series signalled, the large units (ED, PHC-N, PHC-S) against the others, the source's phenotype."""
    hits = seed_trials(det, records, cultures, 2026, families=FAMILIES, ks=KS, trials=200, gaps=())
    accept = sd.accept_fn(det, level)
    blocks = {
        f"{f}_k{k}": [sum(1 for t in hits[f][k][i * BLOCK : (i + 1) * BLOCK] if t.detected(accept)) for i in range(200 // BLOCK)]
        for f in FAMILIES
        for k in KS
    }
    diag: dict = {}
    for f in ("rare", "common_esbl"):
        for k in (3, 4, 6):
            ts = hits[f][k]
            found = [t for t in ts if t.detected(accept)]
            large = [t for t in ts if any(u in LARGE_UNITS for u in t.units)]
            d = {
                "trials": len(ts),
                "detected": len(found),
                "via_phenotype_series": sum(1 for t in found if any(accept(s) and s.phenotype for s in t.signals)),
                "via_organism_series": sum(1 for t in found if any(accept(s) and s.organism for s in t.signals)),
                "large_units": [sum(1 for t in large if t.detected(accept)), len(large)],
                "other_units": [sum(1 for t in ts if t not in large and t.detected(accept)), len(ts) - len(large)],
            }
            if f == "rare":
                for ph in ("esbl", "mrsa"):
                    src = [t for t in ts if ph in t.phenotypes]
                    d[f"source_{ph}"] = [sum(1 for t in src if t.detected(accept)), len(src)]
            diag[f"{f}_k{k}"] = d
    return blocks, diag


# --- the run ---------------------------------------------------------------------------------------------------------------


def compute() -> dict:
    clock = harness.Clock()
    records, cultures = harness.data()
    engine = gp.Engine(records)
    R: dict = {"parts_cpu": {}}

    def mark(name: str) -> None:
        R["parts_cpu"][name] = clock.cpu - sum(R["parts_cpu"].values())

    # Stage 1
    tune = {st: sd.tune_curve(make(engine, st), records, cultures) for st in TUNABLE}
    chosen, row, ranked = choose(tune)
    level = row["level"]
    R.update(tune=tune, chosen=chosen, chosen_row=row, ranked=ranked, level=level)
    mark("tuning year")

    # Stage 2: the chosen setting, without and with the budget
    det = make(engine, chosen, level=level)
    det_b = make(engine, chosen, budget=True, level=level)
    R["score"] = sd.score_detector(det, records=records, cultures=cultures, verbose=False)
    mark("chosen, no budget")
    R["score_budget"] = sd.score_detector(det_b, records=records, cultures=cultures, verbose=False)
    mark("chosen, budget")
    R["blocks"], R["diagnostics"] = block_counts(det, level, records, cultures)
    R["blocks_budget"], _ = block_counts(det_b, level, records, cultures)
    mark("blocks of 40")
    full = engine.full(records, *chosen)
    R["signals_at_level"] = {
        "no_budget": sum(1 for s in full if det.passes(s, level)),
        "budget": sum(1 for s in full if det_b.passes(s, level)),
        "emitted": len(full),
    }
    R["full_signals"] = full  # for the figures; not written
    # where the noise episodes of the chosen setting at the year-1 level come from (the episodes of D4)
    a, b = harness.SCORE
    sigs = [x for x in full if det.passes(x, level)]
    keep = [grp for grp in sd.group_signals(sigs, lambda x: sd.fixed_key(x, "cluster")) if a <= grp[0].date <= b and not any(sd.zone_of(x, "cluster") for x in grp)]
    assert len(keep) == R["score"][2]["D4"]["episodes_per_year"], "episode list differs from D4's count"
    R["noise_episodes"] = [{"date": grp[0].date, "series": grp[0].key, "y": grp[0].observed, "expected": grp[0].expected, "q": grp[0].p, "signals": len(grp)} for grp in keep]

    # Grid on the scoring period (exploratory); each row read at its D5 headline level
    grid = {}
    for st in TUNABLE + EXPLORATORY:
        grid[st] = sd.score_detector(make(engine, st), records=records, cultures=cultures, verbose=False)
    R["grid"] = grid
    mark("grid")

    # Controls (not in the plan): the live phenotype-excess test alone on the same phenotype series, and this test on the
    # phenotype series only (D2, D4 and D5 for the two key families)
    ctrl = control.PhenotypeExcessOnly(default_level=1.0)
    R["control"] = sd.score_detector(ctrl, families=("rare", "common_esbl"), parts=("D2", "D4", "D5"), records=records, cultures=cultures, verbose=False)
    engine_ph = gp.Engine(records, organism_series=False)
    R["ablation"] = {
        st: sd.score_detector(make(engine_ph, st, organism_series=False), families=("rare", "common_esbl"), parts=("D2", "D4", "D5"), records=records, cultures=cultures, verbose=False)
        for st in ABLATION
    }
    mark("controls")

    # Stage 3
    tested = {}
    for name, eng in (("both families", engine), ("phenotype series only", engine_ph)):
        T = gp.run_tests(eng.world, eng.world.cum, np.arange(gp.first_valid_day(*chosen), eng.world.n_days), *chosen)
        tested[name] = float(T.m.mean())
    R["tested_per_day"] = tested
    R["check_numerics"] = [check_numerics(engine, records, st) for st in (chosen, (26, 4, 4))]
    R["check_fast_path"] = [check_fast_path(engine, records, cultures, st) for st in (chosen, (26, 4, 4))]
    R["check_fast_path"].append(check_fast_path(engine_ph, records, cultures, chosen, organism_series=False))
    w = engine.world
    R["alpha_zero_cells"] = {}
    for st in TUNABLE + EXPLORATORY:
        T = gp.run_tests(w, w.cum, np.arange(gp.first_valid_day(*st), w.n_days), *st)
        R["alpha_zero_cells"][label(st)] = [int((T.tested & (T.alpha == 0)).sum()), int(T.tested.sum())]
    mark("numeric and fast-path checks")
    causal = {}
    for st in TUNABLE + EXPLORATORY:
        for b in (False, True):
            problems = sd.check_causal(make(engine, st, budget=b), CAUSAL_CUTS, records, cultures, raise_on_error=False)
            causal[f"{label(st)}{', budget' if b else ''}"] = problems
    for st in ABLATION:
        problems = sd.check_causal(make(engine_ph, st, organism_series=False), CAUSAL_CUTS, records, cultures, raise_on_error=False)
        causal[f"{label(st)}, phenotype series only"] = problems
    R["causal"] = causal
    mark("causality")
    assert not any(causal.values()), f"not causal: {[k for k, v in causal.items() if v]}"
    R["engine_paths"] = {"fast": engine.fast + engine_ph.fast, "fallback": engine.fallback + engine_ph.fallback}
    R["cpu_s"], R["wall_s"] = clock.cpu, clock.wall
    return R


# --- stage 4: the outputs --------------------------------------------------------------------------------------------------


def clean(x):
    """JSON-safe, floats to 6 significant digits (as `aei.harness.write_metrics`), so reruns compare equal."""
    if isinstance(x, dict):
        return {str(k): clean(v) for k, v in x.items()}
    if isinstance(x, (list, tuple)):
        return [clean(v) for v in x]
    if hasattr(x, "item") and not isinstance(x, (str, bytes)):
        x = x.item()
    if isinstance(x, float):
        return None if not math.isfinite(x) else float(f"{x:.6g}")
    return x


def pct(x, d: int = 1) -> str:
    return "n/a" if x is None else f"{100 * x:.{d}f} %"


def pci(rate, iv, d: int = 1) -> str:
    return "n/a" if rate is None else (f"{pct(rate, d)} ({100 * iv[0]:.{d}f} to {100 * iv[1]:.{d}f})" if iv else pct(rate, d))


def num(x, d: int = 2) -> str:
    return "n/a" if x is None else f"{x:.{d}f}"


def rate_ci(rate, iv, d: int = 2) -> str:
    return "n/a" if rate is None else (f"{rate:.{d}f} ({iv[0]:.{d}f} to {iv[1]:.{d}f})" if iv else f"{rate:.{d}f}")


def day(x) -> str:
    return "not found" if x is None else str(x)


def md_table(header: list[str], rows: list[list[str]]) -> str:
    out = ["| " + " | ".join(header) + " |", "|" + "---|" * len(header)]
    out += ["| " + " | ".join(r) + " |" for r in rows]
    return "\n".join(out) + "\n"


def get(d, *path):
    for p in path:
        if d is None or p not in d:
            return None
        d = d[p]
    return d


def load_baselines() -> dict:
    return {
        "retuned": json.loads((BASELINES / "live-set-retuned-year1.json").read_text()),
        "shipped": json.loads((BASELINES / "live-set-shipped.json").read_text()),
    }


NAMES = {"rare": "rare clone", "common_resistant": "common resistant", "wild_type": "wild type", "common_esbl": "common ESBL E. coli", "two_unit": "two units"}


def comparison_table(cols: list[tuple[str, dict, dict, dict]]) -> str:
    """D1 to D7 and I1, one column per row: (title, metrics, intervals, n)."""
    rows: list[list[str]] = []

    def add(name: str, fn) -> None:
        rows.append([name] + [fn(m, iv, n) for _, m, iv, n in cols])

    for k in ("E1", "E1_corrected", "E2", "E2_corrected", "E3"):
        add(f"D1 {k}, days", lambda m, iv, n, k=k: day(get(m, "D1", k)))
    add("D1 E4, first trend signal", lambda m, iv, n: day(get(m, "D1", "E4")))
    for k in ("gap2", "gap3", "gap5", "gap7", "half7"):
        add(f"D3 {k}", lambda m, iv, n, k=k: pci(get(m, "D3", k), get(iv, "D3", k)))
    add("D4 episodes a year, all", lambda m, iv, n: f"{num(get(m, 'D4', 'episodes_per_year'))} ({get(n, 'D4', 'episodes_per_year')} ep.; {num(get(iv, 'D4', 'episodes_per_year')[0])} to {num(get(iv, 'D4', 'episodes_per_year')[1])})")
    for k in ("cluster", "sentinel", "data", "trend", "divergence"):
        add(f"D4 {k}", lambda m, iv, n, k=k: f"{num(get(m, 'D4', k))} ({get(n, 'D4', k)} ep.; {num(get(iv, 'D4', k)[0])} to {num(get(iv, 'D4', k)[1])})")
    add("D4 alerts a week", lambda m, iv, n: f"{num(get(m, 'D4', 'alerts_per_week'), 3)} ({get(n, 'D4', 'alerts_per_week')} alerts)")
    add("D5 level", lambda m, iv, n: f"{get(m, 'D5', 'level'):g}")
    add("D5 noise at headline, episodes a year", lambda m, iv, n: f"{num(get(m, 'D5', 'noise'))} ({get(n, 'D5', 'noise')} ep.)")
    add("D5 rare, k = 4", lambda m, iv, n: pci(get(m, "D5", "rare"), get(iv, "D5", "rare")))
    add("D5 rare delay, days", lambda m, iv, n: day(get(m, "D5", "rare_delay")))
    add("D5 common ESBL, k = 4", lambda m, iv, n: pci(get(m, "D5", "common_esbl"), get(iv, "D5", "common_esbl")))
    add("D5 common ESBL delay, days", lambda m, iv, n: day(get(m, "D5", "common_esbl_delay")))
    add("D6, injected gaps with a non-data signal", lambda m, iv, n: pci(get(m, "D6"), get(iv, "D6"), 2) + f", n {get(n, 'D6')}")
    add("D7, named right", lambda m, iv, n: pci(get(m, "D7"), get(iv, "D7"), 1) + f", n {get(n, 'D7')}")
    add("I1 alerts, incidents, per incident", lambda m, iv, n: f"{get(m, 'I1', 'alerts')}, {get(m, 'I1', 'incidents')}, {num(get(m, 'I1', 'alerts_per_incident'))}")
    return md_table(["metric"] + [c[0] for c in cols], rows)


def d2_table(chosen: tuple, budget: tuple, blocks: dict, bl: dict) -> str:
    (m, iv, n, ex), (mb, ivb, nb, exb) = chosen, budget
    rows = []
    for f in FAMILIES:
        for k in KS:
            key = f"{f}_k{k}"
            rows.append([
                NAMES[f], "control" if k == 0 else str(k), pci(m["D2"][key], iv["D2"][key]), day(m["D2_delay"][key]),
                " / ".join(str(b) for b in blocks[key]), pci(mb["D2"][key], ivb["D2"][key]), day(mb["D2_delay"][key]),
                pct(bl["retuned"]["metrics"]["D2"][key]), pct(bl["shipped"]["metrics"]["D2"][key]),
            ])
    return md_table(["family", "k", "chosen, no budget", "delay d", "blocks of 40", "chosen, budget", "delay d", "live re-tuned", "live shipped"], rows)


def curve_table(curve: list[dict]) -> str:
    rows = []
    for r in curve:
        rows.append([
            f"{r['level']:g}", f"{r['noise']:.2f} ({r['noise_count']})", f"{r['whole_tool']:.2f}",
            f"{r['rare_hit']}/{r['rare_n']} ({100 * r['rare']:.1f} %), {day(r['rare_delay'])} d",
            f"{r['common_esbl_hit']}/{r['common_esbl_n']} ({100 * r['common_esbl']:.1f} %), {day(r['common_esbl_delay'])} d",
            f"{r['two_unit_hit']}/{r['two_unit_n']} ({100 * r['two_unit']:.1f} %)",
            f"{100 * r['common_resistant']:.1f} % / {100 * r['wild_type']:.1f} %",
        ])
    return md_table(["level", "noise, episodes a year (count)", "whole tool", "rare k 4, delay", "common ESBL k 4, delay", "two-unit k 4", "common resistant / wild type k 4"], rows)


def curve_table_two(curve: list[dict]) -> str:
    rows = []
    for r in curve:
        rows.append([f"{r['level']:g}", f"{r['noise']:.2f} ({r['noise_count']})", f"{r['rare_hit']}/{r['rare_n']} ({100 * r['rare']:.1f} %), {day(r['rare_delay'])} d", f"{r['common_esbl_hit']}/{r['common_esbl_n']} ({100 * r['common_esbl']:.1f} %), {day(r['common_esbl_delay'])} d"])
    return md_table(["level", "noise, episodes a year (count)", "rare k 4, delay", "common ESBL k 4, delay"], rows)


def render(R: dict, bl: dict) -> dict:
    """Write the outputs; returns the numbers the figure script and the README quote."""
    OUT.mkdir(exist_ok=True)
    chosen, level = R["chosen"], R["level"]
    m, iv, n, ex = R["score"]
    mb, ivb, nb, exb = R["score_budget"]
    wall, cpu = R["wall_s"], R["cpu_s"]
    notes_chosen = (
        f"Gamma-Poisson surprise (negative binomial predictive), baseline {chosen[0]} weeks, guard band {chosen[1]} weeks, window {chosen[2]} weeks, "
        f"k 0.1, minimum count 2, Benjamini-Hochberg q-values over the series tested each day (unit x phenotype and unit x organism x specimen), "
        f"read at q < {level:g} (the loosest level whose year-1 noise was at most 5 episodes a year); D5 is read at its own headline level as the harness defines it. "
        f"Setting and level chosen on 2024-04-01..2024-09-30 only. Runtime fields are those of the whole run."
    )
    drop = {"cpu_by_part"}
    extra = {k: v for k, v in ex.items() if k not in drop}
    extra_b = {k: v for k, v in exb.items() if k not in drop}
    extra.update(setting={"S": chosen[0], "g": chosen[1], "L": chosen[2]}, operating_level=level, tuning_year=R["tune"][chosen], D2_blocks_of_40=R["blocks"], D2_diagnostics=R["diagnostics"], budget=False,
                 control_live_phenotype_excess={"D5": R["control"][0]["D5"], "D4": R["control"][0]["D4"], "D5_curve": R["control"][3]["D5_curve"]},
                 control_phenotype_series_only={label(st): {"D5": a[0]["D5"], "D5_curve": a[3]["D5_curve"]} for st, a in R["ablation"].items()})
    extra_b.update(setting={"S": chosen[0], "g": chosen[1], "L": chosen[2]}, operating_level=level, tuning_year=R["tune"][chosen], D2_blocks_of_40=R["blocks_budget"], budget=True)
    harness.write_metrics(OUT / "metrics.json", experiment=EXPERIMENT, method=notes_chosen.split(" Setting")[0], family="detection", metrics=m, intervals=iv, n=n,
                          runtime_s=wall, cpu_s=cpu, seeds=[2026], tuned_on_test=False, tuned_on=TUNED_ON, notes=notes_chosen, **extra)
    harness.write_metrics(OUT / "metrics-budget.json", experiment=EXPERIMENT + "-budget", method="The same setting with the weekly alert budget: 3 series per ISO week, hospital-wide, ranked by the running maximum score, causal",
                          family="detection", metrics=mb, intervals=ivb, n=nb, runtime_s=wall, cpu_s=cpu, seeds=[2026], tuned_on_test=False, tuned_on=TUNED_ON,
                          notes=notes_chosen + " With the budget: among the signals passing q < level, a signal of day t is kept when its series is among the 3 with the highest running maximum of -log10 p over the ISO week up to t.", **extra_b)
    grid_doc = {
        "exploratory": True,
        "note": "Every row scored on the scoring period (2024-10-01 to 2026-09-27) and read at its own D5 headline level, which comes from the scoring period's noise: a row picked from this table is picked on the scoring period and must carry tuned-on-test. The chosen setting of metrics.json was chosen on the tuning year only.",
        "settings": {},
    }
    for st, (gm, giv, gn, gex) in R["grid"].items():
        tunable = st in R["tune"]
        grid_doc["settings"][label(st)] = {
            "S": st[0], "g": st[1], "L": st[2], "tunable_on_year_1": tunable,
            "year_1": R["tune"].get(st), "year_1_operating_level": (operating_row(R["tune"][st]) or {}).get("level") if tunable else None,
            "metrics": gm, "intervals": giv, "n": gn, **{k: v for k, v in gex.items() if k not in drop},
        }
    (OUT / "grid.json").write_text(json.dumps(clean(grid_doc), indent=2, ensure_ascii=False) + "\n")

    # results.md
    L: list[str] = []
    w = L.append
    w("# 0015 Gamma-Poisson surprise with a guard band: results\n")
    w("All numbers computed by this run (`aei.score_detection`), seed 2026, 200 trials per injection cell, scoring period 2024-10-01 to 2026-09-27 (727 days, 1.99 years), unless tagged otherwise. Baseline rows are the committed ones of `benchmarks/overnight-2026-10-17/baselines/` (same harness).\n")
    w(f"Run time {cpu:.1f} s CPU.\n")
    w(f"Sweep time: {wall:.1f} s wall.\n")
    w("## Tuning year: one row per setting at its operating level\n")
    w("Injected on the tuning year (seed 2026, 40 rare and 40 common ESBL E. coli clusters of k = 4, starts 2024-04-01 to 2024-08-15, the detector sees nothing after 2024-09-30), noise over 2024-04-01 to 2024-09-30 scaled to a year (one episode is 2.0 a year). Operating level: the loosest level with noise at most 5 a year. Ranked by the plan's rule.\n")
    rows = []
    for i, (st, r) in enumerate(R["ranked"], 1):
        rows.append([str(i), label(st), f"{r['level']:g}", f"{r['noise_per_year']:.2f} ({r['noise_count']})", f"{r['rare_hit']}/40, {day(r['rare_delay'])} d", f"{r['common_esbl_hit']}/40, {day(r['common_esbl_delay'])} d"])
    for st in TUNABLE:
        if operating_row(R["tune"][st]) is None:
            rows.append(["-", label(st), "none", "all levels above 5 a year", "", ""])
    w(md_table(["rank", "setting", "level q <", "noise a year (episodes)", "rare k 4", "common ESBL k 4"], rows))
    w(f"Chosen: **{label(chosen)}** at q < {level:g}.\n")
    w("## Tuning year: every setting at every level\n")
    rows = []
    for st in TUNABLE:
        for r in R["tune"][st]:
            rows.append([label(st), f"{r['level']:g}", f"{r['noise_per_year']:.2f} ({r['noise_count']})", f"{r['rare_hit']}/40", day(r["rare_delay"]), f"{r['common_esbl_hit']}/40", day(r["common_esbl_delay"])])
    w(md_table(["setting", "level", "noise a year (episodes)", "rare k 4", "delay d", "common ESBL k 4", "delay d"], rows))
    w(f"## {label(chosen)} against the two live-set rows\n")
    w(f"Chosen at q < {level:g} (year-1 level) for D1 to D4, D6, D7, I1; D5 at its own headline level. Intervals: Wilson 95 % for rates, exact Poisson 95 % for D4 episodes a year. D3 is a data-signal metric: this test raises no data signals, so it is 0 by construction and is not a result. D4 and D5 count every signal of this test as a cluster signal.\n")
    w(comparison_table([(f"chosen {label(chosen)}", m, iv, n), ("chosen + budget", mb, ivb, nb), ("live re-tuned year 1", bl["retuned"]["metrics"], bl["retuned"]["intervals"], bl["retuned"]["n"]), ("live shipped (tuned on test)", bl["shipped"]["metrics"], bl["shipped"]["intervals"], bl["shipped"]["n"])]))
    w("The live rows' D1 to D3, D6 and D7 are read at their operating levels (re-tuned alphas, shipped alphas).\n")
    w("## The noise episodes of the chosen setting\n")
    ne = R["noise_episodes"]
    n_ph = sum(1 for e in ne if e["series"].count("|") == 1)
    n_sparse = sum(1 for e in ne if e["expected"] < 0.1)
    w(f"The {len(ne)} episodes of D4 at q < {level:g} over the scoring period (fixed key, planted and quarantined zones left out), by first signal: count in the window, predictive mean, q. {n_ph} are phenotype series and {len(ne) - n_ph} organism x specimen series; {n_sparse} have a predictive mean under 0.1. Tested series per day at the chosen setting: {R['tested_per_day']['both families']:.1f} with both families, {R['tested_per_day']['phenotype series only']:.1f} with the phenotype series only.\n")
    w(md_table(["first signal", "series", "count y", "predictive mean", "q", "signals"], [[e["date"], e["series"], f"{e['y']:g}", f"{e['expected']:.2f}", f"{e['q']:.1e}", str(e["signals"])] for e in R["noise_episodes"]]))
    w("## D2 and D2 delay, every family and k\n")
    w("Rate with 95 % Wilson interval, median delay in days from the first injected isolate. Blocks of 40: detections in the five consecutive blocks of 40 trials of the same stream (a descriptive spread, not independent runs).\n")
    w(d2_table(R["score"], R["score_budget"], R["blocks"], bl))
    w("## Where the detections of the chosen setting come from\n")
    w("Cells of the same stream, read at the chosen level. Large units: ED, PHC-N, PHC-S. A detection counts through a phenotype series when an accepted signal of the trial has a phenotype, through an organism series when it has an organism (both can be true).\n")
    rows = []
    for key, d in R["diagnostics"].items():
        f, k = key.rsplit("_k", 1)
        rows.append([NAMES[f], k, f"{d['detected']}/{d['trials']}", str(d["via_phenotype_series"]), str(d["via_organism_series"]), f"{d['large_units'][0]}/{d['large_units'][1]}", f"{d['other_units'][0]}/{d['other_units'][1]}",
                     f"{d['source_esbl'][0]}/{d['source_esbl'][1]}, {d['source_mrsa'][0]}/{d['source_mrsa'][1]}" if "source_esbl" in d else ""])
    w(md_table(["family", "k", "detected", "via phenotype series", "via organism series", "large units", "other units", "source ESBL, source MRSA"], rows))
    w("## D5 curve, chosen setting, no budget\n")
    w(curve_table(ex["D5_curve"]))
    w("## D5 curve, chosen setting, with the budget\n")
    w(curve_table(exb["D5_curve"]))
    w("## D5 curve, live set re-tuned on year 1 (committed row)\n")
    w(curve_table(bl["retuned"]["D5_curve"]))
    w("## D5 curve, live set as shipped (committed row)\n")
    w(curve_table(bl["shipped"]["D5_curve"]))
    w("## Control: the live phenotype-excess test alone (Poisson) on the same phenotype series\n")
    cm, civ, cn, cex = R["control"]
    w(f"Not part of the plan. The live phenotype-excess test (28-day window, 365-day baseline, at least 2 patients, shipped alpha 1e-3, level 1) scored through the same functions on the rare and common ESBL families only; its D4 counts only its own episodes. The level m multiplies alpha. D4 at the shipped alpha: {num(cm['D4']['episodes_per_year'])} episodes a year ({cn['D4']['episodes_per_year']}); D5 headline: level {cm['D5']['level']:g}, noise {num(cm['D5']['noise'])} a year, rare {pci(cm['D5']['rare'], civ['D5']['rare'])}, common ESBL {pci(cm['D5']['common_esbl'], civ['D5']['common_esbl'])}.\n")
    rows = []
    for r in cex["D5_curve"]:
        rows.append([f"{r['level']:g}", f"{r['noise']:.2f} ({r['noise_count']})", f"{r['rare_hit']}/{r['rare_n']} ({100 * r['rare']:.1f} %), {day(r['rare_delay'])} d", f"{r['common_esbl_hit']}/{r['common_esbl_n']} ({100 * r['common_esbl']:.1f} %), {day(r['common_esbl_delay'])} d"])
    w(md_table(["level m", "noise, episodes a year (count)", "rare k 4, delay", "common ESBL k 4, delay"], rows))
    w("## Control: this test on the 36 phenotype series only\n")
    w("Not part of the plan. The same test (BH over the phenotype series tested that day only) with the organism x specimen series left out, read at its D5 headline level on the scoring period; the live phenotype-excess test above is the Poisson counterpart on the same series.\n")
    rows = []
    for st in ABLATION:
        am, aiv, an, aex = R["ablation"][st]
        c = next(r for r in aex["D5_curve"] if r["level"] == am["D5"]["level"])
        full_row = R["grid"][st][0]["D5"]
        rows.append([label(st), f"{am['D5']['level']:g}", f"{am['D5']['noise']:.2f} ({c['noise_count']})", f"{c['rare_hit']}/{c['rare_n']} ({100 * c['rare']:.1f} %), {day(am['D5'].get('rare_delay'))} d",
                     f"{c['common_esbl_hit']}/{c['common_esbl_n']} ({100 * c['common_esbl']:.1f} %), {day(am['D5'].get('common_esbl_delay'))} d",
                     f"{full_row['noise']:.2f}: {pct(full_row['rare'])} / {pct(full_row['common_esbl'])}"])
    w(md_table(["setting", "D5 level", "D5 noise a year (episodes)", "rare k 4, delay", "common ESBL k 4, delay", "both families (grid row): noise, rare / common ESBL"], rows))
    am, aiv, an, aex = R["ablation"][chosen] if chosen in R["ablation"] else next(iter(R["ablation"].values()))
    w(f"D5 curve of the phenotype-series-only test at {label(chosen) if chosen in R['ablation'] else 'the first ablation setting'}:\n")
    w(curve_table_two(aex["D5_curve"]))
    w("## The budget run against the no-budget run\n")
    s = R["signals_at_level"]
    w(f"The two runs use the same signals; the budget only drops some. Over the whole data at the chosen setting: {s['emitted']} signals emitted at q < {gp.LEVELS[0]:g}, {s['no_budget']} pass q < {level:g}, {s['budget']} of those survive the budget ({s['no_budget'] - s['budget']} dropped). D4 episodes a year {num(get(m, 'D4', 'episodes_per_year'))} without and {num(get(mb, 'D4', 'episodes_per_year'))} with the budget; D2 rare k 4 {pct(m['D2']['rare_k4'])} and {pct(mb['D2']['rare_k4'])}.\n")
    w("## Grid on the scoring period (exploratory)\n")
    w("Every setting scored on the scoring period, read at its own D5 headline level (the loosest level with scoring-period noise at most 5 a year). Exploratory: a row picked here is picked on the scoring period. S 52 rows cannot be tuned on year 1 (they need 60 weeks of data).\n")
    rows = []
    for st in TUNABLE + EXPLORATORY:
        gm, giv, gn, gex = R["grid"][st]
        d5, c = gm["D5"], next(r for r in gex["D5_curve"] if r["level"] == gm["D5"]["level"])
        y1 = operating_row(R["tune"][st])["level"] if st in R["tune"] and operating_row(R["tune"][st]) else None
        rows.append([
            label(st) + (" (chosen)" if st == chosen else ""), "-" if y1 is None else f"{y1:g}", f"{d5['level']:g}", f"{d5['noise']:.2f} ({c['noise_count']})",
            f"{c['rare_hit']}/{c['rare_n']} ({100 * c['rare']:.1f} %), {day(d5.get('rare_delay'))} d", f"{c['common_esbl_hit']}/{c['common_esbl_n']} ({100 * c['common_esbl']:.1f} %), {day(d5.get('common_esbl_delay'))} d",
            f"{100 * c['two_unit']:.1f} %", f"{gm['I1']['alerts']} / {gm['I1']['incidents']}", f"{pct(gm['D7'])}", f"E1 {day(get(gm, 'D1', 'E1_corrected'))}, E2 {day(get(gm, 'D1', 'E2_corrected'))}",
        ])
    w(md_table(["setting", "year-1 level", "D5 level", "D5 noise a year (episodes)", "rare k 4, delay", "common ESBL k 4, delay", "two-unit k 4", "I1 alerts / incidents", "D7", "D1 corrected E1, E2"], rows))
    w("## Checks\n")
    w("Numerics (computed): BH against `statsmodels` `fdr_bh` on every day, p against a direct sum of the negative binomial pmf on 60 random tested cells, y and C against a plain-Python loop of the event definition on 12 cells.\n")
    w(md_table(["setting", "max abs diff BH", "max rel diff p", "brute-force mismatches (12 cells)", "tested series a day, mean (min to max)", "tested cells with alpha 0"], [[c["setting"], f"{c['bh_vs_statsmodels_max_abs_diff']:.1e}", f"{c['p_vs_direct_pmf_max_rel_diff']:.1e}", str(c["brute_force_mismatches"]), f"{c['tested_per_day_mean']:.1f} ({c['tested_per_day_min']} to {c['tested_per_day_max']})", str(c["alpha_zero_cells"])] for c in R["check_numerics"]]))
    w("Trial fast path against the from-scratch computation (computed; same trials, all families and gap settings, with the budget):\n")
    w(md_table(["setting", "trials", "signals", "trials that differ", "max relative diff of p and mean"], [[c["setting"], str(c["trials"]), str(c["signals"]), str(c["trials_that_differ"]), f"{c['max_rel_diff']:.1e}"] for c in R["check_fast_path"]]))
    w(f"Engine paths over the run: {R['engine_paths']['fast']} trials by the fast path, {R['engine_paths']['fallback']} by the from-scratch fallback.\n")
    w(f"`check_causal` on the cut dates {', '.join(CAUSAL_CUTS)} (three Wednesdays): no difference for any of the {len(R['causal'])} detectors (10 settings, each without and with the budget, and the {len(ABLATION)} phenotype-series-only settings).\n")
    zero = {k: v for k, v in R["alpha_zero_cells"].items() if v[0]}
    w(f"Tested cells whose predictive had shape alpha exactly 0 (the hospital and the unit had no event of the series in the baseline; the code reads it as p = 0, clipped to 1e-300): {sum(v[0] for v in R['alpha_zero_cells'].values())} of {sum(v[1] for v in R['alpha_zero_cells'].values())} over the ten settings; by setting: " + (", ".join(f"{k} {v[0]} of {v[1]}" for k, v in zero.items()) or "none") + ".\n")
    (OUT / "results.md").write_text("\n".join(L))
    return {"cpu": cpu, "wall": wall}


def main() -> None:
    R = compute()
    bl = load_baselines()
    render(R, bl)
    records, _ = harness.data()
    OUT.mkdir(exist_ok=True)
    R["card"] = figure.card(OUT / "figure.png", records, R["chosen"], R["level"], R["full_signals"])
    figure.curves(OUT / "d5-curves.png", R["score"][3]["D5_curve"], R["score_budget"][3]["D5_curve"], {"retuned": bl["retuned"]["D5_curve"], "shipped": bl["shipped"]["D5_curve"]})
    (OUT / "card.json").write_text(json.dumps(clean(R["card"]), indent=2) + "\n")


if __name__ == "__main__":
    main()
