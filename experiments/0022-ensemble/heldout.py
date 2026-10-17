"""Experiment 0022, after close (orchestrator's request, winner's-curse rule): re-score the rank product, the intersection and
the stack on the held-out injection seeds 2027 to 2030 (50 trials per seed, 200 per cell) with `aei.score_detection.confirm`,
each at its D5 headline level from the screening run (out/metrics*.json), and read the re-tuned live set's `_heldout` keys from
its baseline row. Writes out/heldout.json and out/heldout.md; run.py is not touched.

    uv run python experiments/0022-ensemble/heldout.py

Setup (components, ranks, stack) is rebuilt exactly as run.py builds it (same code, same year-1 data), so the detectors are the
screening ones. The rank product is also read at the rate interpolated at exactly 5 episodes a year (run.py's `at_noise`).
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import ensemble as E  # noqa: E402
import run as R  # noqa: E402

from aei import cusum as cs  # noqa: E402
from aei import harness  # noqa: E402
from aei import score_detection as sd  # noqa: E402
from aei.coverage import wilson  # noqa: E402

OUT = HERE / "out"
BASELINE = harness.ROOT / "benchmarks" / "overnight-2026-10-17" / "baselines" / "live-set-retuned-year1.json"
ROWS = (("rank_product", "metrics.json", "rank product"), ("intersection", "metrics-intersection.json", "intersection (max p)"), ("stack", "metrics-stack.json", "stacked logistic"))


def main() -> None:
    clock = harness.Clock()
    records, cultures = harness.data()
    live, _ = sd.retune_live_set(records, cultures, verbose=False)
    comps = E.Components(live, cs.Cusum(pois=R.POIS, bern=R.BERN))
    a_real, b_real = comps.run(records, cultures, None)
    bg7 = E.Background(a_real, b_real, 7)
    rp = E.RankProduct(bg7)
    raw = sd.Detector(name="components", run_fn=lambda r, c, f=None: [*comps.run(r, c, f)[0], *comps.run(r, c, f)[1]])
    hits = R.training_stream(raw, records, cultures, R.STACK_TRIALS)
    pos, neg = R.stack_rows(hits, a_real, b_real)
    stack = E.fit_stack(bg7, pos, neg, l2=1.0)
    rules = {"rank_product": (rp, "ensemble_rp"), "intersection": (E.Intersection(), "ensemble_intersection"), "stack": (stack, "ensemble_stack")}

    metrics, intervals, n, curves = {}, {}, {}, {}
    screening = {}
    for key, fname, label in ROWS:
        doc = json.loads((OUT / fname).read_text())
        level = doc["metrics"]["D5"]["level"]
        screening[key] = {"level": level, "metrics": doc["metrics"]["D5"], "intervals": doc["intervals"]["D5"], "noise_count": doc["n"]["D5"]["noise"]}
        rule, name = rules[key]
        det = E.make_detector(comps, rule, name, E.JOIN, label=label)
        m, iv, nn, ex = sd.confirm(det, level=level, records=records, cultures=cultures, gap_settings=(), verbose=False)
        curve = ex["D5_heldout_curve"]
        curves[key] = curve
        metrics[key] = {"D5_heldout": m["D5_heldout"], "D5_heldout_at_5_per_year": {f: R.at_noise(curve, f) for f in ("rare", "common_esbl")}}
        intervals[key] = {"D5_heldout": iv["D5_heldout"]}
        n[key] = {"D5_heldout": nn["D5_heldout"]}
        print(f"{key}: level {level:g} held-out {m['D5_heldout']} cpu {clock.cpu:.0f} s", file=sys.stderr, flush=True)

    base = json.loads(BASELINE.read_text())
    bcurve = base["D5_heldout_curve"]
    metrics["live_set_retuned_year1"] = {"D5_heldout": base["metrics"]["D5_heldout"], "D5_heldout_at_5_per_year": {f: R.at_noise(bcurve, f) for f in ("rare", "common_esbl")}}
    intervals["live_set_retuned_year1"] = {"D5_heldout": base["intervals"]["D5_heldout"]}
    n["live_set_retuned_year1"] = {"D5_heldout": base["n"]["D5_heldout"]}
    curves["live_set_retuned_year1"] = bcurve
    ref_screen = {"level": base["metrics"]["D5"]["level"], "metrics": base["metrics"]["D5"], "intervals": base["intervals"]["D5"], "noise_count": base["n"]["D5"]["noise"]}
    ref_screen["at_5"] = {f: R.at_noise(base["D5_curve"], f) for f in ("rare", "common_esbl")}
    for key, _, _ in ROWS:
        screening[key]["at_5"] = {f: R.at_noise(json.loads((OUT / dict((k, fn) for k, fn, _ in ROWS)[key]).read_text())["D5_curve"], f) for f in ("rare", "common_esbl")}
    screening["live_set_retuned_year1"] = ref_screen

    wall, cpu = clock.wall, clock.cpu
    harness.write_metrics(
        OUT / "heldout.json", experiment="0022-ensemble-heldout", method="Held-out re-score (seeds 2027 to 2030, 50 trials per seed) of 0022's rank product, intersection and stack at their D5 headline levels, beside the re-tuned live set's `_heldout` keys",
        family="detection", metrics=metrics, intervals=intervals, n=n, runtime_s=wall, cpu_s=cpu, seeds=list(sd.SEEDS_HELDOUT), tuned_on_test=True, tuned_on=R.TUNED_ON,
        notes="`aei.score_detection.confirm` with the screening detectors (components, ranks and stack rebuilt exactly as run.py) at the D5 headline level of the screening run, which comes from the scoring-period noise curve (hence tuned_on_test true for the level; the noise does not depend on the injection seed). D5_heldout_at_5_per_year is the rate interpolated linearly in noise at 5 a year from the held-out curve. The live set's values are read from baselines/live-set-retuned-year1.json.",
        screening=screening, D5_heldout_curves=curves,
    )
    write_md(OUT / "heldout.md", metrics, intervals, n, screening, wall, cpu)
    print(f"done: wall {wall:.0f} s, cpu {cpu:.0f} s", file=sys.stderr)


def f3(x) -> str:
    return "-" if x is None else f"{x:.3f}"


def fi(rate, iv) -> str:
    return "-" if rate is None else f"{rate:.3f} [{iv[0]:.3f}, {iv[1]:.3f}]"


def write_md(path: Path, metrics, intervals, n, screening, wall, cpu) -> None:
    names = {"live_set_retuned_year1": "live set re-tuned year 1", "rank_product": "rank product (primary)", "intersection": "intersection (max p)", "stack": "stack"}
    L = ["# 0022 held-out re-score", ""]
    L.append("Reproduce: `uv run python experiments/0022-ensemble/heldout.py` (seeds 2027 to 2030, 50 trials per seed, 200 per cell, `aei.score_detection.confirm`; every number computed by that run, or read from the committed screening and baseline files).")
    L.append("")
    L.append(f"Run time {wall:.1f} s (wall).")
    L.append("")
    L.append(f"Run time {cpu:.1f} s (CPU).")
    L.append("")
    L.append("D5 at k = 4, Wilson 95 %. Level: each ensemble's D5 headline level from the screening run (a p of the rule), the live set's its headline multiple of the alphas. Noise is the scoring-period episodes a year at that level (same for screening and held-out, it does not depend on the injection seed). 'At 5 a year' is the rate interpolated linearly in noise at 5.0 episodes a year from the same seeds' curve (computed).")
    L.append("")
    hdr = ["row", "level", "noise a year (episodes)", "screening rare / common ESBL (seed 2026)", "held-out rare", "held-out common ESBL", "screening at 5/yr rare / common", "held-out at 5/yr rare / common"]
    rows = []
    for key in ("live_set_retuned_year1", "rank_product", "intersection", "stack"):
        h = metrics[key]["D5_heldout"]
        iv = intervals[key]["D5_heldout"]
        s = screening[key]
        sm = s["metrics"]
        a5 = metrics[key]["D5_heldout_at_5_per_year"]
        rows.append([
            names[key], f"{h['level']:.3g}", f"{h['noise']:.2f} ({s['noise_count']})", f"{sm['rare']:.3f} / {sm['common_esbl']:.3f}", fi(h["rare"], iv["rare"]), fi(h["common_esbl"], iv["common_esbl"]),
            f"{f3(s['at_5']['rare'])} / {f3(s['at_5']['common_esbl'])}", f"{f3(a5['rare'])} / {f3(a5['common_esbl'])}",
        ])
    L.append("| " + " | ".join(hdr) + " |")
    L.append("| " + " | ".join(["---"] * len(hdr)) + " |")
    L += ["| " + " | ".join(r) + " |" for r in rows]
    L.append("")
    path.write_text("\n".join(L) + "\n")


if __name__ == "__main__":
    main()
