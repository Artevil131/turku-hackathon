"""Experiment 0023: the Beta-binomial predictive tail against the Poisson tail for profile and phenotype excess. Plan: README.md.

    uv run python experiments/0023-beta-binomial-tail/run.py [--trials N]

Stage 1 picks a setting on the tuning year only (`aei.score_detection.tune_curve`, as 0016). Stage 2 scores the live set and
the nine (m, delta) settings through `aei.score_detection.score_detector` (D1, D2, D4, D5; seed 2026, 200 trials per cell) and
reads each D5 curve at equal noise. Stage 3 scores the live set, the year-1 pick and its organism-parent twin on every part
(D1 to D7, I1). Stage 4 runs the checks. Stage 5 writes out/. The detectors are in bbtail.py.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
import time
from pathlib import Path

import numpy as np
from scipy import special
from scipy.stats import binom

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import bbtail as bb  # noqa: E402

from aei import harness  # noqa: E402
from aei import score_detection as sd  # noqa: E402
from aei.detect import poisson_upper  # noqa: E402
from aei.inject import Focus, seed_trials  # noqa: E402

OUT = HERE / "out"
BASELINES = harness.ROOT / "benchmarks" / "overnight-2026-10-17" / "baselines"
EXPERIMENT = "0023-beta-binomial-tail"
TUNED_ON = f"{harness.TUNE[0]}..{harness.TUNE[1]}"
GRID = [(m, d) for m in (5, 10, 20) for d in (0.95, 0.98, 1.0)]
NOISE_LIMIT = sd.HEADLINE_NOISE
TUNE_NOISE = 0.0  # set in main: the live set's year-1 noise at its shipped alphas (no setting reaches 5 a year on year 1)
SCREEN = ("D1", "D2", "D4", "D5")
CAUSAL_CUTS = ["2025-03-31", "2025-12-31", "2026-06-30"]


def log(msg: str) -> None:
    print(msg, file=sys.stderr, flush=True)


def lab(st) -> str:
    return f"m {st[0]}, delta {st[1]:g}"


def make(st=None, parent="stratum") -> sd.Detector:
    if st is None:
        return sd.LiveSet(name="live set, Poisson tail", levels=bb.LEVELS)
    return bb.BBTail(name=f"Beta-binomial tail, {lab(st)}" + ("" if parent == "stratum" else f", parent {parent}"), m=st[0], delta=st[1], parent=parent)


def operating_row(rows, limit=None):
    """The loosest level whose year-1 noise is at most `limit` episodes a year (default: the live set's shipped-level year-1 noise)."""
    limit = TUNE_NOISE if limit is None else limit
    return next((r for r in rows if r["noise_per_year"] <= limit), None)


def choose(tune: dict):
    """Per setting its operating row on year 1; highest rare hit count, ties common ESBL hits, fewer episodes, larger m, larger delta."""
    ranked = []
    for st, rows in tune.items():
        r = operating_row(rows)
        if r is not None:
            ranked.append((st, r))
    ranked.sort(key=lambda x: (-x[1]["rare_hit"], -x[1]["common_esbl_hit"], x[1]["noise_count"], -x[0][0], -x[0][1]))
    return ranked[0][0], ranked[0][1], ranked


def interp(curve: list[dict], noise: float, key: str) -> float | None:
    """The rate at `noise` episodes a year read linearly between the two bracketing levels of the D5 curve (None outside it)."""
    pts = sorted({(r["noise"], r[key]) for r in curve if key in r})
    for (n0, v0), (n1, v1) in zip(pts, pts[1:]):
        if n0 <= noise <= n1:
            return v0 if n1 == n0 else v0 + (v1 - v0) * (noise - n0) / (n1 - n0)
    return None


def score(det, records, cultures, parts, trials):
    return sd.score_detector(det, parts=parts, trials_per_seed=trials, gap_settings=() if "D3" not in parts and "D6" not in parts and "D7" not in parts else sd.GAP_SETTINGS, records=records, cultures=cultures, verbose=False)


# --- checks -----------------------------------------------------------------------------------------------------------------


def check_tail() -> dict:
    rng = np.random.default_rng(7)
    worst = 0.0
    for _ in range(300):
        n = int(rng.integers(1, 16))
        y = int(rng.integers(0, n + 1))
        a, b = float(rng.uniform(0.01, 30)), float(rng.uniform(0.5, 600))
        direct = sum(math.exp(special.gammaln(n + 1) - special.gammaln(j + 1) - special.gammaln(n - j + 1) + special.betaln(j + a, n - j + b) - special.betaln(a, b)) for j in range(y, n + 1))
        worst = max(worst, abs(bb.tail(y, n, a, b) - direct) / max(direct, 1e-12))
    pi, worst_pois = 0.003, 0.0
    for n, y in ((8, 2), (20, 3), (40, 4)):
        worst_pois = max(worst_pois, abs(bb.tail(y, n, 1e7 * pi, 1e7 * (1 - pi)) - float(binom.sf(y - 1, n, pi))) / float(binom.sf(y - 1, n, pi)))
    return {"max_rel_diff_vs_direct_pmf": worst, "max_rel_diff_vs_binomial_as_m_grows": worst_pois}


def _key(s):
    return (s.date, s.key, s.ward, s.observed)


def check_focus(st, records, cultures) -> dict:
    """The focused path against the full run on the real data (units, organisms and phenotypes of three cases), p equal."""
    det = make(st)
    full = det.run(records, cultures, None)
    cases = [("URO", "Escherichia coli", ("esbl",), "2025-06-01"), ("ICU", "Staphylococcus aureus", ("mrsa",), "2026-03-01"), ("ED", "Klebsiella pneumoniae", ("esbl",), "2025-01-15")]
    out = {"cases": 0, "signals": 0, "mismatches": 0}
    for unit, org, phen, start in cases:
        end = sd.add_days(start, 28)
        recs = [r for r in records if r.sample_date <= end]
        got = det.run(recs, cultures, Focus((unit,), org, phen, None, start, end, None))
        want = [
            s for s in full
            if s.detector in ("profile-excess", "phenotype-excess") and s.ward == unit and start <= s.date <= end and (s.organism == org or (s.phenotype is not None and s.phenotype in phen))
        ]
        got = [s for s in got if s.detector in ("profile-excess", "phenotype-excess") and start <= s.date <= end and (s.organism == org or (s.phenotype is not None and s.phenotype in phen))]
        A, B = sorted(got, key=_key), sorted(want, key=_key)
        out["cases"] += 1
        out["signals"] += len(B)
        if [_key(s) for s in A] != [_key(s) for s in B] or any(abs(x.p - y.p) > 1e-9 * y.p for x, y in zip(A, B, strict=True)):
            out["mismatches"] += 1
    return out


def check_fast_path(st, records, cultures, trials=4) -> dict:
    """Trials through the focused fast path against the same detector forced to run on all the data."""
    fast = make(st)

    class NoFocus(bb.BBTail):
        def run(self, records, cultures, focus=None):
            return super().run(records, cultures, None)

    ref = NoFocus(name="no focus", m=st[0], delta=st[1])
    hf = seed_trials(fast, records, cultures, 2026, ks=(0, 4), trials=trials, gaps=())
    hr = seed_trials(ref, records, cultures, 2026, ks=(0, 4), trials=trials, gaps=())
    clusters = ("profile-excess", "phenotype-excess")
    n = sigs = 0
    bad = {lvl: 0 for lvl in (100, 3, 1)}
    for fam in hf:
        if fam == "gaps":
            continue
        for cell in hf[fam]:
            for a, b in zip(hf[fam][cell], hr[fam][cell], strict=True):
                n += 1
                for lvl in bad:
                    A = sorted((s for s in a.signals if s.detector in clusters and fast.passes(s, lvl)), key=_key)
                    B = sorted((s for s in b.signals if s.detector in clusters and fast.passes(s, lvl)), key=_key)
                    if lvl == 1:
                        sigs += len(A)
                    bad[lvl] += [_key(s) for s in A] != [_key(s) for s in B]
    return {"trials": n, "cluster_signals_at_level_1": sigs, "trials_that_differ_at_level": bad}


# --- the record -----------------------------------------------------------------------------------------------------------


def f3(x) -> str:
    return "-" if x is None else f"{x:.3f}"


def ci(iv) -> str:
    return "" if not iv else f" [{iv[0]:.3f}, {iv[1]:.3f}]"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--trials", type=int, default=200)
    args = ap.parse_args()
    wall0, cpu0 = time.time(), time.process_time()
    records, cultures = harness.data()
    live = make()
    OUT.mkdir(exist_ok=True)

    log("stage 1: tuning year")
    tune = {st: sd.tune_curve(make(st), records, cultures) for st in GRID}
    tune_live = sd.tune_curve(live, records, cultures)
    global TUNE_NOISE
    TUNE_NOISE = next(r for r in tune_live if r["level"] == 1.0)["noise_per_year"]
    log(f"  year-1 noise limit: the live set's {TUNE_NOISE:.2f} a year at level 1")
    pick, pick_row, ranked = choose(tune)
    log(f"  year-1 pick {lab(pick)}: {pick_row}")

    log("stage 2: screening on the scoring period")
    screen = {}
    for st in [None, *GRID]:
        det = live if st is None else make(st)
        t0 = time.process_time()
        m, iv, n, ex = score(det, records, cultures, SCREEN, args.trials)
        screen[st] = {"metrics": m, "intervals": iv, "n": n, "curve": ex["D5_curve"], "extra": ex, "name": det.name}
        log(f"  {det.name}: D5 {m['D5']} ({time.process_time() - t0:.0f} s)")

    log("stage 3: every part for the live set, the year-1 pick and its organism-parent twin")
    full = {}
    for key, det in (("live", live), ("pick", make(pick)), ("pick_org", make(pick, "organism"))):
        t0 = time.process_time()
        m, iv, n, ex = score(det, records, cultures, ("D1", "D2", "D3", "D4", "D5", "D6", "D7", "I1"), args.trials)
        full[key] = {"metrics": m, "intervals": iv, "n": n, "extra": ex, "name": det.name}
        log(f"  {det.name}: D5 {m['D5']} ({time.process_time() - t0:.0f} s)")

    log("stage 4: checks")
    checks = {
        "tail": check_tail(),
        "focus": check_focus(pick, records, cultures),
        "focus_delta_0.95": check_focus((10, 0.95), records, cultures),
        "fast_path": check_fast_path(pick, records, cultures),
        "fast_path_delta_0.95": check_fast_path((10, 0.95), records, cultures),
        "causal": sd.check_causal(make(pick), CAUSAL_CUTS, records, cultures, raise_on_error=False),
        "causal_delta_0.95": sd.check_causal(make((10, 0.95)), CAUSAL_CUTS, records, cultures, raise_on_error=False),
    }
    log(f"  {checks}")

    wall, cpu = time.time() - wall0, time.process_time() - cpu0
    log("stage 5: record")
    live_noise = screen[None]["metrics"]["D5"]["noise"]
    for key, fname in (("live", "metrics-live.json"), ("pick", "metrics.json"), ("pick_org", "metrics-organism-parent.json")):
        r = full[key]
        extra = {k: r["extra"][k] for k in ("D5_curve", "D2_per_seed", "D2_cluster_signals_only", "D3_control", "D4_score_years", "D7_detail", "I1_full_tool", "operating_level", "trial_seeds", "trials_per_seed") if k in r["extra"]}
        extra["settings"] = None if key == "live" else {"m": pick[0], "delta": pick[1], "parent": "stratum" if key == "pick" else "organism"}
        harness.write_metrics(
            OUT / fname, experiment=EXPERIMENT, method=r["name"], family="detection", metrics=r["metrics"], intervals=r["intervals"], n=r["n"],
            runtime_s=wall, cpu_s=cpu, seeds=[2026], tuned_on_test=False, tuned_on=TUNED_ON,
            notes="Live set with the Beta-binomial tail for profile and phenotype excess; setting chosen on year 1 only." if key != "live" else "The live set as shipped, rerun through the same code, levels extended to 1000.",
            **extra,
        )
    grid_json = {
        "tuning_year": {lab(st): rows for st, rows in tune.items()} | {"live": tune_live},
        "pick": {"setting": list(pick), "row": pick_row},
        "screen": {screen[st]["name"]: {"metrics": screen[st]["metrics"], "curve": screen[st]["curve"]} for st in screen},
        "checks": checks,
    }
    (OUT / "grid.json").write_text(json.dumps(harness._clean(grid_json), indent=1) + "\n")
    write_results(OUT / "results.md", locals() | {"wall": wall, "cpu": cpu, "live_noise": live_noise})
    log(f"done, {wall:.0f} s wall, {cpu:.0f} s CPU")


def write_results(path: Path, c: dict) -> None:
    screen, full, tune, tune_live, pick, ranked, checks = c["screen"], c["full"], c["tune"], c["tune_live"], c["pick"], c["ranked"], c["checks"]
    live_curve = screen[None]["curve"]
    live_noise = c["live_noise"]
    L = []
    L.append(f"# 0023 results\n\n{c['args'].trials} trials per cell, seed 2026 only, run {c['wall']:.0f} s wall, {c['cpu']:.0f} s CPU. All measured or computed by `run.py`.\n")
    L.append(f"## Year-1 selection (40 rare + 40 common ESBL clusters of 4; operating row = loosest level with year-1 noise at most the live set's {TUNE_NOISE:.2f} a year at its shipped alphas)\n")
    L.append("| setting | level | noise a year (episodes) | rare hits /40 | common ESBL hits /40 | picked |\n|---|---|---|---|---|---|")
    for st, r in [(None, operating_row(tune_live))] + [(s, operating_row(tune[s])) for s in GRID]:
        if r is None:
            L.append(f"| {'live (Poisson)' if st is None else lab(st)} | none | | | | |")
            continue
        L.append(f"| {'live (Poisson)' if st is None else lab(st)} | {r['level']:g} | {r['noise_per_year']:.2f} ({r['noise_count']}) | {r['rare_hit']} | {r['common_esbl_hit']} | {'yes' if st == pick else ''} |")
    L.append("\n## D5 at the headline (loosest level with noise <= 5 a year), k = 4, scoring period (Wilson 95 %)\n")
    L.append("| row | level | noise a year (episodes) | rare | delay | common ESBL | delay | rare at live noise | common ESBL at live noise | rare at 5 a year | common ESBL at 5 a year |\n|---|---|---|---|---|---|---|---|---|---|---|")
    for st in [None, *GRID]:
        s = screen[st]
        d, iv, n = s["metrics"]["D5"], s["intervals"]["D5"], s["n"]["D5"]
        L.append(
            f"| {s['name']} | {d['level']:g} | {d['noise']:.2f} ({n['noise']}) | {f3(d['rare'])}{ci(iv.get('rare'))} | {d['rare_delay']} | {f3(d['common_esbl'])}{ci(iv.get('common_esbl'))} | {d['common_esbl_delay']} | "
            f"{f3(interp(s['curve'], live_noise, 'rare'))} | {f3(interp(s['curve'], live_noise, 'common_esbl'))} | {f3(interp(s['curve'], 5.0, 'rare'))} | {f3(interp(s['curve'], 5.0, 'common_esbl'))} |"
        )
    L.append("\n## D5 curves (noise a year -> rare / common ESBL at k = 4)\n")
    for st in [None, *GRID]:
        s = screen[st]
        L.append(f"- {s['name']}: " + "; ".join(f"x{r['level']:g}: {r['noise']:.1f} -> {r.get('rare', 0):.2f} / {r.get('common_esbl', 0):.2f}" for r in s["curve"]))
    L.append("\n## Every part, live against the year-1 pick and its organism-parent twin\n")
    names = {k: full[k]["name"] for k in full}
    L.append("| quantity | " + " | ".join(names.values()) + " |\n|---|---|---|---|")
    def row(label, fn):
        L.append(f"| {label} | " + " | ".join(fn(full[k]) for k in ("live", "pick", "pick_org")) + " |")
    row("D5 level", lambda r: f"{r['metrics']['D5']['level']:g}")
    row("D5 noise a year", lambda r: f"{r['metrics']['D5']['noise']:.2f}")
    row("D5 rare (delay)", lambda r: f"{f3(r['metrics']['D5']['rare'])}{ci(r['intervals']['D5'].get('rare'))} ({r['metrics']['D5']['rare_delay']})")
    row("D5 common ESBL (delay)", lambda r: f"{f3(r['metrics']['D5']['common_esbl'])}{ci(r['intervals']['D5'].get('common_esbl'))} ({r['metrics']['D5']['common_esbl_delay']})")
    for fam in ("rare", "common_resistant", "wild_type", "common_esbl", "two_unit"):
        for k in (0, 3, 4):
            row(f"D2 {fam} k={k} (delay)", lambda r, fam=fam, k=k: f"{f3(r['metrics']['D2'][f'{fam}_k{k}'])}{ci(r['intervals']['D2'][f'{fam}_k{k}'])} ({r['metrics']['D2_delay'][f'{fam}_k{k}']})")
    row("D1 E1, E1 corrected, E2, E3, E4", lambda r: ", ".join(str(r["metrics"]["D1"][k]) for k in ("E1", "E1_corrected", "E2", "E3", "E4")))
    row("D4 episodes a year: all, cluster, sentinel, data, trend", lambda r: ", ".join(f"{r['metrics']['D4'][k]:.2f}" for k in ("episodes_per_year", "cluster", "sentinel", "data", "trend")))
    row("D4 alerts a week", lambda r: f"{r['metrics']['D4']['alerts_per_week']:.3f}")
    row("D6", lambda r: f"{r['metrics']['D6']:.3f}")
    row("D7", lambda r: f"{r['metrics']['D7']:.3f}")
    row("I1 alerts / incidents", lambda r: f"{r['metrics']['I1']['alerts']} / {r['metrics']['I1']['incidents']}")
    L.append("\n## Checks\n\n```\n" + json.dumps(checks, indent=1, default=str) + "\n```\n")
    path.write_text("\n".join(L))


if __name__ == "__main__":
    main()
