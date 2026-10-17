"""Experiment 0017: the improved Farrington algorithm (Noufaily et al. 2013) on weekly counts, scored by the harness.

    uv run python experiments/0017-farrington-noufaily/run.py

The plan is README.md ("Experiment"); what ran and what came out is its Result. Writes out/results.md, out/metrics.json
(the headline row), out/metrics-*.json, out/grid.json and out/figure.png.
"""

from __future__ import annotations

import dataclasses
import json
import sys
import time
from pathlib import Path

import numpy as np
import statsmodels.api as sm
from scipy import stats

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import farrington as F  # noqa: E402
import figure  # noqa: E402
from aei import harness  # noqa: E402
from aei import score_detection as sd  # noqa: E402
from aei.inject import base_of, gap_hits, rare_hits, two_unit_hits, ward_in  # noqa: E402
from aei.jscompat import mulberry32  # noqa: E402
from aei.regional import upper_tail  # noqa: E402

EXPERIMENT = "0017-farrington-noufaily"
OUT = HERE / "out"
ROOT = HERE.parents[1]
BASELINES = ROOT / "benchmarks" / "overnight-2026-10-17" / "baselines"
TUNED_ON = f"{harness.TUNE[0]}..{harness.TUNE[1]}"
GRID = [(H, g, rw) for H in (26, 52) for g in (0, 4) for rw in (False, True)]
CUTS = ("2025-03-26", "2025-12-31", "2026-06-30")
PARTS_MAIN = ("D1", "D2", "D4", "D5", "D6", "D7", "I1")
PARTS_SMALL = ("D1", "D2", "D4", "D5", "I1")
PARTS_HOSP = ("D1", "D4", "I1")
E1_WINDOW = ("2025-06-04", "2025-08-31")
E2_WINDOW = ("2026-03-03", "2026-05-31")


def log(msg: str) -> None:
    print(f"[0017] {msg}", flush=True)


def label(H: int, g: int, rw: bool) -> str:
    return f"H={H}, g={g}, {'reweighted' if rw else 'plain'}"


def load_baseline(name: str) -> dict:
    return json.loads((BASELINES / f"{name}.json").read_text())


# ---------- year 1 ----------


def pick_level(rows: list[dict]) -> dict:
    """The loosest level whose year-1 noise is at most 5 a year; the strictest when there is none."""
    return next((r for r in rows if r["noise_per_year"] <= sd.HEADLINE_NOISE), rows[-1])


def year1(records, cultures) -> tuple[dict, dict]:
    table = {}
    for H, g, rw in GRID:
        det = F.Farrington("T", "unit", H, g, rw).detector()
        table[(H, g, rw)] = sd.tune_curve(det, records, cultures)
    best = None
    for (H, g, rw), rows in table.items():
        r = pick_level(rows)
        key = (-r["rare_hit"], -r["common_esbl_hit"], r["noise_count"], H, -g)
        if best is None or key < best[0]:
            best = (key, (H, g, rw), r)
    return table, {"setting": best[1], "row": best[2]}


# ---------- scoring a row ----------


def score(det, parts, trials: int, level: float, records, cultures) -> dict:
    t = time.process_time()
    m, iv, n, ex = sd.score_detector(det, parts=parts, trials_per_seed=trials, level=level, records=records, cultures=cultures, verbose=False)
    return {"metrics": m, "intervals": iv, "n": n, "extra": ex, "cpu": time.process_time() - t, "name": det.name}


def episodes_by_unit(det, signals, level: float) -> dict:
    sigs = [s for s in signals if det.passes(s, level)]
    groups = sd.group_signals(sigs, lambda s: sd.fixed_key(s, "cluster"))
    a, b = harness.SCORE
    out: dict = {}
    for g in groups:
        if a <= g[0].date <= b and not any(sd.zone_of(s, "cluster") for s in g):
            out[g[0].ward or "hospital"] = out.get(g[0].ward or "hospital", 0) + 1
    return dict(sorted(out.items()))


def hospital_row(f: F.Farrington, records, cultures, level: float, level2: float) -> dict:
    det = f.detector()
    sigs = det.run(records, cultures, None)
    r = score(det, PARTS_HOSP, 200, level, records, cultures)
    curve = []
    for lv in F.LEVELS:
        e = sd.episode_counts(det, sigs, lv)
        curve.append({"level": lv, "episodes_per_year": e["episodes_per_year"], "count": e["count"]})
    passing = [s for s in sigs if det.passes(s, level)]

    def first(window, org, ph, lv):
        hit = [s for s in sigs if det.passes(s, lv) and window[0] <= s.date <= window[1] and (s.organism == org or s.phenotype == ph)]
        return min(((s.date, round(s.p, 8), s.key) for s in hit), default=None)

    r["curve"] = curve
    r["listing"] = {"E1": first(E1_WINDOW, sd.ECOLI, "esbl", level), "E2": first(E2_WINDOW, sd.SAUREUS, "mrsa", level)}
    r["listing2"] = {"E1": first(E1_WINDOW, sd.ECOLI, "esbl", level2), "E2": first(E2_WINDOW, sd.SAUREUS, "mrsa", level2)}
    zone = [
        (s.date, s.key, s.p)
        for s in passing
        if (E1_WINDOW[0] <= s.date <= E1_WINDOW[1] and (s.organism == sd.ECOLI or s.phenotype == "esbl"))
        or (E2_WINDOW[0] <= s.date <= E2_WINDOW[1] and (s.organism == sd.SAUREUS or s.phenotype == "mrsa"))
    ]
    r["in_zones"] = sorted(zone)
    r["signals"] = len(passing)
    r["total_signals"] = len(sigs)
    return r


def reweight_activity(H: int, g: int) -> dict:
    """How often the Anscombe pass changes anything on the real data: over every tested (unit series, week) window of the
    unit scope (at least 13 reference weeks, y at least 2), the share with a weight below 1 and below 0.5."""
    import numpy as np

    w = F.real_world()
    Y = w.EV.reshape(-1, w.W)[:, : w.W - 1].astype(float)
    ts = np.arange(0, w.W - 1)
    idx, valid = F.reference_indices("T", ts, H, g)
    ref = Y[:, np.clip(idx, 0, None)]
    m = np.broadcast_to(valid[None, :, :], ref.shape).astype(float)
    mu0, phi, om, n, _ = F.level_fit(ref, m, True)
    ok = (n >= F.MIN_WEEKS) & (Y[:, ts] >= F.MIN_Y)
    low = ((om < 1.0 - 1e-12) & (m > 0)).any(-1) & ok
    low5 = ((om < 0.5) & (m > 0)).any(-1) & ok
    uni = F.universe()
    row = uni.unit_index["URO"] * len(uni.names) + uni.index["esbl"]
    e1 = ((om[row] < 1.0 - 1e-12) & (m[row] > 0)).any(-1) & ok[row]
    e1_ts = [int(t) for t in ts[e1]]
    return {"tested_windows": int(ok.sum()), "any_below_1": int(low.sum()), "any_below_0.5": int(low5.sum()), "min_omega": float(om[(m > 0) & ok[..., None]].min()), "URO_esbl_weeks_with_downweighting": e1_ts}


# ---------- checks ----------


class Checker:
    """Wraps a fast-path detector: every run is compared with a run from the rows given, unfocused and filtered the
    same way (the harness's matcher), and the fast signals are returned."""

    levels = F.LEVELS
    default_level = None

    def __init__(self, fast: F.Farrington):
        self.fast = fast
        self.full = dataclasses.replace(fast, rebuild=True)
        self.compared = 0
        self.mismatch: list[str] = []

    def run(self, records, cultures, focus=None):
        sig = self.fast.run(records, cultures, focus)
        full = self.full.run(records, cultures, None)
        keep = []
        for s in full:
            if not (ward_in(s.ward, focus.units) and focus.start <= s.date <= focus.end):
                continue
            if focus.organism is not None or focus.phenotypes is not None:
                if not (s.organism == focus.organism or (s.phenotype is not None and s.phenotype in (focus.phenotypes or ()))):
                    continue
            keep.append(s)
        a = sorted((s.key, s.date, round(s.p, 12)) for s in sig)
        b = sorted((s.key, s.date, round(s.p, 12)) for s in keep)
        self.compared += 1
        if a != b:
            self.mismatch.append(f"{len(a)} focused against {len(b)} full signals; only focused {sorted(set(a) - set(b))[:2]}, only full {sorted(set(b) - set(a))[:2]}")
        return sig


def check_trials(records, cultures, f: F.Farrington) -> dict:
    base = base_of(records, cultures)
    out = {}
    for name, fn in (
        ("rare cluster", lambda c, r, t: rare_hits(c, base, r, 4, t)),
        ("two-unit cluster", lambda c, r, t: two_unit_hits(c, base, r, 4, t)),
        ("gap of 5 days", lambda c, r, t: gap_hits(c, base, r, 5, False, t)),
    ):
        chk = Checker(f)
        rand = mulberry32(2026)
        for t in range(3):
            fn(chk, rand, t)
        out[name] = {"compared": chk.compared, "mismatches": chk.mismatch}
    return out


def check_causal(f: F.Farrington) -> list[str]:
    rb = dataclasses.replace(f, rebuild=True)
    return sd.check_causal(rb.detector(), CUTS, raise_on_error=False)


def check_statsmodels(records) -> dict:
    """The closed form (and the IRLS of design S) against statsmodels' weighted GLM, on reference weeks of real series."""
    uni = F.universe()
    w = F.real_world()
    cases = [("hospital", None, "esbl", 100), ("hospital", None, "mrsa", 120), ("hospital", None, sd.ECOLI, 90), ("hospital", None, sd.SAUREUS, 140), ("unit", "ED", "esbl", 110), ("unit", "URO", "esbl", 112), ("unit", "ICU", "mrsa", 150), ("hospital+spike", None, "mrsa", 120), ("unit+spike", "ED", "esbl", 110)]
    worst = {"mu0": 0.0, "phi": 0.0, "omega": 0.0}
    down = 0
    rows = []
    for scope, unit, name, t in cases:
        y = w.EH[uni.index[name]] if scope.startswith("hospital") else w.EV[uni.unit_index[unit], uni.index[name]]
        ref = y[t - 52 : t].astype(float)
        if scope.endswith("+spike"):  # two inserted outbreak weeks, so that weights below 1 are exercised
            ref[10], ref[30] = ref[10] + 6, ref[30] + 8
        X = np.ones((52, 1))
        fit1 = sm.GLM(ref, X, family=sm.families.Poisson()).fit(scale="X2")
        mu1, phi1 = float(np.exp(fit1.params[0])), max(1.0, float(fit1.scale))
        h = fit1.get_influence().hat_matrix_diag
        r = fit1.resid_anscombe_unscaled / np.sqrt(phi1 * (1 - h))
        om = np.where(r > F.C_ANSCOMBE, (F.C_ANSCOMBE / np.maximum(r, 1e-12)) ** 2, 1.0)
        fit2 = sm.GLM(ref, X, family=sm.families.Poisson(), var_weights=om).fit(scale="X2")
        mu2, phi2 = float(np.exp(fit2.params[0])), max(1.0, float(fit2.scale))
        mu0, phi, omega, _, _ = F.level_fit(ref[None, :], np.ones((1, 52)), True)
        d = {"mu0": abs(float(mu0[0]) - max(mu2, 0.5 / 52)), "phi": abs(float(phi[0]) - phi2), "omega": float(np.max(np.abs(omega[0] - om)))}
        for k in worst:
            worst[k] = max(worst[k], d[k])
        down += int((om < 1).sum())
        rows.append((scope, unit, name, t, round(float(ref.sum()), 0), round(mu2, 4), round(phi2, 4)))
    # design S: the harmonic fit, on two hospital series with at least 20 events
    harm = []
    for name, t in (("esbl", 120), (sd.ECOLI, 125)):
        y = w.EH[uni.index[name]]
        s = np.arange(t - 104, t).astype(float)
        ref = y[t - 104 : t].astype(float)
        mu0, phi, om, se = F.harmonic_fit(ref, s, t, False)
        Xd = np.column_stack([np.ones(104), np.sin(2 * np.pi * s / 52), np.cos(2 * np.pi * s / 52)])
        fit = sm.GLM(ref, Xd, family=sm.families.Poisson()).fit(scale="X2")
        xt = np.array([1.0, np.sin(2 * np.pi * t / 52), np.cos(2 * np.pi * t / 52)])
        harm.append(abs(mu0 - float(np.exp(xt @ fit.params))) / mu0)
    return {"cases": rows, "weights_below_1": down, "max_abs_diff": worst, "harmonic_max_rel_diff_mu0": max(harm)}


def calibration() -> list[dict]:
    """The same code on simulated negative binomial weeks with known mean: the share of weeks with p below alpha."""
    rng = np.random.default_rng(2026)
    n_weeks = 20_000
    rows = []
    for mean in (0.1, 0.5, 5.0, 50.0):
        for phi in (1.0, 2.0):
            for n_ref in (26, 52):
                if phi == 1.0:
                    ys = rng.poisson(mean, size=(n_weeks, n_ref + 1))
                else:
                    size = mean / (phi - 1.0)
                    ys = rng.negative_binomial(size, size / (size + mean), size=(n_weeks, n_ref + 1))
                ref, yt = ys[:, :n_ref].astype(float), ys[:, n_ref].astype(float)
                for rw in (False, True):
                    mu0, ph, _, _, _ = F.level_fit(ref, np.ones_like(ref), rw)
                    p = np.ones(n_weeks)
                    ok = yt >= F.MIN_Y
                    p[ok] = F.upper_tail_array(yt[ok], mu0[ok], ph[ok])
                    row = {"mean": mean, "phi": phi, "n_ref": n_ref, "reweight": rw}
                    for a in (1e-2, 1e-3):
                        row[f"rate_{a:g}"] = float(np.mean(p < a))
                        row[f"count_{a:g}"] = int(np.sum(p < a))
                    rows.append(row)
    ref = np.array([0.0, 1.0, 0.0, 2.0, 0.0, 0.0, 1.0, 0.0, 0.0, 3.0, 0.0, 0.0, 1.0])
    mu0, ph, _, _, _ = F.level_fit(ref[None, :], np.ones((1, 13)), True)
    a = float(F.upper_tail_array(np.array([4.0]), mu0, ph)[0])
    assert abs(a - upper_tail(4, float(mu0[0]), float(ph[0]))) < 1e-15 * max(1.0, a), "vectorised tail differs from aei.regional.upper_tail"
    return rows


# ---------- the report ----------


def ci(iv) -> str:
    return "" if not iv else f" [{iv[0]:.3f}, {iv[1]:.3f}]"


def rate(row: dict, fam_k: str) -> str:
    m = row["metrics"]["D2"].get(fam_k)
    if m is None:
        return "-"
    d = row["metrics"]["D2_delay"].get(fam_k)
    return f"{m:.3f}{ci(row['intervals']['D2'].get(fam_k))} ({'-' if d is None else d} d)"


def d5_line(name: str, row: dict) -> str:
    d5, iv = row["metrics"]["D5"], row["intervals"].get("D5", {})
    return (
        f"| {name} | {d5['level']:g} | {d5['noise']:.2f} ({row['n']['D5']['noise']}) | {d5['rare']:.3f}{ci(iv.get('rare'))} | {d5['rare_delay']} | "
        f"{d5['common_esbl']:.3f}{ci(iv.get('common_esbl'))} | {d5['common_esbl_delay']} |"
    )


def d4_line(name: str, row: dict) -> str:
    m, iv = row["metrics"]["D4"], row["intervals"]["D4"]
    ep = iv["episodes_per_year"]
    return f"| {name} | {m['episodes_per_year']:.2f} [{ep[0]:.2f}, {ep[1]:.2f}] | {m['cluster']:.2f} | {m['sentinel']:.2f} | {m['data']:.2f} | {m['alerts_per_week']:.3f} |"


def write_results(path: Path, c: dict) -> None:
    L: list[str] = []
    a = L.append
    a("# 0017 results (generated by run.py)\n")
    a(f"Run time {c['wall']:.0f} s (wall).")
    a(f"Sweep time: {c['cpu']:.1f} s (CPU, budget 600 s). Seed 2026 only; seeds 2027 to 2030 not used.")
    a(f"Unit-scope detector runs by the way the world was obtained: fast (the real data's world plus the trial's change) {F.PATHS['fast']}, from the rows given (checks) {F.PATHS['rebuild']}, slow fallback {F.PATHS['slow']}; hospital-scope runs (always built from the rows given) {F.PATHS['hospital']}.\n")
    a("## Year 1: setting choice (measured; 40 rare + 40 common ESBL clusters of k = 4, starts 2024-04-01 to 2024-08-15, noise 2024-04-01 to 2024-09-30)\n")
    a("| setting | level | noise a year (episodes) | rare | common ESBL |")
    a("|---|---|---|---|---|")
    for (H, g, rw), rows in c["table"].items():
        r = pick_level(rows)
        mark = " **chosen**" if (H, g, rw) == c["choice"]["setting"] else ""
        a(f"| {label(H, g, rw)}{mark} | {r['level']:g} | {r['noise_per_year']:.2f} ({r['noise_count']}) | {r['rare_hit']}/{r['rare_n']} | {r['common_esbl_hit']}/{r['common_esbl_n']} |")
    a("")
    a("Year-1 curve of the chosen setting (level, noise a year, rare, common ESBL, delays):\n")
    a("| level | noise a year | rare | delay | common ESBL | delay |")
    a("|---|---|---|---|---|---|")
    for r in c["table"][c["choice"]["setting"]]:
        a(f"| {r['level']:g} | {r['noise_per_year']:.2f} | {r['rare_hit']}/{r['rare_n']} | {r['rare_delay']} | {r['common_esbl_hit']}/{r['common_esbl_n']} | {r['common_esbl_delay']} |")
    a("")
    rows = c["rows"]
    base = c["baselines"]
    a(f"## D5 at 5 episodes a year (k = 4; Wilson 95 %; delay in days). Headline row operating level (year 1): {c['level']:g}\n")
    a("| row | level | noise a year (episodes) | rare | delay | common ESBL | delay |")
    a("|---|---|---|---|---|---|---|")
    for k, nm in c["names"].items():
        if "D5" in rows[k]["metrics"]:
            a(d5_line(nm, rows[k]))
    a(d5_line("live re-tuned year 1 (reference)", base["retuned"]))
    a(d5_line("live shipped (tuned on test)", base["shipped"]))
    a("")
    a("## D5 curve of the headline row (noise = cluster signals, episodes a year; rates at k = 4)\n")
    a("| level | noise (count) | whole tool | rare | common ESBL | common resistant | wild type | two unit |")
    a("|---|---|---|---|---|---|---|---|")
    for r in rows["main"]["extra"]["D5_curve"]:
        a(f"| {r['level']:g} | {r['noise']:.2f} ({r['noise_count']}) | {r['whole_tool']:.2f} | {r['rare']:.3f} | {r['common_esbl']:.3f} | {r['common_resistant']:.3f} | {r['wild_type']:.3f} | {r['two_unit']:.3f} |")
    a("")
    a("## D5 curves of the other unit-scope rows (level: noise a year, rare, common ESBL)\n")
    for k in ("other", "Y", "Yother"):
        a(f"- {c['names'][k]}: " + "; ".join(f"{r['level']:g}: {r['noise']:.1f}, {r['rare']:.2f}, {r['common_esbl']:.2f}" for r in rows[k]["extra"]["D5_curve"]))
    a("")
    a("## D2 at the operating level, every cell of the headline row (rate [Wilson 95 %] (median delay))\n")
    a("| family | k = 0 | k = 2 | k = 3 | k = 4 | k = 6 |")
    a("|---|---|---|---|---|---|")
    for f in ("rare", "common_resistant", "wild_type", "common_esbl", "two_unit"):
        a(f"| {f} | " + " | ".join(rate(rows["main"], f"{f}_k{k}") for k in (0, 2, 3, 4, 6)) + " |")
    a("")
    a("## D2 at k = 3 and 4, headline / paired other weighting / year-back plain or reweighted / re-tuned / shipped\n")
    a("| family | k | " + " | ".join([c["names"][k] for k in ("main", "other", "Y", "Yother", "nm")] + ["live re-tuned", "live shipped"]) + " |")
    a("|---|---|---|---|---|---|---|---|---|")
    for f in ("rare", "common_resistant", "wild_type", "common_esbl", "two_unit"):
        for k in (3, 4):
            a(f"| {f} | {k} | " + " | ".join(rate(rows[x], f"{f}_k{k}") for x in ("main", "other", "Y", "Yother", "nm")) + f" | {rate(base['retuned'], f'{f}_k{k}')} | {rate(base['shipped'], f'{f}_k{k}')} |")
    a("")
    a("## D4 over the scoring period at the operating level (episodes a year, exact Poisson 95 %), D6, D7, I1, D1\n")
    a("| row | all | cluster | sentinel | data | alerts a week |")
    a("|---|---|---|---|---|---|")
    for k, nm in c["names"].items():
        a(d4_line(nm, rows[k]))
    a(d4_line("live re-tuned year 1", base["retuned"]))
    a(d4_line("live shipped", base["shipped"]))
    a("")
    m = rows["main"]
    a(f"D6 (headline row): {m['metrics']['D6']:.3f}{ci(m['intervals'].get('D6'))} (re-tuned {base['retuned']['metrics']['D6']}, shipped {base['shipped']['metrics']['D6']}). D7: {m['metrics']['D7']:.3f} (re-tuned {base['retuned']['metrics']['D7']:.3f}, shipped {base['shipped']['metrics']['D7']:.3f}). "
      f"I1: {m['metrics']['I1']['alerts']} alerts in {m['metrics']['I1']['incidents']} incidents (re-tuned {base['retuned']['metrics']['I1']['alerts']} in {base['retuned']['metrics']['I1']['incidents']}, shipped {base['shipped']['metrics']['I1']['alerts']} in {base['shipped']['metrics']['I1']['incidents']}).\n")
    a("D1 (demonstration, days from onset; None = not found):\n")
    for k, nm in c["names"].items():
        if "D1" in rows[k]["metrics"]:
            a(f"- {nm}: {json.dumps(rows[k]['metrics']['D1'])}")
    a(f"- live re-tuned: {json.dumps(base['retuned']['metrics']['D1'])}; live shipped: {json.dumps(base['shipped']['metrics']['D1'])}\n")
    a(f"D6, D7, I1 of the extra row read at D5's level {c['level2']:g}: D6 {rows['nm']['metrics']['D6']:.3f}{ci(rows['nm']['intervals'].get('D6'))}, D7 {rows['nm']['metrics']['D7']:.3f}, I1 {rows['nm']['metrics']['I1']['alerts']} alerts in {rows['nm']['metrics']['I1']['incidents']} incidents.\n")
    act = c["activity"]
    a(f"Down-weighting in use (headline setting H, g; every tested unit-scope window of the real data): {act['tested_windows']} windows, {act['any_below_1']} with at least one weight below 1, {act['any_below_0.5']} with one below 0.5, lowest weight {act['min_omega']:.3f}; URO x ESBL weeks whose window had a weight below 1: {act['URO_esbl_weeks_with_downweighting']}.\n")
    a("Episodes by unit over the scoring period at the operating level (zones excluded; descriptive):\n")
    for k, v in c["by_unit"].items():
        a(f"- {c['names'][k]}: {json.dumps(v)}")
    a("")
    a("Where the headline row's D2 detections at k = 4 come from, unit-scope signals only: see `D2_cluster_signals_only` in metrics.json (the row raises no sentinel signals).\n")
    a("## Hospital scope (13 series; D4, I1; no trials: a hospital-wide signal never matches an injected unit)\n")
    a("Episodes a year by level (zones key on a unit, so hospital-wide signals inside E1 and E2 are not excluded):\n")
    a("| row | " + " | ".join(f"{lv:g}" for lv in F.LEVELS) + " |")
    a("|---|" + "---|" * len(F.LEVELS))
    for nm, r in c["hospital"].items():
        a(f"| {nm} | " + " | ".join(f"{x['episodes_per_year']:.2f} ({x['count']})" for x in r["curve"]) + " |")
    a("")
    a(f"At the operating level {c['level']:g}: I1 and the first hospital-wide signal inside each event window (described, not scored: D1's matcher needs the unit):\n")
    for nm, r in c["hospital"].items():
        i1 = r["metrics"]["I1"]
        a(f"- {nm}: {r['signals']} of {r['total_signals']} signals pass; I1 {i1['alerts']} alerts, {i1['incidents']} incidents; E1 window {r['listing']['E1']}; E2 window {r['listing']['E2']}; at level {c['level2']:g}: E1 {r['listing2']['E1']}, E2 {r['listing2']['E2']}; signals inside E1/E2 windows at {c['level']:g}: {len(r['in_zones'])}")
    a("")
    a("## Checks\n")
    a(f"- `check_causal` at {', '.join(CUTS)} (detector built from the rows it is given): " + "; ".join(f"{k}: {'no differences' if not v else v}" for k, v in c["causal"].items()))
    a("- Fast path against a run from the rows given (focused vs unfocused, filtered by the harness's matcher), 3 trials each: " + "; ".join(f"{k}: {v['compared']} compared, {len(v['mismatches'])} differing" + (f" ({v['mismatches'][0]})" if v["mismatches"] else "") for k, v in c["trials"].items()))
    sm_ = c["statsmodels"]
    a(f"- Closed form against statsmodels weighted GLM (9 reference windows of 52 weeks, two of them with inserted outbreak weeks; {sm_['weights_below_1']} weights below 1 in all): largest differences mu0 {sm_['max_abs_diff']['mu0']:.2e}, phi {sm_['max_abs_diff']['phi']:.2e}, weights {sm_['max_abs_diff']['omega']:.2e}; design S IRLS against statsmodels (2 series): largest relative difference in mu0 {sm_['harmonic_max_rel_diff_mu0']:.2e}.")
    a("")
    a("### Calibration on simulated negative binomial weeks (20,000 a cell, known mean; share of weeks with p below alpha, y at least 2)\n")
    a("| mean | phi | n_ref | weighting | share p < 1e-2 | share p < 1e-3 |")
    a("|---|---|---|---|---|---|")
    for r in c["calibration"]:
        a(f"| {r['mean']:g} | {r['phi']:g} | {r['n_ref']} | {'reweighted' if r['reweight'] else 'plain'} | {r['rate_0.01']:.4f} ({r['count_0.01']}) | {r['rate_0.001']:.5f} ({r['count_0.001']}) |")
    a("")
    a("## Deviations from plan (generated)\n")
    for d in c["deviations"]:
        a(f"- {d}")
    a("")
    path.write_text("\n".join(L) + "\n")


def main() -> None:
    clock = harness.Clock()
    OUT.mkdir(exist_ok=True)
    records, cultures = harness.data()
    F.real_world()
    log("year 1: 8 settings")
    table, choice = year1(records, cultures)
    H, g, rw = choice["setting"]
    level = choice["row"]["level"]
    log(f"chosen {label(H, g, rw)} at level {level:g}; cpu {clock.cpu:.0f} s")
    f_main = F.Farrington("T", "unit", H, g, rw)
    f_other = dataclasses.replace(f_main, reweight=not rw)
    f_y = F.Farrington("Y", "unit", H, g, rw)
    f_yo = dataclasses.replace(f_y, reweight=not rw)
    names = {
        "main": f"headline: trailing H={H}, g={g}, {'reweighted' if rw else 'plain'}",
        "other": f"paired: same, {'plain' if rw else 'reweighted'}",
        "Y": f"year-back, {'reweighted' if rw else 'plain'} (100 trials a cell)",
        "Yother": f"year-back, {'plain' if rw else 'reweighted'} (100 trials a cell)",
    }
    rows = {}
    signals_full = {}
    for key, f, parts, trials in (("main", f_main, PARTS_MAIN, 200), ("other", f_other, PARTS_SMALL, 200), ("Y", f_y, PARTS_SMALL, 100), ("Yother", f_yo, PARTS_SMALL, 100)):
        det = f.detector(default_level=level)
        rows[key] = score(det, parts, trials, level, records, cultures)
        signals_full[key] = (det, det.run(records, cultures, None))
        log(f"{names[key]}: cpu {rows[key]['cpu']:.0f} s (total {clock.cpu:.0f} s)")
    level2 = rows["main"]["metrics"]["D5"]["level"]  # D5's noise-matched level, for the extra row and the listings
    det2 = f_main.detector(default_level=level2, name=f_main.name + ", read at D5's level")
    rows["nm"] = score(det2, ("D2", "D4", "D6", "D7", "I1"), 200, level2, records, cultures)
    signals_full["nm"] = (det2, signals_full["main"][1])
    names["nm"] = f"extra: headline setting read at D5's level {level2:g}"
    log(f"extra row at D5's level: cpu {rows['nm']['cpu']:.0f} s (total {clock.cpu:.0f} s)")
    activity = reweight_activity(H, g)
    by_unit = {k: episodes_by_unit(*signals_full[k], level2 if k == "nm" else level) for k in rows}
    hospital = {}
    for f in (
        F.Farrington("T", "hospital", H, g, rw),
        F.Farrington("T", "hospital", H, g, not rw),
        F.Farrington("Y", "hospital", H, g, rw),
        F.Farrington("Y", "hospital", H, g, not rw),
        F.Farrington("S", "hospital", H, g, rw),
        F.Farrington("S", "hospital", H, g, not rw),
    ):
        hospital[f.name] = hospital_row(f, records, cultures, level, level2)
    log(f"hospital rows done; cpu {clock.cpu:.0f} s")
    causal = {"headline unit T": check_causal(f_main), "year-back unit": check_causal(f_y), "hospital S": check_causal(F.Farrington("S", "hospital", H, g, rw))}
    trials = check_trials(records, cultures, f_main)
    smc = check_statsmodels(records)
    cal = calibration()
    fig = figure.draw(OUT / "figure.png", "T", H, g, rw, level)
    log(f"checks, calibration and figure done; cpu {clock.cpu:.0f} s")

    base = {"retuned": load_baseline("live-set-retuned-year1"), "shipped": load_baseline("live-set-shipped")}
    deviations = [
        "Design Y is tested from week 55 with its 7 weeks (the 13-week minimum applies to T and S only), and b_eff = 2 starts at week 107 (2025-10-20), not 2025-10-13 as the plan's text says: the rule (t - 52j - 3 >= 0) gives 107.",
        "Design S fits the harmonic only when the reference holds at least 20 events; with fewer it fits the level alone (VRE, CPE hospital-wide).",
        "Hospital T rows use the headline setting's H and g and both weightings, as planned; their D1 is structurally None for E1 and E2 (ward None), the first hospital-wide signal in each window is listed instead.",
        "Extra row, not in the plan: the headline setting read at D5's noise-matched level (D2 to D4, D6, D7, I1 there), because the year-1 level gives 0.5 episodes a year on the scoring period and the live rows sit near 3 to 9; and a count of how often the down-weighting changes a window. Both are descriptive.",
        "CPU was far below the estimate (trials cost 1 to 3 ms, not 18 ms), so no cut of the plan's cut order was made.",
        "D5 headline uses the harness's own read-out of the scoring-period noise curve; D2 to D4, D6, D7 and I1 are read at the year-1 level, as planned.",
    ]
    if not rw:
        deviations.append("The headline setting is not reweighted, so the figure's hollow bars come from a reweighted fit of the last as-of week, drawn for illustration.")
    wall, cpu = clock.wall, clock.cpu
    write_results(
        OUT / "results.md",
        {"wall": wall, "cpu": cpu, "table": table, "choice": choice, "rows": rows, "baselines": base, "names": names, "level": level, "hospital": hospital, "by_unit": by_unit,
         "level2": level2, "activity": activity, "causal": causal, "trials": trials, "statsmodels": smc, "calibration": cal, "deviations": deviations},
    )
    notes = (
        f"Headline: Farrington, trailing {H} weeks, guard {g}, {'reweighted' if rw else 'plain'}, unit x organism and unit x phenotype weekly series, read at tail level {level:g} (year 1). "
        f"Exploratory; settings chosen on year 1 only; seed 2026 only."
    )
    method = f"Improved Farrington (Noufaily 2013) on weekly unit series, trailing {H} wk, guard {g}, {'reweighted' if rw else 'plain'}"
    main = rows["main"]
    keep = ("D5_curve", "D2_per_seed", "D2_cluster_signals_only", "D4_score_years", "D7_detail", "I1_full_tool", "operating_level", "trial_seeds", "trials_per_seed")
    extra = {k: main["extra"][k] for k in keep if k in main["extra"]}
    extra["settings"] = {"design": "T", "H": H, "g": g, "reweight": rw, "c": F.C_ANSCOMBE, "min_y": F.MIN_Y, "level_year1": level}
    harness.write_metrics(OUT / "metrics.json", experiment=EXPERIMENT, method=method, family="detection", metrics=main["metrics"], intervals=main["intervals"], n=main["n"],
                          runtime_s=wall, cpu_s=cpu, seeds=[2026], tuned_on_test=False, tuned_on=TUNED_ON, notes=notes, **extra)
    for key, fname, desc in (("other", "metrics-other-weighting.json", "the other weighting at the headline setting (paired, 200 per cell)"),
                             ("Y", "metrics-yearback.json", "year-back design, headline weighting, fixed a priori (100 per cell)"),
                             ("Yother", "metrics-yearback-other-weighting.json", "year-back design, other weighting (100 per cell)")):
        r = rows[key]
        harness.write_metrics(OUT / fname, experiment=EXPERIMENT, method=f"{r['name']} ({desc}, exploratory)", family="detection", metrics=r["metrics"], intervals=r["intervals"], n=r["n"],
                              runtime_s=wall, cpu_s=cpu, seeds=[2026], tuned_on_test=False, tuned_on=TUNED_ON, notes=f"Component of 0017, exploratory: {desc}.", D5_curve=r["extra"]["D5_curve"])
    r = rows["nm"]
    harness.write_metrics(OUT / "metrics-noise-matched.json", experiment=EXPERIMENT, method=f"{r['name']} (extra row, 200 per cell, exploratory)", family="detection", metrics=r["metrics"], intervals=r["intervals"], n=r["n"],
                          runtime_s=wall, cpu_s=cpu, seeds=[2026], tuned_on_test=False, tuned_on=TUNED_ON, notes="Component of 0017, exploratory, not in the plan: the headline setting read at D5's noise-matched level instead of the year-1 level.")
    first = next(iter(hospital.values()))
    harness.write_metrics(OUT / "metrics-hospital.json", experiment=EXPERIMENT, method=f"{first['name']} (hospital-wide series; D4 and I1 only, exploratory)", family="detection", metrics=first["metrics"],
                          intervals=first["intervals"], n=first["n"], runtime_s=wall, cpu_s=cpu, seeds=[2026], tuned_on_test=False, tuned_on=TUNED_ON,
                          notes="Hospital-wide series: D2 and D5 are zero by construction (ward None never matches an injected unit), D1 cannot match E1 or E2; D4 is the figure.", hospital_curve=first["curve"])
    grid = {label(*k): rows_ for k, rows_ in table.items()}
    (OUT / "grid.json").write_text(json.dumps(harness._clean({"year1": grid, "chosen": {"setting": list(choice["setting"]), "level": level}, "figure": fig}), indent=1) + "\n")
    log(f"done: wall {wall:.0f} s, cpu {cpu:.0f} s")


if __name__ == "__main__":
    main()
