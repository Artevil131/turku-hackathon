"""Rerun the experiments and check that each reproduces its committed `out/` files, so the numbers quoted in the
READMEs and the pitch cannot drift from the code.

    uv run python scripts/verify_experiments.py                 # every experiment (about 2 minutes; 0007 alone about 1)
    uv run python scripts/verify_experiments.py --only 0002,0009

Run-time lines ("Run time 10 s", "Sweep time: 15.0 s") are ignored. The committed files are put back afterwards, so
the working tree is left as it was. 0008 reads THL data that THL revises, so it runs only with --with-external; 0003
(the language-model bake-off) is local-only and not rerun. Exits 1 if any output differs.
"""

from __future__ import annotations

import argparse
import difflib
import re
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXPERIMENTS = {
    "0001": "experiments/0001-planted-events/scan.py",
    "0002": "experiments/0002-detectors-on-planted-events/sweep.py",
    "0004": "experiments/0004-coverage-estimators/backtest.py",
    "0005": "experiments/0005-patient-factors/backtest.py",
    "0006": "experiments/0006-trends-by-ward-type/sweep.py",
    "0007": "experiments/0007-injected-events/inject.py",
    "0009": "experiments/0009-empty-day-runs/analysis.py",
}
EXTERNAL = {"0008": "experiments/0008-regional-signals/analysis.py"}
RUN_TIME = re.compile(r"(Run time [0-9.]+ s|Sweep time: [0-9.]+ s)")


def normalise(text: str) -> list[str]:
    return [RUN_TIME.sub("<run time>", line) for line in text.splitlines()]


def verify(number: str, script: str) -> bool:
    out = ROOT / Path(script).parent / "out"
    before = {p: p.read_bytes() for p in out.glob("*")} if out.exists() else {}
    t0 = time.time()
    run = subprocess.run([sys.executable, script], cwd=ROOT, capture_output=True, text=True)
    took = time.time() - t0
    after = {p: p.read_bytes() for p in out.glob("*")} if out.exists() else {}
    for p, data in before.items():  # put the committed files back
        p.write_bytes(data)
    for p in set(after) - set(before):
        p.unlink()
    if run.returncode != 0:
        print(f"{number}: FAILED to run ({took:.0f} s)\n{run.stderr[-2000:]}")
        return False
    diffs = []
    for p in sorted(set(before) | set(after)):
        a = normalise(before.get(p, b"").decode("utf-8"))
        b = normalise(after.get(p, b"").decode("utf-8"))
        if a != b:
            diffs.append("\n".join(difflib.unified_diff(a, b, f"committed {p.name}", f"rerun {p.name}", lineterm="", n=1)))
    print(f"{number}: {'reproduces' if not diffs else 'DIFFERS'} ({len(before)} files, {took:.0f} s)")
    for d in diffs:
        print(d[:4000])
    return not diffs


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("--only", help="comma-separated experiment numbers")
    p.add_argument("--with-external", action="store_true", help="also 0008, which needs data/external/thl")
    a = p.parse_args()
    todo = dict(EXPERIMENTS, **(EXTERNAL if a.with_external else {}))
    if a.only:
        wanted = a.only.split(",")
        todo = {n: s for n, s in {**EXPERIMENTS, **EXTERNAL}.items() if n in wanted}
    results = [verify(n, s) for n, s in sorted(todo.items())]
    sys.exit(0 if all(results) else 1)


if __name__ == "__main__":
    main()
