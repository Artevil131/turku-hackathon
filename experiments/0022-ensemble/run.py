"""Experiment 0022: the year-1 re-tuned live set and the 0016 CUSUM union combined by rank product (primary row) and by a
stacked logistic model trained on year-1 injections only, with union and intersection as references, on D1 to D7 and I1.
Plan: README.md.

    uv run python experiments/0022-ensemble/run.py

Stage 1 builds the components (the re-tuned live set A, the 0016 union B) and runs them once on all the data; the ranks'
background (2024-01-01 to 2024-09-30) is frozen from that run. Stage 2 trains the stack on year-1 injections (200 trials
per family, seed 2026) and year-1 real cell-days. Stage 3 chooses each ensemble's operating level on the tuning year's
noise. Stage 4 scores through `aei.score_detection.score_detector` (seed 2026, 200 trials per cell; the components are run
once per trial and every rule is derived from the same signals). Stage 5 runs the checks; stage 6 writes out/.
The rules are in ensemble.py, the picture in figure.py.
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import ensemble as E  # noqa: E402
import figure  # noqa: E402

from aei import cusum as cs  # noqa: E402
from aei import harness  # noqa: E402
from aei import score_detection as sd  # noqa: E402
from aei.coverage import wilson  # noqa: E402
from aei.dates import add_days, days_between  # noqa: E402
from aei.domain import PHENOTYPES, UNITS  # noqa: E402
from aei.inject import FAMILIES, Focus, _pick_int, base_of, cluster_hits, seed_trials  # noqa: E402
from aei.jscompat import mulberry32  # noqa: E402

OUT = HERE / "out"
BASELINES = harness.ROOT / "benchmarks" / "overnight-2026-10-17" / "baselines"
EXPERIMENT = "0022-ensemble"
TUNED_ON = f"{harness.TUNE[0]}..{harness.TUNE[1]}"
KS = sd.KS
POIS, BERN = (8.0, 7, 0), (8.0, 4)  # 0016's chosen settings
L_B = 72.0682  # 0016's operating run length of the union, years (grid.json calibration.L_sim)
TRIALS = 200
STACK_TRIALS = 200
CAUSAL_CUTS = ["2025-03-31", "2025-12-31", "2026-06-30"]
ALL_PARTS = ("D1", "D2", "D3", "D4", "D5", "D6", "D7", "I1")
LABELS = {
    "rp": "rank product (live set A, CUSUM B, 7-day join)",
    "stack": "stacked logistic (A, B; year-1 injections)",
    "union": "union (min p)",
    "intersection": "intersection (max p)",
    "rp_exact": "rank product, exact-day join (sensitivity)",
}


def log(msg: str) -> None:
    print(msg, file=sys.stderr, flush=True)


def load_baseline(name: str) -> dict:
    return json.loads((BASELINES / f"{name}.json").read_text())


# --- helpers ----------------------------------------------------------------------------------------------------------------


def operating_level(rows: list[dict]) -> float:
    """The loosest level whose tuning-year noise (scaled to a year) is at most 5 episodes a year (the strictest when none is)."""
    row = next((r for r in rows if r["noise_per_year"] <= sd.HEADLINE_NOISE), rows[-1])
    return row["level"]


def at_noise(curve: list[dict], family: str, target: float = 5.0) -> float | None:
    """The D5 rate interpolated linearly in noise at exactly `target` episodes a year between the two bracketing levels
    (harness review finding 12; proposed (overnight), pending Artem); None when the curve does not bracket it."""
    for a, b in zip(curve, curve[1:]):
        if a["noise"] > target >= b["noise"] and family in a and family in b:
            if a["noise"] == b["noise"]:
                return b[family]
            f = (target - b["noise"]) / (a["noise"] - b["noise"])
            return b[family] + f * (a[family] - b[family])
    return None


def at_count(curve: list[dict], family: str, count: int) -> float | None:
    """The D5 rate at `count` noise episodes over the scoring period: the loosest level with exactly that many, else linear in the
    count between the two bracketing levels (computed); None when the curve does not bracket it."""
    exact = [r for r in curve if r["noise_count"] == count and family in r]
    if exact:
        return exact[0][family]
    for a, b in zip(curve, curve[1:]):
        if a["noise_count"] > count > b["noise_count"] and family in a and family in b:
            f = (count - b["noise_count"]) / (a["noise_count"] - b["noise_count"])
            return b[family] + f * (a[family] - b[family])
    return None


def training_stream(det, records, cultures, trials: int, seed: int = 2026, starts=("2024-04-01", "2024-08-15")) -> list:
    """tune_curve's draws (`aei.score_detection.tune_curve`: rare then common ESBL clusters of 4, unit uniform, start uniform over
    `starts`, one mulberry32(seed) stream) extended to `trials` per family, keeping each trial's hits so the stack can read
    the injected cell-days. The detector sees no data after the end of the tuning year."""
    end = harness.TUNE[1]
    recs = [r for r in records if r.sample_date <= end]
    cults = [c for c in cultures if c.sample_date <= end]
    base = base_of(recs, cults)
    rand = mulberry32(seed)
    span = days_between(*starts)
    out, t = [], 0
    for f in ("rare", "common_esbl"):
        for _ in range(trials):
            while True:
                unit = UNITS[_pick_int(rand, len(UNITS))]
                start = add_days(starts[0], _pick_int(rand, span + 1))
                if f == "rare":
                    source = base.sources[_pick_int(rand, len(base.sources))]
                    break
                group = base.common_group(unit, start, "common ESBL E. coli")
                if group:
                    source = group[_pick_int(rand, len(group))]
                    break
            out.append(cluster_hits(det, base, source, [(unit, 4)], start, rand, t, family=f, k=4))
            t += 1
    return out


def stack_rows(hits: list, a_real, b_real) -> tuple[tuple, tuple]:
    """Positive rows: the injected key's cell-days (the source's organism and its phenotypes, in the unit) from the first
    injected isolate to start + 28; negative rows: every real cell-day over STACK_NEG. Each row is (s_A, s_B)."""
    pk_a, pk_b = [], []
    for h in hits:
        a = [s for s in h.signals if s.detector in E.A_NAMES]
        b = [s for s in h.signals if s.detector not in E.A_NAMES]
        mA, mB = E.score_map(a, E.JOIN), E.score_map(b, E.JOIN)
        unit = h.units[0]
        cells = [(unit, "org", h.organism)] + [(unit, "ph", p) for p in h.phenotypes if p in PHENOTYPES]
        keys = [(c, t) for c in cells for t in range(E.ordinal(h.onset), E.ordinal(h.until) + 1)]
        sA, sB, _, _ = E.fields(mA, mB, keys)
        pk_a.append(sA)
        pk_b.append(sB)
    lo, hi = E.ordinal(E.STACK_NEG[0]), E.ordinal(E.STACK_NEG[1])
    mA, mB = E.score_map(a_real, E.JOIN, lo, hi), E.score_map(b_real, E.JOIN, lo, hi)
    keys = [(c, t) for c in E.all_cells() for t in range(lo, hi + 1)]
    nA, nB, _, _ = E.fields(mA, mB, keys)
    return (np.concatenate(pk_a), np.concatenate(pk_b)), (nA, nB)


def score(det, parts, level=None):
    return sd.score_detector(det, parts=parts, trials_per_seed=TRIALS, level=level, records=RECORDS, cultures=CULTURES, verbose=False)


# --- checks -----------------------------------------------------------------------------------------------------------------


def _key(s):
    return (s.date, s.key, s.ward, s.detector)


def check_cache_path(fast_det, ref_det, trials: int = 3) -> dict:
    """The cached, real-data-world trial path against the from-scratch computation (components with `rebuild`, no cache), on
    `trials` trials of every cell of a seed-2026 stream with k in 0 and 4 and every gap setting."""
    hf = seed_trials(fast_det, RECORDS, CULTURES, 2026, ks=(0, 4), trials=trials)
    hr = seed_trials(ref_det, RECORDS, CULTURES, 2026, ks=(0, 4), trials=trials)
    n = sigs = bad = 0
    worst = 0.0
    for fam in hf:
        for cell in hf[fam]:
            for a, b in zip(hf[fam][cell], hr[fam][cell], strict=True):
                n += 1
                A, B = sorted(a.signals, key=_key), sorted(b.signals, key=_key)
                sigs += len(A)
                if [_key(s) for s in A] != [_key(s) for s in B]:
                    bad += 1
                    continue
                for x, y in zip(A, B, strict=True):
                    worst = max(worst, abs(x.p - y.p) / y.p)
    return {"trials": n, "signals": sigs, "trials_that_differ": bad, "max_rel_diff_p": worst}


def check_focus(comps, rule, full_signals) -> dict:
    """Focused ensemble signals against the full run's on the real data, three units and organisms (window of 28 days)."""
    cases = [("URO", "Escherichia coli", ("esbl",), "2025-06-01"), ("ICU", "Staphylococcus aureus", ("mrsa",), "2026-03-01"), ("ED", "Klebsiella pneumoniae", ("esbl",), "2025-01-15")]
    out = {"cases": 0, "mismatches": 0, "signals": 0, "detail": []}
    for unit, org, phen, start in cases:
        end = add_days(start, 28)
        recs = [r for r in RECORDS if r.sample_date <= end]
        cults = [c for c in CULTURES if c.sample_date <= end]
        foc = Focus((unit,), org, phen, None, start, end, None)

        def match(s, unit=unit, org=org, phen=phen, start=start, end=end):
            return s.ward == unit and start <= s.date <= end and (s.organism == org or (s.phenotype is not None and s.phenotype in phen))

        got = [s for s in E.ensemble_signals(comps, rule, E.JOIN, "ensemble_rp", recs, cults, foc) if match(s)]
        want = [s for s in full_signals if match(s)]
        A, B = sorted(got, key=_key), sorted(want, key=_key)
        out["cases"] += 1
        out["signals"] += len(B)
        same = [_key(s) for s in A] == [_key(s) for s in B] and all(abs(x.p - y.p) <= 1e-9 * y.p for x, y in zip(A, B, strict=True))
        if not same:
            out["mismatches"] += 1
        out["detail"].append(f"{unit} {org} {start}: {len(A)} focused, {len(B)} full, {'same' if same else 'differ'}")
    return out


# --- the record -------------------------------------------------------------------------------------------------------------


def f3(x) -> str:
    return "-" if x is None else f"{x:.3f}"


def fi(rate, iv) -> str:
    if rate is None:
        return "-"
    return f"{rate:.3f}" + ("" if not iv else f" [{iv[0]:.3f}, {iv[1]:.3f}]")


def wil(hit, n) -> str:
    lo, hi = wilson(hit, n)
    return f"{hit / n:.3f} [{lo:.3f}, {hi:.3f}]"


def row_md(cells: list[str]) -> str:
    return "| " + " | ".join(cells) + " |"


def table(header: list[str], rows: list[list[str]]) -> list[str]:
    return [row_md(header), row_md(["---"] * len(header))] + [row_md(r) for r in rows]


def lev(x: float) -> str:
    return f"{x:.3g}"


def main() -> None:
    global RECORDS, CULTURES
    clock = harness.Clock()
    OUT.mkdir(exist_ok=True)
    RECORDS, CULTURES = harness.data()
    records, cultures = RECORDS, CULTURES
    deviations: list[str] = []

    log("stage 1: components")
    live, retune_table = sd.retune_live_set(records, cultures, verbose=False)
    ref_row = load_baseline("live-set-retuned-year1")
    shipped_row = load_baseline("live-set-shipped")
    want = ref_row["retuned_alphas"]
    got = {"profile_alpha": live.profile_alpha, "phenotype_alpha": live.phenotype_alpha, "sampling_alpha": live.sampling_alpha, "empty_alpha": live.empty_alpha}
    assert all(math.isclose(got[k], want[k]) for k in got), (got, want)
    cusum_b = cs.Cusum(pois=POIS, bern=BERN)
    comps = E.Components(live, cusum_b)
    a_real, b_real = comps.run(records, cultures, None)
    log(f"  A {len(a_real)} signals, B {len(b_real)} signals on all the data, cpu {clock.cpu:.0f} s")
    bg7, bg1 = E.Background(a_real, b_real, 7), E.Background(a_real, b_real, 1)
    rp, rp1 = E.RankProduct(bg7), E.RankProduct(bg1)

    log("stage 2: the stack's training stream")
    raw = sd.Detector(name="components", run_fn=lambda r, c, f=None: [*comps.run(r, c, f)[0], *comps.run(r, c, f)[1]])
    hits_train = training_stream(raw, records, cultures, STACK_TRIALS)
    pos, neg = stack_rows(hits_train, a_real, b_real)
    stack = E.fit_stack(bg7, pos, neg, l2=1.0)
    fired_pos = int(((pos[0] < 1) | (pos[1] < 1)).sum())
    fired_neg = int(((neg[0] < 1) | (neg[1] < 1)).sum())
    log(f"  stack rows: positives {len(pos[0])} ({fired_pos} with a signal), negatives {len(neg[0])} ({fired_neg}); weights {np.round(stack.w, 3).tolist()} cpu {clock.cpu:.0f} s")

    log("stage 3: operating levels on the tuning year")
    dets = {
        "rp": E.make_detector(comps, rp, "ensemble_rp", E.JOIN, label=LABELS["rp"]),
        "stack": E.make_detector(comps, stack, "ensemble_stack", E.JOIN, label=LABELS["stack"]),
        "union": E.make_detector(comps, E.Union(), "ensemble_union", E.JOIN, label=LABELS["union"]),
        "intersection": E.make_detector(comps, E.Intersection(), "ensemble_intersection", E.JOIN, label=LABELS["intersection"]),
        "rp_exact": E.make_detector(comps, rp1, "ensemble_rp_exact", 1, label=LABELS["rp_exact"]),
    }
    tune = {k: sd.tune_curve(dets[k], records, cultures) for k in ("rp", "stack", "rp_exact", "union", "intersection")}
    op = {k: operating_level(tune[k]) for k in ("rp", "stack", "rp_exact")}
    for k in op:
        dets[k].default_level = op[k]
    log(f"  operating levels {op} cpu {clock.cpu:.0f} s")
    empirical = rp.empirical(E.LEVELS)
    emp_exact = rp1.empirical(E.LEVELS)

    log("stage 4: scoring")
    res: dict[str, tuple] = {}
    res["rp"] = score(dets["rp"], ALL_PARTS, op["rp"])
    log(f"  rank product done cpu {clock.cpu:.0f} s, components run {comps.calls}")
    res["stack"] = score(dets["stack"], ALL_PARTS, op["stack"])
    log(f"  stack done cpu {clock.cpu:.0f} s")
    for k in ("union", "intersection", "rp_exact"):
        res[k] = score(dets[k], ("D5",), op.get(k))
        log(f"  {k} done cpu {clock.cpu:.0f} s")

    log("stage 4a: the same ensembles read at their D5 headline level (a level chosen on the scoring period's noise; extra)")
    head = {}
    for k in ("rp", "stack"):
        lv_h = res[k][0]["D5"]["level"]
        head[k] = (lv_h, score(dets[k], ALL_PARTS, lv_h))
        log(f"  {k} at headline level {lv_h:g} done cpu {clock.cpu:.0f} s")

    log("stage 4b: where the detections come from")
    prov = provenance(comps, dets, op["rp"])

    log("stage 5: checks")
    comps_ref = E.Components(live, cs.Cusum(pois=POIS, bern=BERN, rebuild=True), cache=False)
    checks: dict = {"causal": {}}
    for k, rule in (("rp", rp), ("stack", stack)):
        det_ref = E.make_detector(comps_ref, rule, f"ensemble_{k}")
        checks["causal"][k] = sd.check_causal(det_ref, CAUSAL_CUTS, records, cultures, raise_on_error=False)
    log(f"  causal: {checks['causal']} cpu {clock.cpu:.0f} s")
    det_ref_rp = E.make_detector(comps_ref, rp, "ensemble_rp")
    checks["cache_path"] = check_cache_path(dets["rp"], det_ref_rp)
    full_rp = dets["rp"].run(records, cultures, None)
    checks["focus"] = check_focus(comps, rp, full_rp)
    checks["causal_ok"] = not any(checks["causal"].values())
    log(f"  cache path {checks['cache_path']} focus {checks['focus']['mismatches']} cpu {clock.cpu:.0f} s")
    if not checks["causal_ok"]:
        raise SystemExit("check_causal found differences: " + json.dumps(checks["causal"]))

    log("stage 6: the record")
    wall, cpu = clock.wall, clock.cpu
    ctx = {
        "wall": wall, "cpu": cpu, "res": res, "op": op, "tune": tune, "empirical": empirical, "emp_exact": emp_exact, "stack": stack, "bg7": bg7, "bg1": bg1,
        "ref": ref_row, "shipped": shipped_row, "cusum16": json.loads((harness.ROOT / "experiments" / "0016-cusum" / "out" / "metrics.json").read_text()),
        "prov": prov, "checks": checks, "calls": dict(comps.calls), "paths": dict(cs.PATHS), "train": {"pos": len(pos[0]), "fired_pos": fired_pos, "neg": len(neg[0]), "fired_neg": fired_neg},
        "head": head, "n_a": len(a_real), "n_b": len(b_real), "deviations": deviations, "retuned_alphas": got,
    }
    write_outputs(ctx)
    figure.draw(OUT / "figure.png", a_real, b_real, rp, op["rp"], live, records)
    log(f"done: wall {wall:.0f} s, cpu {cpu:.0f} s")


def provenance(comps, dets, level) -> dict:
    """At k = 4 for rare and common ESBL: of the rank product's detections at its operating level, how many component A alone,
    B alone and both would have given at their own operating levels (A: the re-tuned alphas; B: L = 72.1 years)."""
    live = comps.live
    pb = cs.level_of_years(L_B)
    det_a = E.component_detector(comps, "A", lambda s, lv: live.passes(s, 1.0))
    det_b = E.component_detector(comps, "B", lambda s, lv: s.p is not None and s.p < pb)
    out = {}
    fams = ("rare", "common_esbl")
    h = {n: seed_trials(d, RECORDS, CULTURES, 2026, families=fams, ks=KS, trials=TRIALS, gaps=()) for n, d in (("rp", dets["rp"]), ("A", det_a), ("B", det_b))}
    acc = sd.accept_fn(dets["rp"], level)
    acc_a, acc_b = sd.accept_fn(det_a, 1.0), sd.accept_fn(det_b, 1.0)
    for f in fams:
        for k in KS:
            ens, ta, tb = h["rp"][f][k], h["A"][f][k], h["B"][f][k]
            n_ens = a_only = b_only = both = neither = 0
            a_any = b_any = 0
            for e, a, b in zip(ens, ta, tb, strict=True):
                da, db = a.detected(acc_a), b.detected(acc_b)
                a_any += da
                b_any += db
                if not e.detected(acc):
                    continue
                n_ens += 1
                if da and db:
                    both += 1
                elif da:
                    a_only += 1
                elif db:
                    b_only += 1
                else:
                    neither += 1
            out[f"{f}_k{k}"] = {"trials": len(ens), "ensemble": n_ens, "A_alone": a_only, "B_alone": b_only, "both": both, "neither": neither, "A_any": a_any, "B_any": b_any}
    return out


def metrics_notes(key: str, ctx: dict) -> str:
    lv = ctx["op"].get(key)
    base = {
        "rp": "Rank product of component A (the year-1 re-tuned live set: profile excess, phenotype excess, new-in-unit) and component B (the 0016 CUSUM union, Poisson weekly theta 8 plus Bernoulli theta 8 guard band 4 weeks, equalised mapping); quantile ranks against the real cell-days 2024-01-01 to 2024-09-30, frozen; harness p = RP^2 (1 - 2 ln RP).",
        "stack": "Logistic regression (L2 lambda 1) on -log10 s_A, -log10 s_B and a both-fired indicator, trained on year-1 injections (200 rare + 200 common ESBL clusters of 4, 2024-04-01 to 2024-08-15, seed 2026) and year-1 real cell-days; harness p = upper-tail share of the 2024-01-01 to 2024-09-30 background with the same or a larger linear predictor.",
        "union": "Reference: p = min(s_A, s_B); D5 only.",
        "intersection": "Reference: p = max(s_A, s_B); D5 only.",
        "rp_exact": "Sensitivity: the rank product with an exact-day join (no carry-forward); D5 only.",
    }[key]
    lvl = f" Operating level (loosest with year-1 noise at most 5 a year) p = {lv:.3g}." if lv else ""
    return base + lvl + " Join: cell = unit x organism-or-phenotype, 7-day carry-forward, silent = 1, new-in-unit = 1e-6 (all proposed (overnight), pending Artem). Seed 2026, 200 trials per cell. Plan: experiments/0022-ensemble/README.md."


def write_outputs(ctx: dict) -> None:
    res = ctx["res"]
    names = {"rp": "metrics.json", "stack": "metrics-stack.json", "union": "metrics-union.json", "intersection": "metrics-intersection.json", "rp_exact": "metrics-rp-exact.json"}
    grid: dict = {"operating_levels": ctx["op"], "tune_curves": ctx["tune"], "rank_product_background_tail": ctx["empirical"], "exact_day_background_tail": ctx["emp_exact"], "D5_curves": {}, "provenance": ctx["prov"]}
    for key, fname in names.items():
        m, iv, n, ex = res[key]
        extra = {k: ex[k] for k in ("D5_curve", "D2_per_seed", "D2_cluster_signals_only", "D3_control", "D4_score_years", "D7_detail", "I1_full_tool", "operating_level", "trial_seeds", "trials_per_seed") if k in ex}
        extra["partly_tuned_on_test"] = ["rising-trend", "new-in-unit"]
        extra["D5_at_5_per_year"] = {f: at_noise(ex["D5_curve"], f) for f in ("rare", "common_esbl")}
        grid["D5_curves"][key] = ex["D5_curve"]
        parts_note = "" if key in ("rp", "stack") else " (D5 only)"
        harness.write_metrics(
            OUT / fname, experiment=EXPERIMENT, method=f"{LABELS[key]}{parts_note}", family="detection", metrics=m, intervals=iv, n=n,
            runtime_s=ctx["wall"], cpu_s=ctx["cpu"], seeds=[2026], tuned_on_test=False, tuned_on=TUNED_ON, notes=metrics_notes(key, ctx), **extra,
        )
    for key, (lv_h, (m, iv, n, ex)) in ctx["head"].items():
        extra = {k: ex[k] for k in ("D5_curve", "D2_per_seed", "D2_cluster_signals_only", "D3_control", "D4_score_years", "D7_detail", "I1_full_tool", "operating_level", "trial_seeds", "trials_per_seed") if k in ex}
        harness.write_metrics(
            OUT / f"metrics-{key}-headline.json", experiment=EXPERIMENT, method=f"{LABELS[key]}, read at D5's headline level p = {lv_h:.3g}", family="detection", metrics=m, intervals=iv, n=n,
            runtime_s=ctx["wall"], cpu_s=ctx["cpu"], seeds=[2026], tuned_on_test=True, tuned_on=f"{TUNED_ON}; the reading level is D5's headline (the loosest with at most 5 episodes a year over the scoring period)",
            notes="Extra read of the same detector as metrics.json at the level D5's headline rule picks from the SCORING-period noise curve, so D2, D4, D6, D7 and I1 here are tuned on test (exploratory, for comparison with the reference at its own noise). " + metrics_notes(key, ctx), **extra,
        )
    st = ctx["stack"]
    (OUT / "stack.json").write_text(
        json.dumps(harness._clean({"features": ["-log10 s_A", "-log10 s_B", "both fired"], "intercept": st.w[0], "weights": st.w[1:], "scale": st.scale, "l2": st.l2, "training_rows": ctx["train"], "stream": "tune_curve's draws extended to 200 per family, seed 2026, starts 2024-04-01 to 2024-08-15"}), indent=1) + "\n"
    )
    bg7, bg1 = ctx["bg7"], ctx["bg1"]
    knots = [1e-6, 1e-5, 1e-4, 1e-3, 1e-2, 0.03, 0.1, 0.3, 0.5, 0.9]
    ranks = {
        "background": list(E.BG), "cells": len(E.all_cells()), "cell_days": bg7.N,
        "seven_day_join": {"fired_cell_days_A": len(bg7.fA), "fired_cell_days_B": len(bg7.fB), "knots_s": knots, "q_A": bg7.q("A", np.array(knots)).tolist(), "q_B": bg7.q("B", np.array(knots)).tolist()},
        "exact_day_join": {"fired_cell_days_A": len(bg1.fA), "fired_cell_days_B": len(bg1.fB), "q_A": bg1.q("A", np.array(knots)).tolist(), "q_B": bg1.q("B", np.array(knots)).tolist()},
    }
    (OUT / "ranks.json").write_text(json.dumps(harness._clean(ranks), indent=1) + "\n")
    (OUT / "grid.json").write_text(json.dumps(harness._clean(grid), indent=1) + "\n")
    write_results(OUT / "results.md", ctx)


def write_results(path: Path, ctx: dict) -> None:
    res, op = ctx["res"], ctx["op"]
    ref, shipped, c16 = ctx["ref"], ctx["shipped"], ctx["cusum16"]
    L: list[str] = []
    w = L.append
    w("# 0022 results")
    w("")
    w("Reproduce: `uv run python experiments/0022-ensemble/run.py` (seed 2026 only; every number measured or computed by that run unless said otherwise; baseline and 0016 numbers are read from their committed `metrics.json`).")
    w("")
    w(f"Run time {ctx['wall']:.1f} s (wall).")
    w("")
    w(f"Run time {ctx['cpu']:.1f} s (CPU); budget 10 minutes of CPU, no cut made. Components run {ctx['calls']['run']} times, {ctx['calls']['hit']} cache hits.")
    w("")
    w("## 1. Operating levels, chosen on the tuning year (tune_curve)")
    w("")
    w("`tune_curve`: 40 rare and 40 common ESBL clusters of k = 4 injected 2024-04-01 to 2024-08-15, noise over 2024-04-01 to 2024-09-30 scaled to a year. The operating level is the loosest with noise at most 5 a year. The ranks, weights and ECDF map are frozen at 2024-09-30 and were fitted on the same year, so this noise is in-sample.")
    w("")
    for key in ("rp", "stack", "rp_exact"):
        w(f"**{LABELS[key]}**: operating level p = {lev(op[key])}")
        w("")
        rows = [[lev(r["level"]), f"{r['noise_per_year']:.1f} ({r['noise_count']})", f"{r['rare_hit']}/{r['rare_n']}", f"{r['common_esbl_hit']}/{r['common_esbl_n']}"] for r in ctx["tune"][key]]
        w("\n".join(table(["level p", "noise a year (episodes)", "rare k=4", "common ESBL k=4"], rows)))
        w("")
    w("## 2. The independence null against the background (dependence check)")
    w("")
    w(f"Background: {len(E.all_cells())} cells x 274 days = {ctx['bg7'].N} cell-days, 2024-01-01 to 2024-09-30 (7-day join). Fired cell-days: A {len(ctx['bg7'].fA)}, B {len(ctx['bg7'].fB)}. Analytic p of the rank product is the independence null RP^2 (1 - 2 ln RP); the empirical tail is the share of the background's cell-days with p below the level. Ratio analytic / empirical below 1 means the formula is anti-conservative (more pass than it promises).")
    w("")
    rows = [[lev(r["level"]), str(r["count"]), f"{r['empirical']:.3g}", "-" if r["ratio_analytic_over_empirical"] is None else f"{r['ratio_analytic_over_empirical']:.3g}"] for r in ctx["empirical"]]
    w("\n".join(table(["level p (analytic)", "background cell-days below", "empirical tail", "analytic / empirical"], rows)))
    w("")
    opr = next(r for r in ctx["empirical"] if r["level"] == op["rp"])
    w(f"At the operating level {lev(op['rp'])}: {opr['count']} background cell-days below, empirical tail {opr['empirical']:.3g}, analytic / empirical {'-' if opr['ratio_analytic_over_empirical'] is None else format(opr['ratio_analytic_over_empirical'], '.3g')}.")
    w("")
    st = ctx["stack"]
    w("## 3. The stack")
    w("")
    w(f"Training rows: {ctx['train']['pos']} positives ({ctx['train']['fired_pos']} with a component signal) from 200 rare + 200 common ESBL injected clusters of 4 (2024-04-01 to 2024-08-15; seed 2026), {ctx['train']['neg']} negatives ({ctx['train']['fired_neg']} with a component signal), the real cell-days 2024-04-01 to 2024-09-30. L2 lambda = {st.l2:g} on the slopes, intercept free. Features scaled by their standard deviation over the training rows.")
    w("")
    rows = [["intercept", f"{st.w[0]:.3f}", "-"]] + [[n, f"{wt:.3f}", f"{sc:.3g}"] for n, wt, sc in zip(["-log10 s_A", "-log10 s_B", "both fired"], st.w[1:], st.scale)]
    w("\n".join(table(["term", "weight", "scale (sd)"], rows)))
    w("")
    w("## 4. D5, the headline at 5 episodes a year (k = 4, Wilson 95 %)")
    w("")
    w("Rows read at their loosest level with noise at most 5 a year (cluster and sentinel signals only, Choices 3). 'At 5 a year' is the rate interpolated linearly in noise between the two bracketing levels (harness review finding 12; proposed (overnight), pending Artem), computed from the curve.")
    w("")
    c16 = {"metrics": c16["metrics"], "intervals": c16["intervals"], "n": c16["n"], "D5_curve": c16["D5_curve"]}
    rows_all = {
        "live re-tuned year 1 (reference)": ref,
        "live shipped (tuned on test)": shipped,
        "CUSUM union 0016": c16,
    }
    rows = []
    for nm, r in {**rows_all, **{LABELS[k]: {"metrics": res[k][0], "intervals": res[k][1], "n": res[k][2], "D5_curve": res[k][3]["D5_curve"]} for k in ("rp", "stack", "union", "intersection", "rp_exact")}}.items():
        d5, iv = r["metrics"]["D5"], r["intervals"]["D5"]
        curve = r["D5_curve"]
        rows.append([
            nm, lev(d5["level"]), f"{d5['noise']:.2f} ({r['n']['D5']['noise']})", fi(d5.get("rare"), iv.get("rare")), f3(at_noise(curve, "rare")), fi(d5.get("common_esbl"), iv.get("common_esbl")),
            f3(at_noise(curve, "common_esbl")), f"{d5.get('rare_delay')} / {d5.get('common_esbl_delay')}",
        ])
    w("\n".join(table(["row", "level", "noise a year (episodes)", "rare", "rare at 5/yr", "common ESBL", "common ESBL at 5/yr", "delay rare / common"], rows)))
    w("")
    w("Reference levels are multiples of the live alphas (profile 1e-3, phenotype 1e-2 at multiple 1), 0016's a per-series run length as a p, the ensembles' a p of the rule.")
    w("")
    w("**D5 at fixed numbers of noise episodes over the scoring period** (3, 6 and 10 episodes = 1.5, 3.0 and 5.0 a year; the loosest level with exactly that count, else linear in the count between the bracketing levels, computed; no interval, the curve's intervals are in section 5).")
    w("")
    rows = []
    for nm, r in {**rows_all, **{LABELS[k]: {"D5_curve": res[k][3]["D5_curve"]} for k in ("rp", "stack", "union", "intersection", "rp_exact")}}.items():
        rows.append([nm] + [f3(at_count(r["D5_curve"], f, c)) for c in (3, 6, 10) for f in ("rare", "common_esbl")])
    w("\n".join(table(["row", "rare at 1.5/yr", "common ESBL at 1.5/yr", "rare at 3.0/yr", "common ESBL at 3.0/yr", "rare at 5.0/yr", "common ESBL at 5.0/yr"], rows)))
    w("")
    w("## 5. D5 curves (rates at k = 4 per level)")
    w("")
    for key in ("rp", "stack", "union", "intersection", "rp_exact"):
        w(f"**{LABELS[key]}**")
        w("")
        rows = []
        for r in res[key][3]["D5_curve"]:
            rows.append([lev(r["level"]), f"{r['noise']:.2f} ({r['noise_count']})", wil(r["rare_hit"], r["rare_n"]), wil(r["common_esbl_hit"], r["common_esbl_n"])] + [f"{r[f]:.3f}" for f in ("common_resistant", "wild_type", "two_unit") if f in r])
        w("\n".join(table(["level p", "noise a year (episodes)", "rare", "common ESBL", "common resistant", "wild type", "two unit"], rows)))
        w("")
    w("Reference curve (`live-set-retuned-year1`, level = multiple of the live alphas):")
    w("")
    rows = [[f"{r['level']:g}", f"{r['noise']:.2f} ({r['noise_count']})", wil(r["rare_hit"], r["rare_n"]), wil(r["common_esbl_hit"], r["common_esbl_n"])] for r in ref["D5_curve"]]
    w("\n".join(table(["multiple", "noise a year (episodes)", "rare", "common ESBL"], rows)))
    w("")
    w("## 6. D2 at the operating level (200 trials per cell; Wilson 95 %; median delay in days)")
    w("")
    full = {"live re-tuned (level 1)": ref, "0016 union (L = 72.1 y)": c16, "rank product": {"metrics": res["rp"][0], "intervals": res["rp"][1]}, "stack": {"metrics": res["stack"][0], "intervals": res["stack"][1]}}
    for f in FAMILIES:
        body = []
        for k in KS:
            key = f"{f}_k{k}"
            cells = [str(k)]
            for nm, r in full.items():
                m, iv = r["metrics"], r["intervals"]
                dl = m["D2_delay"].get(key)
                cells.append(f"{fi(m['D2'].get(key), iv['D2'].get(key))}, {'-' if dl is None else dl} d")
            body.append(cells)
        w(f"**{f}**")
        w("")
        w("\n".join(table(["k"] + list(full), body)))
        w("")
    w("## 7. D3, D4, D6, D7, I1, D1 at the operating level")
    w("")
    w("D3 is 0 by construction for the ensembles (no data-kind signals; the live set's data rules are left out of A, as D5's noise leaves them out).")
    w("")
    rows = []
    for nm, r in full.items():
        m, iv = r["metrics"], r["intervals"]
        d4, d4i = m["D4"], iv["D4"]
        i1 = m["I1"]
        rows.append([
            nm, fi(d4["episodes_per_year"], d4i["episodes_per_year"]), fi(d4["cluster"], d4i["cluster"]), fi(d4["sentinel"], d4i["sentinel"]), fi(d4["data"], d4i["data"]), f"{d4['alerts_per_week']:.3f}",
            fi(m["D6"], iv.get("D6")), fi(m["D7"], iv.get("D7")), f"{i1['alerts']} / {i1['incidents']} / {f3(i1['alerts_per_incident'])}",
        ])
    w("\n".join(table(["row", "D4 all (episodes a year)", "cluster", "sentinel", "data", "alerts a week", "D6", "D7", "I1 alerts / incidents / per incident"], rows)))
    w("")
    rows = [[nm, json.dumps(r["metrics"]["D1"]), json.dumps(r["metrics"].get("D3"))] for nm, r in full.items()]
    w("\n".join(table(["row", "D1 (days; E4 a date)", "D3"], rows)))
    w("")
    w("**The same ensembles read at D5's headline level** (extra, `metrics-rp-headline.json` and `metrics-stack-headline.json`; the level is the loosest with at most 5 episodes a year over the SCORING period, so these reads are tuned on test and exploratory; the reference at its own headline level, multiple 0.3, is in section 5).")
    w("")
    rows = []
    for key, (lv_h, (m, iv, n, ex)) in ctx["head"].items():
        d4, d4i, i1 = m["D4"], iv["D4"], m["I1"]
        row = [LABELS[key], lev(lv_h), fi(d4["episodes_per_year"], d4i["episodes_per_year"])]
        row += [fi(m["D2"].get(f"{f}_k4"), iv["D2"].get(f"{f}_k4")) for f in ("rare", "common_esbl", "two_unit", "common_resistant", "wild_type")]
        row += [fi(m["D2"].get("rare_k3"), iv["D2"].get("rare_k3")), fi(m["D2"].get("common_esbl_k3"), iv["D2"].get("common_esbl_k3"))]
        row += [fi(m["D6"], iv.get("D6")), fi(m["D7"], iv.get("D7")), f"{i1['alerts']} / {i1['incidents']} / {f3(i1['alerts_per_incident'])}"]
        rows.append(row)
    w("\n".join(table(["row", "level p", "D4 episodes a year", "rare k=4", "common ESBL k=4", "two unit k=4", "common resistant k=4", "wild type k=4", "rare k=3", "common ESBL k=3", "D6", "D7", "I1"], rows)))
    w("")
    w("## 8. Where the rank product's detections come from (k = 4 and the other k, 200 trials per cell)")
    w("")
    w(f"At the rank product's operating level (p = {lev(op['rp'])}); component A alone = the re-tuned live set at its own level 1, B alone = 0016's union at L = 72.1 years. 'neither' = the rank product detected through the join although neither component was detected at its own operating level. 'A any' and 'B any' count every trial the component detects at its own level, whatever the ensemble does.")
    w("")
    rows = []
    for key, v in ctx["prov"].items():
        rows.append([key, f"{v['ensemble']}/{v['trials']}", str(v["A_alone"]), str(v["B_alone"]), str(v["both"]), str(v["neither"]), str(v["A_any"]), str(v["B_any"])])
    w("\n".join(table(["cell", "rank product detected", "A alone", "B alone", "both", "neither", "A any", "B any"], rows)))
    w("")
    w("## 9. Checks")
    w("")
    ck = ctx["checks"]
    for k, probs in ck["causal"].items():
        w(f"- `check_causal` on the whole {k} ensemble (components rebuilt from the rows given), cuts {', '.join(CAUSAL_CUTS)}: {'no differences' if not probs else '; '.join(probs)}.")
    cp = ck["cache_path"]
    w(f"- Cached trial path against the from-scratch computation (components with `rebuild`): {cp['trials']} trials, {cp['signals']} signals, {cp['trials_that_differ']} trials differ (max relative difference in p {cp['max_rel_diff_p']:.2e}).")
    fo = ck["focus"]
    w(f"- Focused against full ensemble signals on the real data: {fo['cases']} cases, {fo['signals']} signals, {fo['mismatches']} mismatches ({'; '.join(fo['detail'])}).")
    w(f"- Component signals on all the data: A {ctx['n_a']}, B {ctx['n_b']}. Runs of B by the way the world was obtained: {ctx['paths']['fast']} fast, {ctx['paths']['rebuild']} rebuilt, {ctx['paths']['slow']} slow fallback.")
    w("")
    path.write_text("\n".join(L) + "\n")


if __name__ == "__main__":
    main()
