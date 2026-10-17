"""Experiment 0016: Poisson and Bernoulli CUSUM with run-length-calibrated limits on D1 to D7 and I1. Plan: README.md.

    uv run python experiments/0016-cusum/run.py

Stage 1 chooses the Poisson and the Bernoulli setting on the tuning year only (`aei.score_detection.tune_curve`: 40 rare and
40 common ESBL clusters of 4 injected 2024-04-01 to 2024-08-15, noise over 2024-04-01 to 2024-09-30). Stage 2 calibrates the
operating level two ways on year 1 (Siegmund, simulation; calibrate.py). Stage 3 scores the union at that level through
`aei.score_detection.score_detector` (seed 2026, 200 trials per cell), each part alone and the common-limit ablation at 100
trials per cell. Stage 4 runs the checks (causality on three cut dates, the trial fast path against the from-scratch
computation, focused against full signals). Stage 5 writes out/results.md, out/metrics*.json, out/grid.json and the figure.
The statistic is in cusum.py, the calibrations in calibrate.py, the picture in figure.py.
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import calibrate as cal  # noqa: E402
import cusum as cs  # noqa: E402
import figure  # noqa: E402

from aei import harness  # noqa: E402
from aei import score_detection as sd  # noqa: E402
from aei.dates import add_days  # noqa: E402
from aei.inject import FAMILIES, Focus, base_of, seed_trials  # noqa: E402

OUT = HERE / "out"
BASELINES = harness.ROOT / "benchmarks" / "overnight-2026-10-17" / "baselines"
EXPERIMENT = "0016-cusum"
TUNED_ON = f"{harness.TUNE[0]}..{harness.TUNE[1]}"
NOISE_LIMIT = sd.HEADLINE_NOISE
KS = sd.KS
P_SETTINGS = [(th, u, g) for th in (2.5, 4.0, 8.0) for u in (1, 7) for g in (0, 4)]
B_SETTINGS = [(th, g) for th in (2.5, 4.0, 8.0) for g in (0, 4)]
N_PANELS = 200
PARTS_TRIALS = 100
CAUSAL_CUTS = ["2025-03-31", "2025-12-31", "2026-06-30"]
NOISE_WINDOW = ("2024-04-01", "2024-09-30")
UNION_PARTS = ("D1", "D2", "D4", "D5", "D6", "D7", "I1")
SMALL_PARTS = ("D2", "D4", "D5")


def log(msg: str) -> None:
    print(msg, file=sys.stderr, flush=True)


def lab_p(st) -> str:
    return f"theta {st[0]:g}, {'daily' if st[1] == 1 else 'weekly'}, guard {st[2]} wk"


def lab_b(st) -> str:
    return f"theta {st[0]:g}, guard {st[1]} wk"


# --- stage 1: the tuning year ----------------------------------------------------------------------------------------------


def operating_row(rows: list[dict]) -> dict | None:
    """The loosest level whose tuning-year noise (scaled to a year) is at most 5 episodes a year."""
    return next((r for r in rows if r["noise_per_year"] <= NOISE_LIMIT), None)


def choose(tune: dict, part: str):
    """The plan's rule: per setting its operating row; the highest rare rate, ties by the common ESBL rate, then fewer
    episodes, then smaller theta, daily before weekly, smaller guard band. Returns the setting, its row, the ranking."""
    ranked = []
    for (p, st), rows in tune.items():
        if p != part:
            continue
        r = operating_row(rows)
        if r is not None:
            ranked.append((st, r))
    ranked.sort(key=lambda x: (-x[1]["rare_hit"], -x[1]["common_esbl_hit"], x[1]["noise_count"], *x[0]))
    return ranked[0][0], ranked[0][1], ranked


def run_tuning(records, cultures) -> dict:
    tune = {}
    for st in P_SETTINGS:
        tune[("P", st)] = sd.tune_curve(cs.Cusum(pois=st, bern=None).detector(), records, cultures)
    for st in B_SETTINGS:
        tune[("B", st)] = sd.tune_curve(cs.Cusum(pois=None, bern=st).detector(), records, cultures)
    return tune


# --- stage 2: calibrating the operating level ------------------------------------------------------------------------------


def run_calibration(world: cs.World, pois, bern, union_det, records, cultures) -> dict:
    fit = cal.fit_year1(world)
    m, l_s = cal.equal_run_length(fit, pois, bern)
    h_s = cal.siegmund_common_h(fit, pois, bern)
    sim = cal.simulate(fit, pois, bern, N_PANELS)
    l_sim = cal.l_sim(sim)
    h_sim = cal.h_sim(sim)
    # the real year-1 episodes (fixed key, 2024-04-01 to 2024-09-30, scaled to a year) of the union at every run length
    full = union_det.run(records, cultures, None)
    real = {}
    for y in cs.LEVELS_YEARS:
        ec = sd.episode_counts(union_det, full, cs.level_of_years(y), ("cluster", "sentinel"), NOISE_WINDOW, zones=False)
        real[y] = {"per_year": ec["episodes_per_year"], "count": ec["count"]}
    real_curve = [real[y]["per_year"] for y in cs.LEVELS_YEARS]
    l_real = cal.crossing([math.log(y) for y in cs.LEVELS_YEARS], real_curve)
    out = {
        "m": m, "m_poisson": fit["m_p"], "m_bernoulli": fit["m_q"], "L_S": l_s, "h_S": h_s, "sim": sim, "L_sim": l_sim, "h_sim": h_sim,
        "real_year1": {str(y): v for y, v in real.items()}, "L_real": None if l_real is None else math.exp(l_real),
    }
    # Siegmund's prediction of the pooled episodes a year at each run length: m / L (equal run lengths)
    out["siegmund_episodes_per_year"] = [m / y for y in cs.LEVELS_YEARS]
    return out


def levels_with(calib_values: list[float], base: tuple[float, ...], from_years: bool) -> tuple[float, ...]:
    """The sweep levels plus the calibrated ones, loosest first (run length rising / limit rising)."""
    if from_years:
        ys = sorted(set(cs.LEVELS_YEARS) | {round(v, 6) for v in calib_values})
        return tuple(cs.level_of_years(y) for y in ys)
    hs = sorted(set(cs.H_GRID) | {round(v, 6) for v in calib_values})
    return tuple(math.exp(-h) for h in hs)


# --- stage 3: scoring --------------------------------------------------------------------------------------------------------


def score(det, records, cultures, *, parts, trials, level=None, gaps=None) -> tuple[dict, dict, dict, dict]:
    kw = {} if gaps is None else {"gap_settings": gaps}
    return sd.score_detector(det, parts=parts, trials_per_seed=trials, level=level, records=records, cultures=cultures, verbose=False, **kw)


def provenance(det, records, cultures, level: float) -> dict:
    """Where the D2 detections come from at the operating level: how many detected trials had their first matching signal on
    the start day or before (a run begun earlier counts at delay 0), and which part signalled."""
    hits = seed_trials(det, records, cultures, 2026, families=FAMILIES, ks=KS, trials=200, gaps=())
    accept = sd.accept_fn(det, level)
    out = {}
    for f in FAMILIES:
        for k in KS:
            ts = hits[f][k]
            found = [t for t in ts if t.detected(accept)]
            delay0 = [t for t in found if t.delay(accept) == 0]
            pois_only = bern_only = both = 0
            for t in found:
                dets = {s.detector for s in t.signals if accept(s)}
                if dets == {cs.NAME_P}:
                    pois_only += 1
                elif dets == {cs.NAME_B}:
                    bern_only += 1
                else:
                    both += 1
            out[f"{f}_k{k}"] = {"trials": len(ts), "detected": len(found), "delay0": len(delay0), "poisson_only": pois_only, "bernoulli_only": bern_only, "both": both}
    return out


# --- stage 4: checks ---------------------------------------------------------------------------------------------------------


def check_causal(pois, bern, levels, records, cultures) -> dict:
    det = cs.Cusum(pois=pois, bern=bern, rebuild=True).detector(levels)
    problems = sd.check_causal(det, CAUSAL_CUTS, records, cultures, raise_on_error=False)
    return {"cuts": CAUSAL_CUTS, "problems": problems}


def _key(s):
    return (s.date, s.key, s.ward)


def check_fast_path(pois, bern, records, cultures, trials: int = 6) -> dict:
    """The trial fast path (real-data world plus the change) against the from-scratch computation (a world built from the
    rows given), on `trials` trials of every cell of the seed-2026 stream and every gap setting."""
    fast = cs.Cusum(pois=pois, bern=bern).detector()
    ref = cs.Cusum(pois=pois, bern=bern, rebuild=True).detector()
    hf = seed_trials(fast, records, cultures, 2026, ks=(0, 4), trials=trials)
    hr = seed_trials(ref, records, cultures, 2026, ks=(0, 4), trials=trials)
    n = sigs = bad = 0
    worst = 0.0
    bad_cells: dict = {}
    for fam in hf:
        for cell in hf[fam]:
            for a, b in zip(hf[fam][cell], hr[fam][cell], strict=True):
                n += 1
                A, B = sorted(a.signals, key=_key), sorted(b.signals, key=_key)
                sigs += len(A)
                if [_key(s) for s in A] != [_key(s) for s in B]:
                    bad += 1
                    bad_cells[f"{fam}/{cell}"] = bad_cells.get(f"{fam}/{cell}", 0) + 1
                    continue
                for x, y in zip(A, B, strict=True):
                    worst = max(worst, abs(x.p - y.p) / y.p)
    return {"trials": n, "signals": sigs, "trials_that_differ": bad, "cells_that_differ": bad_cells, "max_rel_diff_p": worst}


def check_focus(pois, bern, records, cultures) -> dict:
    """Focused signals against the full run's on the real data, for three units and organisms (window of 28 days)."""
    det = cs.Cusum(pois=pois, bern=bern)
    full = det.run(records, cultures, None)
    cases = [("URO", "Escherichia coli", ("esbl",), "2025-06-01"), ("ICU", "Staphylococcus aureus", ("mrsa",), "2026-03-01"), ("ED", "Klebsiella pneumoniae", ("esbl",), "2025-01-15")]
    out = {"cases": 0, "mismatches": 0, "signals": 0}
    for unit, org, phen, start in cases:
        end = add_days(start, 28)
        recs = [r for r in records if r.sample_date <= end]
        got = det.run(recs, cultures, Focus((unit,), org, phen, None, start, end, None))
        want = [s for s in full if s.ward == unit and start <= s.date <= end and (s.organism == org or (s.phenotype is not None and s.phenotype in phen))]
        out["cases"] += 1
        out["signals"] += len(want)
        A, B = sorted(got, key=_key), sorted(want, key=_key)
        if [_key(s) for s in A] != [_key(s) for s in B] or any(abs(x.p - y.p) > 1e-9 * y.p for x, y in zip(A, B, strict=True)):
            out["mismatches"] += 1
    return out


def brute_poisson(records, unit, member, theta, u, g, n_days):
    """The Poisson statistic of one unit x series from the definition, in plain Python: events by a dict of each patient's
    last isolate of the series in the unit, baselines by summing the days, the recursion day by day."""
    day_of = cs.calendar()[2]
    units = sorted({r.ward for r in records})
    E = {v: [0] * n_days for v in units}
    V = {v: [0] * n_days for v in units}
    last: dict = {}
    for r in sorted(records, key=lambda r: r.sample_date):
        d = day_of[r.sample_date]
        V[r.ward][d] += 1
        if member(r):
            prev = last.get((r.patient_id, r.ward))
            last[(r.patient_id, r.ward)] = d
            if prev is None or d - prev > 365:
                E[r.ward][d] += 1
    HE = [sum(E[v][d] for v in units) for d in range(n_days)]
    HV = [sum(V[v][d] for v in units) for d in range(n_days)]
    S, out = 0.0, {}
    for t in cs.period_ends(n_days, u).tolist():
        be = t - 7 * g - u
        bs = max(be - 7 * cs.SB_WEEKS + 1, 0)
        if be < 0 or be - bs + 1 < 7 * cs.MIN_WEEKS:
            continue
        C, hy, hv, uv = sum(E[unit][bs : be + 1]), sum(HE[bs : be + 1]), sum(HV[bs : be + 1]), sum(V[unit][bs : be + 1])
        rb = hy / hv * uv if hv > 0 else 0.0
        wk = (be - bs + 1) / 7
        lam = max((C + cs.K * rb) / (wk * (1 + cs.K)), cs.LAM_FLOOR_WEEK) * u / 7
        y = sum(E[unit][t - u + 1 : t + 1])
        S = max(0.0, S + y * math.log(theta) - (theta - 1) * lam)
        out[t] = S
    return out


def brute_bernoulli(records, unit, member, resistant, theta, g, n_days):
    day_of = cs.calendar()[2]
    units = sorted({r.ward for r in records})
    N = {v: [0] * n_days for v in units}
    R = {v: [0] * n_days for v in units}
    last: dict = {}
    for r in sorted(records, key=lambda r: r.sample_date):
        if not member(r):
            continue
        d = day_of[r.sample_date]
        prev = last.get((r.patient_id, r.ward))
        last[(r.patient_id, r.ward)] = d
        if prev is None or d - prev > 365:
            N[r.ward][d] += 1
            R[r.ward][d] += int(resistant(r))
    HN = [sum(N[v][d] for v in units) for d in range(n_days)]
    HR = [sum(R[v][d] for v in units) for d in range(n_days)]
    S, out = 0.0, {}
    for t in range(n_days):
        be = t - 7 * g - 1
        bs = max(be - 7 * cs.SB_WEEKS + 1, 0)
        if be < 0 or be - bs + 1 < 7 * cs.MIN_WEEKS:
            continue
        nb, rb, hn, hr = sum(N[unit][bs : be + 1]), sum(R[unit][bs : be + 1]), sum(HN[bs : be + 1]), sum(HR[bs : be + 1])
        p_h = hr / hn if hn > 0 else 0.0
        p = min(max((rb + cs.M * p_h) / (nb + cs.M), cs.P_LO), cs.P_HI)
        S = max(0.0, S + R[unit][t] * math.log(theta) - N[unit][t] * math.log1p((theta - 1) * p))
        out[t] = S
    return out


def check_numerics(pois, bern, records) -> dict:
    """The vectorised statistic against the from-the-definition loops on three series of the chosen settings (all days)."""
    import numpy as np

    w = cs.real_world()
    uni = cs.universe()
    n_days = w.D
    theta, u, g = pois
    out = {"series": [], "max_abs_diff_S": 0.0}
    for unit, kind, val in (("URO", "ph", "esbl"), ("ED", "os", ("Escherichia coli", "urine")), ("ICU", "ph", "mrsa")):
        ui = uni.unit_index[unit]
        pi = uni.ph_index[val] if kind == "ph" else uni.os_index[val]
        st = cs.poisson_stat(w.cEV[ui, pi][None, :], w.cHEV[pi][None, :], w.cVOL[ui][None, :], w.cHVOL, theta, u, g, n_days)
        member = (lambda r, val=val: val in r.phenotypes) if kind == "ph" else (lambda r, val=val: (r.organism, r.specimen) == val)
        ref = brute_poisson(records, unit, member, theta, u, g, n_days)
        d = max(abs(float(st["S"][0, j]) - ref[int(t)]) for j, t in enumerate(st["t"]))
        out["series"].append(f"Poisson {unit}|{val}: {len(ref)} periods, max |dS| {d:.1e}")
        out["max_abs_diff_S"] = max(out["max_abs_diff_S"], d)
    theta_b, g_b = bern
    for unit, q in (("ED", 6), ("MED-A", 0)):
        qi = q
        pair = uni.pairs[qi]
        ui = uni.unit_index[unit]
        st = cs.bernoulli_stat(w.cBN[ui, qi][None, :], w.cBR[ui, qi][None, :], w.cHBN[qi][None, :], w.cHBR[qi][None, :], theta_b, g_b, n_days)
        member = lambda r, pair=pair: r.organism == pair.organism and (not pair.specimen or r.specimen == pair.specimen) and pair.antibiotic in r.results  # noqa: E731
        ref = brute_bernoulli(records, unit, member, lambda r, pair=pair: r.results[pair.antibiotic] == "R", theta_b, g_b, n_days)
        d = max(abs(float(st["S"][0, j]) - ref[int(t)]) for j, t in enumerate(st["t"]))
        out["series"].append(f"Bernoulli {unit}|{pair.key}: {len(ref)} days, max |dS| {d:.1e}")
        out["max_abs_diff_S"] = max(out["max_abs_diff_S"], d)
    return out


# --- stage 5: the record ------------------------------------------------------------------------------------------------------


def load_baseline(name: str) -> dict:
    return json.loads((BASELINES / f"{name}.json").read_text())


def f2(x) -> str:
    return "-" if x is None else f"{x:.2f}"


def fi(rate, iv) -> str:
    if rate is None:
        return "-"
    return f"{rate:.3f}" + ("" if not iv else f" [{iv[0]:.3f}, {iv[1]:.3f}]")


def row_md(cells: list[str]) -> str:
    return "| " + " | ".join(cells) + " |"


def table(header: list[str], rows: list[list[str]]) -> list[str]:
    return [row_md(header), row_md(["---"] * len(header))] + [row_md(r) for r in rows]


def d2_table(rows: dict[str, dict]) -> list[str]:
    """D2 rate with the 95 % Wilson interval and the median delay, per family and k, for each named row."""
    names = list(rows)
    out = []
    for f in FAMILIES:
        body = []
        for k in KS:
            key = f"{f}_k{k}"
            cells = [str(k)]
            for nm in names:
                m, iv = rows[nm]["metrics"], rows[nm]["intervals"]
                cells.append(f"{fi(m['D2'].get(key), iv['D2'].get(key))}, delay {m['D2_delay'].get(key) if m['D2_delay'].get(key) is not None else '-'}")
            body.append(cells)
        out += [f"**{f}**", ""] + table(["k"] + names, body) + [""]
    return out


def write_results(path: Path, ctx: dict) -> None:
    c = ctx["calib"]
    union, retuned, shipped = ctx["union"], ctx["retuned"], ctx["shipped"]
    um, ui, un = union["metrics"], union["intervals"], union["n"]
    L = []
    w = L.append
    w("# 0016 results")
    w("")
    w("Reproduce: `uv run python experiments/0016-cusum/run.py` (seed 2026 only; every number measured or computed by that run unless said otherwise).")
    w(f"Run time {ctx['wall']:.1f} s (wall).")
    w("")
    w(f"Run time {ctx['cpu']:.1f} s (CPU); budget 10 minutes of CPU, no cut made.")
    w("")
    w("## 1. Year-1 selection (tuning year only)")
    w("")
    w("`tune_curve`: 40 rare and 40 common ESBL clusters of k = 4 injected 2024-04-01 to 2024-08-15, noise over 2024-04-01 to 2024-09-30 scaled to a year. Each setting at its loosest per-series run length L (years) with noise at most 5 a year.")
    w("")
    for part, lab, settings in (("P", lab_p, P_SETTINGS), ("B", lab_b, B_SETTINGS)):
        w(f"**{'Poisson' if part == 'P' else 'Bernoulli'} part**")
        w("")
        rows = []
        _, _, ranked = choose(ctx["tune"], part)
        for rank, (st, r) in enumerate(ranked, 1):
            rows.append([str(rank), lab(st), f"{1 / (365.25 * r['level']):.3g}", f"{r['noise_per_year']:.1f} ({r['noise_count']})", f"{r['rare_hit']}/{r['rare_n']}", f"{r['common_esbl_hit']}/{r['common_esbl_n']}", str(r["rare_delay"]), str(r["common_esbl_delay"])])
        missing = [lab(st) for st in settings if operating_row(ctx["tune"][(part, st)]) is None]
        w("\n".join(table(["rank", "setting", "L (years)", "noise a year (episodes)", "rare k=4", "common ESBL k=4", "delay rare", "delay common"], rows)))
        if missing:
            w("")
            w(f"No level at or below 5 a year: {', '.join(missing)}.")
        w("")
    w(f"Chosen Poisson setting: {lab_p(ctx['pois'])}. Chosen Bernoulli setting: {lab_b(ctx['bern'])}. The two together are the union; the table and every year-1 row are in `out/grid.json`.")
    w("")
    w("## 2. Calibrating the operating level, on year 1")
    w("")
    w(f"Active series (at least one event or observation in year 1): {c['m_poisson']} Poisson + {c['m_bernoulli']} Bernoulli = m {c['m']}. Siegmund with equal run lengths: L_S = m / 5 = {c['L_S']:.1f} years. Simulation: {c['sim']['panels']} panels of 3 years from the year-1 model, episodes over the last 2.4 years ({c['sim']['scored_years']:.0f} panel-years); L_sim = {f2(c['L_sim'])} years (the operating level). Real year-1 noise (2024-04-01 to 2024-09-30, scaled to a year) crosses 5 a year at L = {f2(c['L_real'])} years.")
    w("")
    rows = []
    for i, y in enumerate(cs.LEVELS_YEARS):
        rr = c["real_year1"][str(y)]
        rows.append([f"{y:g}", f"{c['siegmund_episodes_per_year'][i]:.2f}", f"{c['sim']['episodes_per_year_equalised'][i]:.2f}", f"{rr['per_year']:.1f} ({rr['count']})"])
    w("\n".join(table(["L (years)", "Siegmund: m / L", "simulated episodes a year", "real year 1 episodes a year (count)"], rows)))
    w("")
    ratio = None if c["L_sim"] is None else c["L_sim"] / c["L_S"]
    w(f"L_sim / L_S = {f2(ratio)}. Episodes a year at L_S: Siegmund {5.0:.2f}, simulated {ctx['sim_at_LS']:.2f}, real year 1 {ctx['real_at_LS']:.1f}; at L_sim: simulated 5.00 by construction, real year 1 {ctx['real_at_Lsim']:.1f}, real scoring period {um['D4']['episodes_per_year']:.2f} (D4 below).")
    w("")
    w(f"Common limit (ablation): Siegmund h_S = {f2(c['h_S'])}, simulation h_sim = {f2(c['h_sim'])}.")
    w("")
    rows = [[f"{h:g}", f"{e:.2f}"] for h, e in zip(c["sim"]["h_grid"], c["sim"]["episodes_per_year_common"], strict=True)]
    w("\n".join(table(["common limit h", "simulated episodes a year"], rows)))
    w("")
    w("## 3. The union against the baseline rows")
    w("")
    w(f"Union: {ctx['union_name']}. Operating level L_sim = {f2(c['L_sim'])} years (p = {cs.level_of_years(c['L_sim']):.3g}); `tuned_on_test` false. Intervals: 95 % Wilson per cell; D4 exact Poisson. Baselines: `live-set-retuned-year1` (the reference, same year-1 procedure) and `live-set-shipped` (`tuned-on-test`).")
    w("")
    rows_all = {"union (0016)": union, "live re-tuned year 1": retuned, "live shipped (tuned on test)": shipped}
    w("**D5, the headline at 5 episodes a year (k = 4)**")
    w("")
    rows = []
    for nm, r in rows_all.items():
        d5, iv = r["metrics"]["D5"], r["intervals"]["D5"]
        rows.append([nm, f"{d5['level']:.3g}", f"{d5['noise']:.2f} ({r['n']['D5']['noise']})", fi(d5.get("rare"), iv.get("rare")), str(d5.get("rare_delay")), fi(d5.get("common_esbl"), iv.get("common_esbl")), str(d5.get("common_esbl_delay"))])
    w("\n".join(table(["row", "level", "noise a year (episodes)", "rare", "delay", "common ESBL", "delay"], rows)))
    w("")
    w("The union's level is a per-series run length in years (as a p, 1 / (365.25 L)); the baselines' is a multiple of the live alphas. D5 compares rates at equal noise only where the noise values are close; the union's headline sits at its own grid point (see the curve).")
    w("")
    w("**D2 and median delay in days (200 trials per cell, seed 2026)**")
    w("")
    w("\n".join(d2_table(rows_all)))
    w("**D4 episodes a year over 2024-10-01 to 2026-09-27 (exact Poisson 95 %), fixed key, zones excluded**")
    w("")
    rows = []
    for nm, r in rows_all.items():
        d4, iv = r["metrics"]["D4"], r["intervals"]["D4"]
        rows.append([nm, fi(d4["episodes_per_year"], iv["episodes_per_year"]), fi(d4["cluster"], iv["cluster"]), fi(d4["sentinel"], iv["sentinel"]), fi(d4["data"], iv["data"]), f"{d4['alerts_per_week']:.3f}"])
    w("\n".join(table(["row", "all", "cluster", "sentinel", "data", "alerts a week"], rows)))
    w("")
    w("**D1 (demonstration), D6, D7, I1**")
    w("")
    rows = []
    for nm, r in rows_all.items():
        m, iv = r["metrics"], r["intervals"]
        i1 = m["I1"]
        rows.append([nm, str(m["D1"]), fi(m["D6"], iv.get("D6")), fi(m["D7"], iv.get("D7")), f"{i1['alerts']} alerts, {i1['incidents']} incidents, {i1['alerts_per_incident']:.2f} per incident"])
    w("\n".join(table(["row", "D1 (E1, E1 corrected, E2, E2 corrected, E3 not this method's kind, E4 date)", "D6", "D7", "I1"], rows)))
    w("")
    w("**The union's D5 curve (level, noise, rates at k = 4 for each family, delays)**")
    w("")
    mark = {}
    rows = []
    for r in ctx["union_curve"]:
        y = 1 / (365.25 * r["level"])
        tag = " (L_sim)" if c["L_sim"] is not None and abs(y - round(c["L_sim"], 6)) < 1e-5 else " (L_S)" if abs(y - round(c["L_S"], 6)) < 1e-5 else ""
        rows.append([f"{y:.3g}{tag}", f"{r['noise']:.2f} ({r['noise_count']})"] + [f"{r[f]:.3f}" for f in FAMILIES if f in r] + [str(r.get("rare_delay")), str(r.get("common_esbl_delay"))])
    w("\n".join(table(["L (years)", "noise a year (episodes)"] + list(FAMILIES) + ["delay rare", "delay common ESBL"], rows)))
    w("")
    w("Reference curve (`live-set-retuned-year1`, level = multiple of the live alphas):")
    w("")
    rows = [[f"{r['level']:g}", f"{r['noise']:.2f} ({r['noise_count']})"] + [f"{r[f]:.3f}" for f in FAMILIES if f in r] for r in retuned["D5_curve"]]
    w("\n".join(table(["multiple", "noise a year (episodes)"] + list(FAMILIES), rows)))
    w("")
    w("## 4. Parts alone and the common-limit ablation (D2, D4, D5, 100 trials per cell)")
    w("")
    for key, title in (("poisson", "Poisson part alone"), ("bernoulli", "Bernoulli part alone"), ("common", "Union with one common limit (p = exp(-S))")):
        r = ctx["small"][key]
        d5 = r["metrics"]["D5"]
        d4 = r["metrics"]["D4"]
        w(f"**{title}**: {ctx['small_names'][key]}. D5 headline level {d5['level']:.3g}, noise {d5['noise']:.2f} a year ({r['n']['D5']['noise']} episodes), rare {fi(d5.get('rare'), r['intervals']['D5'].get('rare'))} (delay {d5.get('rare_delay')}), common ESBL {fi(d5.get('common_esbl'), r['intervals']['D5'].get('common_esbl'))} (delay {d5.get('common_esbl_delay')}); D4 at the headline level {d4['episodes_per_year']:.2f} a year.")
        w("")
        rows = [[str(row["level"] if key == "common" and False else f"{1 / (365.25 * row['level']):.3g}" if key != "common" else f"{-math.log(row['level']):.3g}"), f"{row['noise']:.2f} ({row['noise_count']})"] + [f"{row[f]:.3f}" for f in FAMILIES if f in row] for row in r["D5_curve"]]
        w("\n".join(table(["L (years)" if key != "common" else "h", "noise a year (episodes)"] + list(FAMILIES), rows)))
        w("")
    w("## 5. Where the union's detections come from (seed 2026, 200 trials per cell, at the operating level)")
    w("")
    rows = []
    for f in FAMILIES:
        for k in KS:
            v = ctx["prov"][f"{f}_k{k}"]
            rows.append([f, str(k), f"{v['detected']}/{v['trials']}", str(v["delay0"]), str(v["poisson_only"]), str(v["bernoulli_only"]), str(v["both"])])
    w("\n".join(table(["family", "k", "detected", "of which delay 0", "Poisson part only", "Bernoulli part only", "both"], rows)))
    w("")
    w("Delay 0 counts a run begun before the start (no reset) as well as a same-day detection; the k = 0 rows are the controls.")
    w("")
    w("## 6. Checks")
    w("")
    ck = ctx["checks"]
    w(f"- `check_causal` (the detector built from the rows it is given), cuts {', '.join(ck['causal']['cuts'])}: {'no differences' if not ck['causal']['problems'] else '; '.join(ck['causal']['problems'])}.")
    ff = ck["fast"]
    w(f"- Trial fast path against the from-scratch computation: {ff['trials']} trials, {ff['signals']} signals, {ff['trials_that_differ']} trials differ (max relative difference in p {ff['max_rel_diff_p']:.2e}){'' if not ff['cells_that_differ'] else '; differing cells ' + json.dumps(ff['cells_that_differ'])}.")
    fo = ck["focus"]
    w(f"- Focused against full signals on the real data: {fo['cases']} cases, {fo['signals']} signals, {fo['mismatches']} mismatches.")
    w(f"- Runs of the detector by the way the world was obtained (real-data world with the change applied / built from the rows given, the slow fallback): {ctx['paths']['fast']} / {ctx['paths']['slow']}; the `check_causal` runs use `rebuild`.")
    nu = ck["numerics"]
    w(f"- Vectorised statistic against loops from the definition: {'; '.join(nu['series'])}; largest difference in S {nu['max_abs_diff_S']:.1e}.")
    w("")
    w("## 7. Deviations from plan")
    w("")
    for d in ctx["deviations"]:
        w(f"- {d}")
    w("")
    path.write_text("\n".join(L))


def main() -> None:
    clock = harness.Clock()
    OUT.mkdir(exist_ok=True)
    records, cultures = harness.data()
    world = cs.real_world()
    log("stage 1: tuning year")
    tune = run_tuning(records, cultures)
    pois, row_p, _ = choose(tune, "P")
    bern, row_b, _ = choose(tune, "B")
    log(f"  chosen {lab_p(pois)} | {lab_b(bern)}  cpu {clock.cpu:.0f} s")
    union0 = cs.Cusum(pois=pois, bern=bern).detector()
    log("stage 2: calibration")
    calib = run_calibration(world, pois, bern, union0, records, cultures)
    log(f"  m {calib['m']} L_S {calib['L_S']:.1f} L_sim {calib['L_sim']} h_S {calib['h_S']:.2f} h_sim {calib['h_sim']}  cpu {clock.cpu:.0f} s")
    deviations: list[str] = []
    l_sim = calib["L_sim"]
    if l_sim is None:
        l_sim = cs.LEVELS_YEARS[-1] if calib["sim"]["episodes_per_year_equalised"][-1] > cal.E_TARGET else cs.LEVELS_YEARS[0]
        deviations.append(f"The simulation did not cross 5 episodes a year inside the grid of run lengths; the operating level was set to the grid end L = {l_sim:g} years.")
        calib["L_sim"] = l_sim
    h_sim = calib["h_sim"]
    if h_sim is None:
        h_sim = cs.H_GRID[-1] if calib["sim"]["episodes_per_year_common"][-1] > cal.E_TARGET else cs.H_GRID[0]
        deviations.append(f"The simulation did not cross 5 episodes a year inside the common-limit grid; h_sim was set to the grid end {h_sim:g}.")
        calib["h_sim"] = h_sim
    # the calibrated rows next to the grid: simulated and real at L_S and L_sim
    sim_eq = calib["sim"]["episodes_per_year_equalised"]
    xs = [math.log(y) for y in cs.LEVELS_YEARS]

    def interp(x_new: float, ys: list[float]) -> float:
        for i in range(len(xs) - 1):
            if xs[i] <= x_new <= xs[i + 1]:
                f = (x_new - xs[i]) / (xs[i + 1] - xs[i])
                a, b = max(ys[i], 1e-9), max(ys[i + 1], 1e-9)
                return math.exp(math.log(a) + f * (math.log(b) - math.log(a)))
        return ys[0] if x_new < xs[0] else ys[-1]

    real_curve = [calib["real_year1"][str(y)]["per_year"] for y in cs.LEVELS_YEARS]
    ctx_sim_at_ls = interp(math.log(calib["L_S"]), sim_eq)
    ctx_real_at_ls = interp(math.log(calib["L_S"]), real_curve)
    ctx_real_at_lsim = interp(math.log(l_sim), real_curve)

    lv_union = levels_with([calib["L_S"], l_sim] + ([calib["L_real"]] if calib["L_real"] else []), (), True)
    op_level = cs.level_of_years(round(l_sim, 6))
    union = cs.Cusum(pois=pois, bern=bern)
    union_det = union.detector(levels=lv_union, default_level=op_level)
    log("stage 3: scoring the union")
    m_u, iv_u, n_u, ex_u = score(union_det, records, cultures, parts=UNION_PARTS, trials=200, level=op_level)
    log(f"  union done cpu {clock.cpu:.0f} s")
    prov = provenance(union_det, records, cultures, op_level)
    small = {}
    small_names = {}
    for key, det_obj in (
        ("poisson", cs.Cusum(pois=pois, bern=None)),
        ("bernoulli", cs.Cusum(pois=None, bern=bern)),
    ):
        det = det_obj.detector(levels=lv_union)
        small_names[key] = det.name
        m, iv, n, ex = score(det, records, cultures, parts=SMALL_PARTS, trials=PARTS_TRIALS, gaps=())
        small[key] = {"metrics": m, "intervals": iv, "n": n, "D5_curve": ex["D5_curve"], "extra": ex}
        log(f"  {key} alone done cpu {clock.cpu:.0f} s")
    common = cs.Cusum(pois=pois, bern=bern, mapping="common")
    lv_common = levels_with([calib["h_S"], h_sim], (), False)
    det = common.detector(levels=lv_common, default_level=math.exp(-round(h_sim, 6)))
    small_names["common"] = det.name
    m, iv, n, ex = score(det, records, cultures, parts=SMALL_PARTS, trials=PARTS_TRIALS, gaps=(), level=math.exp(-round(h_sim, 6)))
    small["common"] = {"metrics": m, "intervals": iv, "n": n, "D5_curve": ex["D5_curve"], "extra": ex}
    log(f"  common-limit ablation done cpu {clock.cpu:.0f} s")
    log("stage 4: checks")
    checks = {
        "causal": check_causal(pois, bern, lv_union, records, cultures),
        "fast": check_fast_path(pois, bern, records, cultures),
        "focus": check_focus(pois, bern, records, cultures),
        "numerics": check_numerics(pois, bern, records),
    }
    log(f"  checks done cpu {clock.cpu:.0f} s: {checks['causal']['problems'][:2]} {checks['fast']['trials_that_differ']} {checks['focus']['mismatches']}")
    if checks["causal"]["problems"]:
        raise SystemExit("check_causal found differences: " + "; ".join(checks["causal"]["problems"][:5]))

    log("stage 5: the record")
    wall, cpu = clock.wall, clock.cpu
    method = f"Poisson CUSUM ({lab_p(pois)}) and Bernoulli CUSUM ({lab_b(bern)}) per unit x series, limits from Siegmund's run length, operating level by simulation on year 1"
    notes = (
        f"Union of a Poisson CUSUM per unit x phenotype and unit x organism x specimen and a Bernoulli CUSUM per unit x surveillance pair; p = 1 / A_i(S_t) with A_i "
        f"Siegmund's in-control run length in days, so the level is a per-series run length; operating level L_sim = {l_sim:.3g} years chosen by simulation on year 1 "
        f"(Siegmund L_S = {calib['L_S']:.3g}). Both settings chosen on year 1 only (tune_curve). Seed 2026, 200 trials per cell. Plan: experiments/0016-cusum/README.md."
    )
    extra = {k: ex_u[k] for k in ("D5_curve", "D2_per_seed", "D2_cluster_signals_only", "D3_control", "D4_score_years", "D7_detail", "I1_full_tool", "operating_level", "trial_seeds", "trials_per_seed") if k in ex_u}
    extra["settings"] = {"poisson": list(pois), "bernoulli": list(bern), "operating_level_years": l_sim, "L_S_years": calib["L_S"], "m": calib["m"]}
    harness.write_metrics(
        OUT / "metrics.json", experiment=EXPERIMENT, method=method, family="detection", metrics=m_u, intervals=iv_u, n=n_u,
        runtime_s=wall, cpu_s=cpu, seeds=[2026], tuned_on_test=False, tuned_on=TUNED_ON, notes=notes, **extra,
    )
    for key, fname, nm in (("poisson", "metrics-poisson.json", "Poisson part alone"), ("bernoulli", "metrics-bernoulli.json", "Bernoulli part alone"), ("common", "metrics-common-limit.json", "union with one common limit")):
        s = small[key]
        harness.write_metrics(
            OUT / fname, experiment=EXPERIMENT, method=f"{small_names[key]} ({nm}; D2, D4, D5 at 100 trials per cell, exploratory)", family="detection",
            metrics=s["metrics"], intervals=s["intervals"], n=s["n"], runtime_s=wall, cpu_s=cpu, seeds=[2026], tuned_on_test=False, tuned_on=TUNED_ON,
            notes=f"Component of 0016, exploratory: {nm}; same settings as metrics.json, 100 trials per cell (another stream of seed 2026).",
            D5_curve=s["D5_curve"],
        )
    grid = {f"{p}|{lab_p(st) if p == 'P' else lab_b(st)}": rows for (p, st), rows in tune.items()}
    (OUT / "grid.json").write_text(json.dumps(harness._clean({"selection": grid, "calibration": calib, "chosen": {"poisson": list(pois), "bernoulli": list(bern)}}), indent=1) + "\n")
    baselines = {"retuned": load_baseline("live-set-retuned-year1"), "shipped": load_baseline("live-set-shipped")}
    ctx = {
        "wall": wall, "cpu": cpu, "tune": tune, "pois": pois, "bern": bern, "calib": calib, "union": {"metrics": m_u, "intervals": iv_u, "n": n_u},
        "retuned": baselines["retuned"], "shipped": baselines["shipped"], "union_name": union_det.name, "union_curve": ex_u["D5_curve"], "small": small,
        "small_names": small_names, "prov": prov, "checks": checks, "deviations": deviations or ["None so far."], "sim_at_LS": ctx_sim_at_ls,
        "real_at_LS": ctx_real_at_ls, "real_at_Lsim": ctx_real_at_lsim, "paths": dict(cs.PATHS),
    }
    ctx["deviations"] = deviations_text(ctx, deviations)
    write_results(OUT / "results.md", ctx)
    figure.draw(OUT / "figure.png", pois, calib["L_sim"])
    log(f"done: wall {wall:.0f} s, cpu {cpu:.0f} s")


def deviations_text(ctx: dict, extra: list[str]) -> list[str]:
    """Deviations from the plan that every run has (written in the code) plus any raised during the run."""
    out = list(extra)
    out += [
        "Floors added where the plan's 'never zero' does not hold: the weekly baseline rate is at least 0.001 events, the proportion is clipped to [0.001, 0.999], the arrival rate in the run length is at least 0.001 a week (the hospital share can be zero as well).",
        "Hospital totals for the shrinkage prior come from the real data's cumulative arrays, indexed only up to the last row's date; injected rows are added to them (exact), removed rows of a gap trial are taken out without re-flagging a patient's later isolate as a first one. `check_causal` is run on the detector built from the rows it is given.",
        "The simulated in-control panel uses the active series only (at least one event or observation in year 1), the same set that sets m.",
    ]
    return out


if __name__ == "__main__":
    main()
