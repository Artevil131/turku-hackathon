"""Experiment 0019: does exposure on the time-ordered patient-flow graph rank the units where a phenotype appears next?
P1 of benchmarks/METRICS.md over many real ESBL *E. coli* and MRSA episodes, against label-permutation nulls, with
flow-partner (B1, positive control) and uniform-partner (B2, negative control) injections. Plan and formulas: README.md.

    uv run python experiments/0019-exposure-ranking/run.py

Version A (the test): source episodes found from the data (`episodes.py`) with onset in the scoring period and 56 days
of data after it, each scored by `aei.score_prediction.score_exposure` (1,000 permutations, seed 2026), pooled by
within-event Mann-Whitney pairs (`pooling.py`). E1 and E2 alone as descriptions. Version B: 200 injected two-unit
trials per cell (`controls.py`). Writes out/results.md, out/metrics.json and out/figure.png. Injection seed 2026 only.
"""

from __future__ import annotations

import json
import sys
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import controls  # noqa: E402
import figure  # noqa: E402
import pooling  # noqa: E402
from episodes import find_episodes  # noqa: E402

from aei import harness  # noqa: E402
from aei import score_prediction as sp  # noqa: E402
from aei.dates import add_days  # noqa: E402
from aei.domain import UNITS  # noqa: E402
from aei.inject import clones  # noqa: E402
from aei.jscompat import mulberry32  # noqa: E402

OUT = HERE / "out"
BASELINES = harness.ROOT / "benchmarks" / "overnight-2026-10-17" / "baselines"
SEED = 2026
N_NULL_A = 1000  # version A permutations (the plan's cut 4 would make it 500)
N_NULL_B = 200  # per control trial (cut 1 would make it 100)
TRIALS = 200  # per cell (cut 2: 100)
KS = (4, 6)  # (cut 3: drop 4)
PHENOS = {"ESBL E. coli": sp.E1_FILTER, "MRSA": sp.E2_FILTER}
# Planted events as harness-spec.md Choices 4 has them: (unit, phenotype, first day, last day of the zone).
PLANTED = {"E1": ("URO", "ESBL E. coli", "2025-05-30", "2025-08-31"), "E2": ("ICU", "MRSA", "2026-03-01", "2026-04-30")}
WARD_NAMES = {r.ward_code: (r.ward_fi, r.ward_en) for r in pd.read_csv(harness.DATA / "wards.csv").itertuples()}
PLANTED_CELLS = "without E1, E2 and their units' cells"  # also the planted unit left out of the ranking where its zone touches the window
ROWS = (("share", "a05"), ("raw", "a05"), ("share", "a001"), ("raw", "a001"))


@dataclass
class Event:
    number: int
    phenotype: str
    unit: str
    onset: str
    flt: dict
    weeks_fired: int = 0
    current: int = 0
    baseline: int = 0
    p_rule: float = float("nan")
    planted: str = ""  # "E1", "E2" or ""


# ---------------------------------------------------------------------------------------------------------------------
# One event
# ---------------------------------------------------------------------------------------------------------------------


CUTS = ("2025-03-01", "2025-09-01", "2026-03-01")


def check_causal_episodes(records, name, ok, full, first_data: str) -> None:
    """The episode rule is causal: on the data cut at a date the episodes (unit, onset, p) are those of all the data with
    onset up to that date. Raises AssertionError otherwise."""
    for cut in CUTS:
        part = find_episodes([r for r in records if r.sample_date <= cut], name, ok, first_data=first_data, last_data=cut)
        a = sorted((e.unit, e.onset, round(e.p, 12)) for e in full if e.onset <= cut)
        b = sorted((e.unit, e.onset, round(e.p, 12)) for e in part)
        assert a == b, (name, cut, a, b)


def new_finds_filter(ok, known: set[str], onset: str):
    """The new-finds outcome as a record predicate: a record passes `ok`, and from the onset on its patient was not
    already found with the phenotype before it. Records before the onset all pass, so the 26-week baseline is the
    harness's; only a known carrier sampled again in a unit after the onset stops counting there."""
    return lambda r: ok(r) and (r.sample_date < onset or r.patient_id not in known)


def score_event(ev: Event, cultures, records) -> dict:
    """Everything one event needs: the harness's `score_exposure` for the harness outcome and for the new-finds outcome,
    and the null of the excess correlation (same permutations as `score_exposure`, same seed) for its average."""
    ok = sp._predicate(ev.flt)
    res = sp.score_exposure(cultures, records, ev.unit, ev.onset, ev.flt, n_null=N_NULL_A, seed=SEED)
    known = {r.patient_id for r in records if ok(r) and r.sample_date < ev.onset}
    res_new = sp.score_exposure(cultures, records, ev.unit, ev.onset, new_finds_filter(ok, known, ev.onset), n_null=N_NULL_A, seed=SEED)
    # The null of the excess correlation, from the harness's own setup and permutations; score_exposure reports only its p.
    st = sp._setup(cultures, records, ev.unit, ev.onset, ev.flt, sp.ALPHAS, sp.FLOW_DAYS, UNITS)
    null_share, null_raw = sp._null_exposures(st, N_NULL_A, SEED)
    first = st.outcome[0.05]
    excess = ((first["observed"] + 0.5) / first["expected"]).to_numpy()[st.others]
    corr_null = {"share": sp.rank_corr(null_share, excess), "raw": sp.rank_corr(null_raw, excess)}
    # A diagnostic for the excess correlation: the null keeps each unit's volume of culture rows, so how do the
    # continuous excess, the real exposure and the rewired exposure each follow that volume?
    vol = np.bincount(st.rows.unit, minlength=len(UNITS))[st.others].astype(float)
    obs = st.observed.iloc[st.others]
    volume = {
        "excess": sp.rank_corr(excess, vol),
        "raw_real": sp.rank_corr(obs["raw"].to_numpy(), vol),
        "raw_null": float(np.nanmean(sp.rank_corr(null_raw, vol))),
        "share_real": sp.rank_corr(obs["share"].to_numpy(), vol),
        "share_null": float(np.nanmean(sp.rank_corr(null_share, vol))),
    }
    for name in ("share", "raw"):  # the same permutations: the p-values must be the harness's
        p = sp._p_upper(corr_null[name], res.excess_corr[name])
        assert abs(p - res.excess_corr[f"p_{name}"]) < 1e-12, (ev, name, p, res.excess_corr)
    return {"event": ev, "res": res, "res_new": res_new, "corr_null": corr_null, "volume": volume, "null_share": null_share, "null_raw": null_raw, "others": st.others}


def event_auc(r: dict, outcome: str, alpha: str, exposure: str, drop: str | None = None) -> pooling.EventAuc:
    """One event's AUC for an exposure and an outcome, from the harness's arrays. With `drop`, a unit left out of the
    ranking (its exposure, outcome and null column), the AUC recomputed by the harness's `auc`."""
    res = r["res" if outcome == "harness" else "res_new"]
    d = res.null[alpha]
    key = f"{r['event'].number}"
    if drop is None:
        return pooling.EventAuc(key, d["positives"], d["units"] - d["positives"], d[f"auc_{exposure}"], d[f"null_{exposure}"])
    others = r["others"]
    keep = np.array([UNITS[i] != drop for i in others])
    y = res.table[f"positive_{alpha}"].to_numpy()[others][keep]
    n_pos, n_neg = int(y.sum()), int((~y).sum())
    if n_pos == 0 or n_neg == 0:
        return pooling.EventAuc(key, n_pos, n_neg, float("nan"), np.zeros(0))
    obs = res.table[exposure].to_numpy()[others][keep]
    return pooling.EventAuc(key, n_pos, n_neg, float(sp.auc(obs, y)), sp.auc(r[f"null_{exposure}"][:, keep], y))


def planted_drop(ev: Event) -> str | None:
    """The planted event's unit whose counts are not the source's story for this event: a planted zone of the same
    phenotype that overlaps the event's baseline or outcome window (onset - 182 to onset + 55), in a unit other than
    the source."""
    lo, hi = add_days(ev.onset, -7 * sp.BASELINE_WEEKS), add_days(ev.onset, 7 * sp.HORIZON_WEEKS - 1)
    for u, ph, a, b in PLANTED.values():
        if ev.phenotype == ph and ev.unit != u and a <= hi and lo <= b:
            return u
    return None


# ---------------------------------------------------------------------------------------------------------------------
# Pools
# ---------------------------------------------------------------------------------------------------------------------


def pool_set(results: list[dict], outcome: str = "harness", drop_planted: bool = False) -> dict[str, dict]:
    return {
        f"{ex}_{al}": pooling.pooled([event_auc(r, outcome, al, ex, planted_drop(r["event"]) if drop_planted else None) for r in results])
        for ex, al in ROWS
    }


def corr_pool(results: list[dict]) -> dict[str, dict]:
    return {ex: pooling.mean_corr([r["res"].excess_corr[ex] for r in results], [r["corr_null"][ex] for r in results]) for ex in ("share", "raw")}


def subsets(results: list[dict]) -> dict[str, list[dict]]:
    return {
        "all": results,
        "ESBL E. coli": [r for r in results if r["event"].phenotype == "ESBL E. coli"],
        "MRSA": [r for r in results if r["event"].phenotype == "MRSA"],
        "without E1 and E2": [r for r in results if not r["event"].planted],
        PLANTED_CELLS: [r for r in results if not r["event"].planted],
    }


def row_dict(r: dict) -> dict:
    """The per-event record for metrics.json and the tables."""
    ev, res, new = r["event"], r["res"], r["res_new"]
    tab = res.table
    units = []
    for u in UNITS:
        if u == ev.unit:
            continue
        row = tab.loc[u]
        units.append(
            {
                "unit": u,
                "share": float(row["share"]),
                "raw": float(row["raw"]),
                "baseline_patients": int(row["baseline_patients"]),
                "patients": int(row["patients"]),
                "expected": float(row["expected"]),
                "p_a05": float(row["p_a05"]),
                "positive_a05": bool(row["positive_a05"]),
                "p_a001": float(row["p_a001"]),
                "positive_a001": bool(row["positive_a001"]),
                "patients_new_finds": int(new.table.loc[u, "patients"]),
                "positive_new_a05": bool(new.table.loc[u, "positive_a05"]),
            }
        )
    return {
        "number": ev.number,
        "phenotype": ev.phenotype,
        "unit": ev.unit,
        "onset": ev.onset,
        "planted": ev.planted or None,
        "weeks_fired": ev.weeks_fired,
        "patients_4wk_at_onset": ev.current,
        "baseline_patients_26wk": ev.baseline,
        "metrics": res.metrics["P1"],
        "new_finds": new.metrics["P1"],
        "excess_corr": res.excess_corr,
        "units": units,
    }


# ---------------------------------------------------------------------------------------------------------------------
# Controls
# ---------------------------------------------------------------------------------------------------------------------


def control_stats(rows: list[dict]) -> dict:
    """Pooled AUC (within-trial pairs), the share of trials with rewiring p < 0.05 and the rest of the plan's list."""
    out: dict = {"trials": len(rows)}
    defined = [r for r in rows if 0 < r["positives"] < 8]
    out["trials_with_auc"] = len(defined)
    for ex in ("share", "raw"):
        evs = [pooling.EventAuc(str(r["trial"]), r["positives"], 8 - r["positives"], r[f"auc_{ex}"], r[f"_null_{ex}"]) for r in rows]
        out[f"pooled_{ex}"] = pooling.pooled(evs)
        ps = np.array([r[f"p_{ex}"] for r in defined], dtype=float)
        out[f"share_p05_{ex}_of_defined"] = float(np.mean(ps < 0.05)) if len(ps) else None
        out[f"share_p05_{ex}_of_all"] = float(np.sum(ps < 0.05) / len(rows)) if rows else None
        out[f"b_mean_rank_{ex}"] = float(np.mean([r[f"rank_{ex}"] for r in rows])) if rows else None
        # AUC of B alone against the seven others, whatever the outcome: (8 - rank of B) / 7, averaged over trials
        out[f"b_only_auc_{ex}"] = float(np.mean([(8 - r[f"rank_{ex}"]) / 7 for r in rows])) if rows else None
    out["share_single_positive"] = float(np.mean([r["positives"] == 1 for r in defined])) if defined else None
    for ex in ("share", "raw"):
        multi = [r[f"p_{ex}"] for r in defined if r["positives"] >= 2]
        out[f"share_p05_{ex}_multi_positive"] = float(np.mean(np.array(multi) < 0.05)) if multi else None
    out["share_b_positive"] = float(np.mean([r["b_positive"] for r in rows])) if rows else None
    out["mean_positives_a05"] = float(np.mean([r["positives"] for r in rows])) if rows else None
    return out


def run_controls(data: controls.Data, cultures) -> dict[str, list[dict]]:
    flows = controls.Flows(cultures)
    sources = clones(data.records)
    rand = mulberry32(SEED)  # one stream for all four cells, in this order
    trials: dict[str, list[dict]] = {}
    index = 0
    for control in ("B1", "B2"):
        for k in KS:
            drawn = []
            for _ in range(TRIALS):
                drawn.append(controls.draw_trial(control, k, index, rand, sources, flows))
                index += 1
            trials[f"{control}_k{k}"] = [controls.score_trial(t, data, N_NULL_B, SEED) for t in drawn]
    return trials


# ---------------------------------------------------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------------------------------------------------


def main() -> None:
    clock = harness.Clock()
    records, cultures = harness.data()
    first_data, last_data = min(r.sample_date for r in records), max(r.sample_date for r in records)

    # --- version A: episodes ----------------------------------------------------------------------------------------
    all_eps = []
    for name, flt in PHENOS.items():
        ok = sp._predicate(flt)
        found = find_episodes(records, name, ok, first_data=first_data, last_data=last_data)
        check_causal_episodes(records, name, ok, found, first_data)
        all_eps += [(e, flt) for e in found]
    all_eps.sort(key=lambda x: (x[0].onset, x[0].unit, x[0].phenotype))
    last_onset = add_days(last_data, -(7 * sp.HORIZON_WEEKS - 1))
    in_score = [(e, flt) for e, flt in all_eps if harness.SCORE[0] <= e.onset <= harness.SCORE[1] and e.onset <= last_onset]
    events: list[Event] = []
    for i, (e, flt) in enumerate(in_score, 1):
        planted = next((k for k, (u, ph, a, b) in PLANTED.items() if e.unit == u and e.phenotype == ph and a <= e.onset <= b), "")
        events.append(Event(i, e.phenotype, e.unit, e.onset, flt, e.weeks_fired, e.current, e.baseline, e.p, planted))
    results = [score_event(ev, cultures, records) for ev in events]
    rows = [row_dict(r) for r in results]

    pools = {name: pool_set(sub, "harness", name == PLANTED_CELLS) for name, sub in subsets(results).items()}
    pools_new = {name: pool_set(sub, "new_finds", name == PLANTED_CELLS) for name, sub in subsets(results).items()}
    corrs = {name: corr_pool(sub) for name, sub in subsets(results).items() if name != PLANTED_CELLS}
    volume = {k: float(np.nanmean([r["volume"][k] for r in results])) for k in results[0]["volume"]}

    # --- E1 and E2 as descriptions ------------------------------------------------------------------------------------
    planted_results = {}
    for key, spec in sp.EVENTS.items():
        ev = Event(0, "ESBL E. coli" if key == "E1" else "MRSA", spec["source"], spec["onset"], spec["flt"], planted=key)
        planted_results[key] = score_event(ev, cultures, records)
    planted_rows = {k: row_dict(v) for k, v in planted_results.items()}
    base = json.loads((BASELINES / "exposure-e1.json").read_text())
    e1 = planted_results["E1"]["res"]
    e1_matches = bool(
        e1.metrics["P1"]["positives_a05"] == base["metrics"]["P1"]["positives_a05"]
        and all(
            abs(float(e1.table.loc[u["unit"], "share"]) - u["share"]) < 5e-5 and abs(float(e1.table.loc[u["unit"], "raw"]) - u["raw"]) < 5e-5
            for u in base["detail"]["units"]
            if u["share"] is not None
        )
        and all(abs(e1.excess_corr[k] - base["detail"]["excess_corr"][k]) < 5e-6 for k in ("share", "raw", "p_share", "p_raw"))
    )

    # --- version B: controls ---------------------------------------------------------------------------------------------
    data = controls.Data(records, cultures)
    trials = run_controls(data, cultures)
    ctl: dict = {}
    for control in ("B1", "B2"):
        cells = {f"k{k}": control_stats(trials[f"{control}_k{k}"]) for k in KS}
        every = [t for k in KS for t in trials[f"{control}_k{k}"]]
        cells["all"] = control_stats(every)
        cells["clean"] = control_stats([t for t in every if not t["contaminated"] and not t["truncated"]])
        cells["contaminated_trials"] = sum(t["contaminated"] for t in every)
        cells["truncated_trials"] = sum(t["truncated"] for t in every)
        cells["trials_total"] = len(every)
        ctl[control] = cells

    # --- figure ---------------------------------------------------------------------------------------------------
    e1r = planted_results["E1"]
    q = np.percentile(e1r["null_share"], [2.5, 97.5], axis=0)
    order = sorted(range(len(e1r["others"])), key=lambda j: -float(e1r["res"].table.loc[UNITS[e1r["others"][j]], "share"]))
    fig_rows = []
    for j in order:
        u = UNITS[e1r["others"][j]]
        t = e1r["res"].table.loc[u]
        fig_rows.append(
            {
                "unit_fi": WARD_NAMES[u][0],
                "unit_en": WARD_NAMES[u][1],
                "share": float(t["share"]),
                "raw": float(t["raw"]),
                "lo": float(q[0, j]),
                "hi": float(q[1, j]),
                "observed": int(t["patients"]),
                "expected": float(t["expected"]),
                "positive": bool(t["positive_a05"]),
            }
        )
    fig_pos = e1r["res"].metrics["P1"]["positives_a05"]
    figure.draw(
        OUT / "figure.png",
        rows=fig_rows,
        source_fi=WARD_NAMES["URO"][0],
        source_en=WARD_NAMES["URO"][1],
        n_null=N_NULL_A,
        onset=sp.EVENTS["E1"]["onset"],
        caption=f"Kokeellinen luonnos / exploratory sketch · E1, vain yksi tapaus / one event only · positiivisia / positives: {fig_pos} · 0019",
    )

    # --- outputs ----------------------------------------------------------------------------------------------------
    cpu, wall = clock.cpu, clock.wall
    write_results(OUT / "results.md", events, rows, pools, pools_new, corrs, volume, planted_rows, e1_matches, ctl, all_eps, last_data, last_onset, cpu)
    main_pool = pools["all"]
    ci = {k: [v["boot_lo"], v["boot_hi"]] for k, v in main_pool.items() if v["boot_lo"] is not None}
    ci = {f"auc_{k}": v for k, v in ci.items()}
    metrics_p1 = {
        "auc_share_a05": main_pool["share_a05"]["auc"],
        "auc_raw_a05": main_pool["raw_a05"]["auc"],
        "auc_share_a001": main_pool["share_a001"]["auc"],
        "auc_raw_a001": main_pool["raw_a001"]["auc"],
        "null_p_share_a05": main_pool["share_a05"]["p"],
        "null_p_raw_a05": main_pool["raw_a05"]["p"],
        "positives_a05": main_pool["share_a05"]["positives"],
        "positives_a001": main_pool["share_a001"]["positives"],
    }
    n_p1 = {
        "events": len(events),
        "events_with_positive_and_negative_a05": main_pool["share_a05"]["events"],
        "events_with_positive_and_negative_a001": main_pool["share_a001"]["events"],
        "units_ranked": 8,
        "pairs_a05": main_pool["share_a05"]["pairs"],
        "pairs_a001": main_pool["share_a001"]["pairs"],
        "positives": main_pool["share_a05"]["positives"],
        "replicates": N_NULL_A,
    }
    variants = {
        "harness_outcome_by_subset": pools,
        "new_finds_outcome_by_subset": pools_new,
        "excess_corr_by_subset": corrs,
        "volume_diagnostic_mean_rank_corr_over_events": volume,
    }
    harness.write_metrics(
        OUT / "metrics.json",
        experiment="0019-exposure-ranking",
        method=(
            "Exposure ranking on the time-ordered patient-flow graph (P1) over real ESBL E. coli and MRSA source episodes of the scoring period, "
            "pooled by within-event Mann-Whitney pairs against 1,000 label-permutation rewirings; E1 and E2 as descriptions; flow-partner (B1, positive) "
            "and uniform-partner (B2, negative) injected two-unit clusters as controls"
        ),
        family="prediction",
        metrics={"P1": metrics_p1},
        intervals={"P1": ci},
        n={"P1": n_p1},
        runtime_s=wall,
        cpu_s=cpu,
        seeds=[SEED],
        tuned_on_test=False,
        tuned_on="none (no fitted parameters)",
        notes=(
            "metrics.P1 is the pooled version-A test, harness outcome (Poisson upper tail, alpha 0.05 and 0.001), over the source episodes of the plan's rule "
            "with onset in 2024-10-01 to 2026-09-27 and 56 days of data after it; a pooled AUC at alpha 0.001 rests on the events with a positive unit. "
            "Intervals are 95 % bootstrap over events (1,000 resamples, seed 2026), an addition of the run; the rewiring null band and p-values are in "
            "P1_variants. One planted event (P1_planted) is a description, not a claim. P1_controls are controls, not evidence about flow: B1 draws its partner "
            "by the flows exposure reads, B2 is independent of flow. Injection seed 2026 only."
        ),
        P1_events=rows,
        P1_variants=variants,
        P1_planted=planted_rows,
        P1_controls=ctl,
        episode_rule={"current_weeks": 4, "baseline_weeks": 26, "alpha": 0.05, "min_patients": 2, "merge_days": 28},
        e1_reproduces_baseline_row=e1_matches,
    )
    print(f"0019: {len(events)} events, pooled AUC share {f(main_pool['share_a05']['auc'])} raw {f(main_pool['raw_a05']['auc'])} (a05), CPU {cpu:.1f} s")


# ---------------------------------------------------------------------------------------------------------------------
# results.md
# ---------------------------------------------------------------------------------------------------------------------


def f(x, nd=3) -> str:
    return "–" if x is None or (isinstance(x, float) and np.isnan(x)) else f"{x:.{nd}f}"


def interval(lo, hi) -> str:
    return "–" if lo is None else f"{lo:.2f} to {hi:.2f}"


def md_table(header: list[str], rows: list[list]) -> list[str]:
    out = ["| " + " | ".join(header) + " |", "|" + "|".join("---" for _ in header) + "|"]
    out += ["| " + " | ".join(str(c) for c in r) + " |" for r in rows]
    return out


def yes(b: bool) -> str:
    return "yes" if b else ""


def write_results(path, events, rows, pools, pools_new, corrs, volume, planted_rows, e1_matches, ctl, all_eps, last_data, last_onset, cpu) -> None:
    L: list[str] = ["# 0019 results", ""]
    L += [f"Run time {cpu:.1f} s (CPU). Seed {SEED}; injection seed 2026 only. Every number below is computed by `run.py` from the data (tag: computed).", ""]

    L += ["## Source episodes (version A)", ""]
    n_all = {ph: sum(1 for e, _ in all_eps if e.phenotype == ph) for ph in PHENOS}
    n_sc = {ph: sum(1 for ev in events if ev.phenotype == ph) for ph in PHENOS}
    L += [
        f"The rule (4 weeks against the preceding 26, Poisson p < 0.05, at least 2 patients, weeks within 28 days merged, onset the first Sunday) finds "
        f"{sum(n_all.values())} episodes in the whole data from the first Sunday with a 26-week baseline ({n_all['ESBL E. coli']} ESBL *E. coli*, {n_all['MRSA']} MRSA). "
        f"{len(events)} have onset in {harness.SCORE[0]} to {harness.SCORE[1]} and 56 days of data after it (onset up to {last_onset}; data end {last_data}): "
        f"{n_sc['ESBL E. coli']} ESBL *E. coli*, {n_sc['MRSA']} MRSA. The plan expected 12 to 20 in the scoring period. "
        f"Causality check of the rule: on the data cut at {', '.join(CUTS)} the onsets are those of all the data up to the cut (asserted by `run.py`: passed).",
        "",
    ]
    L += md_table(
        ["#", "Phenotype", "Unit", "Onset", "Weeks fired", "Patients 4 wk / baseline 26 wk at onset", "Rule p", "Planted"],
        [[e.number, e.phenotype, e.unit, e.onset, e.weeks_fired, f"{e.current} / {e.baseline}", f(e.p_rule, 4), e.planted] for e in events],
    )
    L += [""]

    L += [
        "## Per event: P1 with the harness outcome",
        "",
        "AUC over the eight other units; a dash where there is no positive (or no negative) unit. p: rewiring p at 1,000 permutations. rho: Spearman correlation with the continuous excess (observed + 0.5) / expected, with its rewiring p. Pos new: positives at 0.05 of the stricter new-finds outcome.",
        "",
    ]
    hdr = ["#", "Phenotype", "Unit", "Onset", "Pos a05", "Pos a001", "AUC share a05", "AUC raw a05", "p share", "p raw", "AUC share a001", "AUC raw a001", "rho share (p)", "rho raw (p)", "Pos new a05"]
    body = []
    for r in rows:
        m, ec = r["metrics"], r["excess_corr"]
        body.append(
            [
                r["number"], r["phenotype"], r["unit"], r["onset"], m["positives_a05"], m["positives_a001"],
                f(m["auc_share_a05"]), f(m["auc_raw_a05"]), f(m["null_p_share_a05"]), f(m["null_p_raw_a05"]),
                f(m["auc_share_a001"]), f(m["auc_raw_a001"]),
                f"{f(ec['share'], 2)} ({f(ec.get('p_share'))})", f"{f(ec['raw'], 2)} ({f(ec.get('p_raw'))})",
                r["new_finds"]["positives_a05"],
            ]
        )
    L += md_table(hdr, body) + [""]

    L += [
        "## Per event and unit",
        "",
        "Share and raw exposure of the unit from the source (365 days before onset), then the harness outcome: patients with the phenotype in the 8 weeks from onset over the expected count from the unit's 26-week baseline, and the new-finds count (known carriers left out).",
        "",
    ]
    body = []
    for r in rows:
        for u in r["units"]:
            body.append(
                [
                    r["number"], r["unit"], u["unit"], f(u["share"]), f(u["raw"], 1), u["baseline_patients"],
                    f"{u['patients']} / {u['expected']:.2f}", f(u["p_a05"]), yes(u["positive_a05"]), yes(u["positive_a001"]),
                    u["patients_new_finds"], yes(u["positive_new_a05"]),
                ]
            )
    L += md_table(["#", "Source", "Unit", "Share", "Raw", "Baseline pts", "Observed / expected", "p", "Pos a05", "Pos a001", "New-finds pts", "Pos new a05"], body) + [""]

    L += ["## Pooled over events (the test)", ""]
    L += [
        "U = Σ U_e / Σ n_pos · n_neg over events with at least one positive and one negative unit (within-event Mann-Whitney pairs). Null: replicate j of every event's graph pooled the same way (1,000 replicates); band: its 2.5th and 97.5th percentiles; p = (1 + #{null ≥ U}) / 1,001. The interval is a 95 % bootstrap over the events used (1,000 resamples, seed 2026), an addition of this run.",
        "",
    ]
    hdr = ["Subset", "Exposure", "Alpha", "Events used / all", "Positives", "Pairs", "Pooled AUC (95 % bootstrap over events)", "Null mean [2.5, 97.5]", "p"]
    for title, src in (("Harness outcome", pools), ("New-finds outcome (known carriers left out after onset)", pools_new)):
        L += [f"### {title}", ""]
        body = []
        for name, pset in src.items():
            for ex, al in ROWS:
                p = pset[f"{ex}_{al}"]
                body.append(
                    [
                        name, ex, "0.05" if al == "a05" else "0.001", f"{p['events']} / {p['events_total']}", p["positives"], p["pairs"],
                        "–" if p["auc"] is None else f"{p['auc']:.3f} ({interval(p['boot_lo'], p['boot_hi'])})",
                        "–" if p["null_mean"] is None else f"{p['null_mean']:.3f} [{p['null_lo']:.3f}, {p['null_hi']:.3f}]", f(p["p"]),
                    ]
                )
        L += md_table(hdr, body) + [""]
    L += ["### Rank correlation with the continuous excess, averaged over events", ""]
    body = []
    for name, c in corrs.items():
        for ex in ("share", "raw"):
            v = c[ex]
            body.append([name, ex, v["events"], f(v["corr"]), "–" if v["null_lo"] is None else f"[{v['null_lo']:.3f}, {v['null_hi']:.3f}]", f(v["p"])])
    L += md_table(["Subset", "Exposure", "Events", "Mean rho", "Null band [2.5, 97.5]", "p"], body) + [""]
    L += [
        "Why the null band of the raw-exposure correlation sits below zero: the continuous excess (observed + 0.5) / expected falls with a unit's volume (small units have the larger ratios), and exposure under the rewiring null follows volume. Spearman correlation with the unit's number of culture rows in the graph window (the quantity the null keeps), mean over the 24 events:",
        "",
    ]
    L += md_table(
        ["Quantity", "Mean rho with unit volume"],
        [
            ["Continuous excess", f(volume["excess"])],
            ["Raw exposure, real graph", f(volume["raw_real"])],
            ["Raw exposure, rewired graphs (mean over replicates)", f(volume["raw_null"])],
            ["Share, real graph", f(volume["share_real"])],
            ["Share, rewired graphs (mean over replicates)", f(volume["share_null"])],
        ],
    ) + [""]

    L += ["## E1 and E2 as descriptions", "", f"E1 reproduces the baseline row of `baselines/exposure-e1.json` (positives, shares, raw, excess correlation): {'yes' if e1_matches else 'NO'}.", ""]
    for key, r in planted_rows.items():
        m, ec = r["metrics"], r["excess_corr"]
        L += [
            f"### {key}: {r['phenotype']} in {r['unit']}, onset {r['onset']}",
            "",
            f"Positives at 0.05: {m['positives_a05']}; at 0.001: {m['positives_a001']}. AUC share / raw at 0.05: {f(m['auc_share_a05'])} / {f(m['auc_raw_a05'])} (p {f(m['null_p_share_a05'])} / {f(m['null_p_raw_a05'])}); at 0.001: {f(m['auc_share_a001'])} / {f(m['auc_raw_a001'])}. "
            f"rho share {f(ec['share'])} (p {f(ec.get('p_share'))}), raw {f(ec['raw'])} (p {f(ec.get('p_raw'))}). New-finds positives at 0.05: {r['new_finds']['positives_a05']}.",
            "",
        ]
        body = [
            [u["unit"], f(u["share"]), f(u["raw"], 1), u["baseline_patients"], f"{u['patients']} / {u['expected']:.2f}", f(u["p_a05"]), yes(u["positive_a05"]), yes(u["positive_a001"]), u["patients_new_finds"]]
            for u in r["units"]
        ]
        L += md_table(["Unit", "Share", "Raw", "Baseline pts", "Observed / expected", "p", "Pos a05", "Pos a001", "New-finds pts"], body) + [""]

    L += [
        "## Controls (version B): injected two-unit clusters",
        "",
        "These are controls. B1 (flow partner): B drawn in proportion to the patients moved between A and B in the year before the start, the quantity exposure reads, so ranking B high is built in; a pipeline that failed it would be broken, and one that passes shows nothing about the data. B2 (uniform partner): B independent of flow, so the true AUC is 0.5 and the share of trials with p < 0.05 should be about 5 %; it checks the null's calibration only. Exposure from A only; outcome on the real records plus the injected patients; 200 permutations per trial (p resolution 1/201); alpha 0.05. Pooled AUC over within-trial pairs, interval a bootstrap over trials, p the pooled rewiring p.",
        "",
    ]
    hdr = ["Control", "Cell", "Trials", "With AUC (one positive)", "Pooled AUC share (95 % boot; null mean [band]; p)", "Pooled AUC raw (95 % boot; null mean [band]; p)", "B alone: AUC from rank, share / raw", "B mean rank share / raw (chance 4.5)", "B positive", "p<0.05 share / raw, of trials with AUC", "p<0.05 share / raw, of trials with 2+ positives", "p<0.05 share / raw, of all trials"]
    body = []
    labels = {"B1": "B1 flow partner (positive control)", "B2": "B2 uniform partner (negative control)"}
    cell_label = {"k4": "k = 4", "k6": "k = 6", "all": "both k", "clean": "both k, trials touching a planted event or the end of the data left out"}

    def fmt_p(p: dict) -> str:
        if p["auc"] is None:
            return "–"
        return f"{p['auc']:.3f} ({interval(p['boot_lo'], p['boot_hi'])}; null {p['null_mean']:.3f} [{p['null_lo']:.3f}, {p['null_hi']:.3f}]; p {f(p['p'])})"

    for control in ("B1", "B2"):
        for cell in ("k4", "k6", "all", "clean"):
            c = ctl[control][cell]
            body.append(
                [
                    labels[control], cell_label[cell], c["trials"], f"{c['trials_with_auc']} ({f(c['share_single_positive'], 2)})", fmt_p(c["pooled_share"]), fmt_p(c["pooled_raw"]),
                    f"{f(c['b_only_auc_share'])} / {f(c['b_only_auc_raw'])}", f"{f(c['b_mean_rank_share'], 2)} / {f(c['b_mean_rank_raw'], 2)}", f(c["share_b_positive"]),
                    f"{f(c['share_p05_share_of_defined'])} / {f(c['share_p05_raw_of_defined'])}", f"{f(c['share_p05_share_multi_positive'])} / {f(c['share_p05_raw_multi_positive'])}",
                    f"{f(c['share_p05_share_of_all'])} / {f(c['share_p05_raw_of_all'])}",
                ]
            )
    L += md_table(hdr, body) + [""]
    L += [
        f"Trials whose baseline or outcome window (start - 182 to start + 55) holds days of a planted event of the clone's own organism and flag in a unit other than A: B1 {ctl['B1']['contaminated_trials']}, B2 {ctl['B2']['contaminated_trials']} of {ctl['B1']['trials_total']} each. "
        f"Trials whose 56-day window runs past the end of the data ({last_data}): B1 {ctl['B1']['truncated_trials']}, B2 {ctl['B2']['truncated_trials']}.",
        "",
    ]
    path.write_text("\n".join(L) + "\n")


if __name__ == "__main__":
    main()
