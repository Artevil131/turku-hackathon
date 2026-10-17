"""Experiment 0016, held-out re-score (orchestrator's request, after close). The closed experiment's detector at its chosen
settings, re-scored on injection seeds 2027 to 2030 that no experiment used (50 trials per seed, 200 per cell).

    uv run python experiments/0016-cusum/heldout.py

Nothing is re-chosen: the Poisson and Bernoulli settings and the operating run length are read from out/metrics.json
(`settings`, written by run.py: Poisson theta 8 weekly no guard band, Bernoulli theta 8 guard band 4 weeks, L_sim 72.0682
years), the sweep levels from out/grid.json, the detector is built as run.py builds the union (same class, same levels, same
default level) and scored by `aei.score_detection.confirm`. The screening numbers (seed 2026) and the two live-set rows are
read from files already on disk. Writes out/heldout.json and out/heldout.md.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import cusum as cs  # noqa: E402
import run as r16  # noqa: E402  (levels_with, fi, table, load_baseline; the closed experiment's own helpers)

from aei import harness  # noqa: E402
from aei import score_detection as sd  # noqa: E402
from aei.inject import FAMILIES  # noqa: E402

OUT = HERE / "out"
EXPERIMENT = r16.EXPERIMENT
SEEDS = tuple(sd.SEEDS_HELDOUT)
TRIALS_PER_SEED = 50


def main() -> None:
    clock = harness.Clock()
    screen = json.loads((OUT / "metrics.json").read_text())
    grid = json.loads((OUT / "grid.json").read_text())
    st = screen["settings"]
    pois, bern, l_sim = tuple(st["poisson"]), tuple(st["bernoulli"]), st["operating_level_years"]
    assert grid["chosen"]["poisson"] == list(pois) and grid["chosen"]["bernoulli"] == list(bern)
    calib = grid["calibration"]
    lv = r16.levels_with([calib["L_S"], l_sim] + ([calib["L_real"]] if calib["L_real"] else []), (), True)
    op_level = cs.level_of_years(round(l_sim, 6))
    assert abs(op_level / screen["operating_level"] - 1) < 1e-5, (op_level, screen["operating_level"])
    det = cs.Cusum(pois=pois, bern=bern).detector(levels=lv, default_level=op_level)
    records, cultures = harness.data()
    print(f"held-out seeds {SEEDS}, {TRIALS_PER_SEED} trials per seed, level {op_level:.6g} (L {l_sim} years)", file=sys.stderr, flush=True)
    m, iv, n, ex = sd.confirm(det, seeds=SEEDS, trials_per_seed=TRIALS_PER_SEED, level=op_level, records=records, cultures=cultures, verbose=False)
    wall, cpu = clock.wall, clock.cpu
    method = screen["method"] + " (held-out re-score, seeds 2027 to 2030)"
    harness.write_metrics(
        OUT / "heldout.json", experiment=EXPERIMENT, method=method, family="detection", metrics=m, intervals=iv, n=n,
        runtime_s=wall, cpu_s=cpu, seeds=list(SEEDS), tuned_on_test=False, tuned_on=r16.TUNED_ON,
        notes="Held-out re-score of 0016's union at its chosen settings and operating level (nothing re-chosen), aei.score_detection.confirm, "
        "50 trials per seed x 4 seeds = 200 per cell. Screening numbers: out/metrics.json (seed 2026). Command: uv run python experiments/0016-cusum/heldout.py.",
        settings=st, operating_level=op_level, **ex,
    )
    base = {"retuned": r16.load_baseline("live-set-retuned-year1"), "shipped": r16.load_baseline("live-set-shipped")}
    write_md(OUT / "heldout.md", screen, m, iv, base, wall, cpu)
    print(f"done: wall {wall:.0f} s, cpu {cpu:.0f} s", file=sys.stderr, flush=True)


def cell(metrics: dict, ints: dict, part: str, key: str, delay_part: str) -> str:
    v = metrics.get(part, {}).get(key)
    d = metrics.get(delay_part, {}).get(key)
    return r16.fi(v, ints.get(part, {}).get(key)) + f", {'-' if d is None else d} d"


def write_md(path: Path, screen: dict, m: dict, iv: dict, base: dict, wall: float, cpu: float) -> None:
    L = ["# 0016 held-out re-score", ""]
    L.append("Reproduce: `uv run python experiments/0016-cusum/heldout.py` (seeds 2027 to 2030, 50 trials per seed, 200 per cell; settings and level read from out/metrics.json, nothing re-chosen). Every number is computed by that run or read from the files named.")
    L += [f"Run time {wall:.1f} s (wall), {cpu:.1f} s (CPU).", ""]
    L += ["## D5 at the headline noise (k = 4; Wilson 95 %)", ""]
    rows = []
    for nm, sm, si, hm, hi in (
        ("0016 union, L = 72.1 years", screen["metrics"], screen["intervals"], m, iv),
        ("live re-tuned year 1", base["retuned"]["metrics"], base["retuned"]["intervals"], base["retuned"]["metrics"], base["retuned"]["intervals"]),
        ("live shipped", base["shipped"]["metrics"], base["shipped"]["intervals"], base["shipped"]["metrics"], base["shipped"]["intervals"]),
    ):
        s5, h5 = sm["D5"], (hm["D5_heldout"])
        rows.append([
            nm, f"{s5['noise']:.2f}", r16.fi(s5["rare"], si["D5"]["rare"]), r16.fi(s5["common_esbl"], si["D5"]["common_esbl"]),
            f"{h5['noise']:.2f}", r16.fi(h5["rare"], hi["D5_heldout"]["rare"]), r16.fi(h5["common_esbl"], hi["D5_heldout"]["common_esbl"]),
            f"{s5['rare_delay']} / {h5['rare_delay']}", f"{s5['common_esbl_delay']} / {h5['common_esbl_delay']}",
        ])
    L += r16.table(["row", "noise a year, screening", "rare, screening", "common ESBL, screening", "noise a year, held-out", "rare, held-out", "common ESBL, held-out", "delay rare (screening / held-out)", "delay common ESBL"], rows)
    L += ["", "## D2 at k = 3 and 4 (rate [Wilson 95 %], median delay in days)", ""]
    for k in (3, 4):
        L += [f"**k = {k}**", ""]
        body = []
        for f in FAMILIES:
            key = f"{f}_k{k}"
            cells = [f]
            for nm, sm, si, hm, hi in (
                ("0016", screen["metrics"], screen["intervals"], m, iv),
                ("retuned", base["retuned"]["metrics"], base["retuned"]["intervals"], base["retuned"]["metrics"], base["retuned"]["intervals"]),
                ("shipped", base["shipped"]["metrics"], base["shipped"]["intervals"], base["shipped"]["metrics"], base["shipped"]["intervals"]),
            ):
                cells.append(cell(sm, si, "D2", key, "D2_delay"))
                cells.append(cell(hm, hi, "D2_heldout", key, "D2_heldout_delay"))
            body.append(cells)
        L += r16.table(["family", "0016 screening", "0016 held-out", "re-tuned screening", "re-tuned held-out", "shipped screening", "shipped held-out"], body) + [""]
    path.write_text("\n".join(L) + "\n")


if __name__ == "__main__":
    main()
