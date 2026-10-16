"""Cross-check the hand-written statistics the live TypeScript tool runs against scipy and statsmodels (D-024).

Run from the repository root:  uv run python scripts/crosscheck-stats/check.py
Exits non-zero if any value differs beyond its tolerance.
"""

from __future__ import annotations

import json
import subprocess
import sys

import numpy as np
from scipy import stats
from statsmodels.stats.proportion import proportion_confint

rng = np.random.default_rng(2026)

poisson = [[k, m] for m in (0.05, 0.3, 1.0, 2.5, 8.0, 30.0, 70.0) for k in (0, 1, 2, 3, 5, 10, 20, 40, 90)]
normal = [-3.5, -1.96, -0.5, 0.0, 0.5, 1.645, 1.96, 2.576, 3.29, 3.89]
trend = []
for _ in range(30):
    k = int(rng.integers(3, 20))
    n = rng.integers(5, 300, k)
    p = np.clip(0.1 + rng.normal(0, 0.03) * np.arange(k) / k + rng.normal(0, 0.02, k), 0.01, 0.99)
    trend.append([{"events": int(rng.binomial(nn, pp)), "n": int(nn)} for nn, pp in zip(n, p)])
wilson = [[int(k), int(n)] for n in (1, 5, 30, 200) for k in sorted({0, 1, n // 2, n - 1, n}) if 0 <= k <= n]
grid = {"poisson": poisson, "normal": normal, "trend": trend, "wilson": wilson}

ts = json.loads(subprocess.run(["node", "scripts/crosscheck-stats/dump.ts", json.dumps(grid)], capture_output=True, text=True, check=True).stdout)


def cochran_armitage(groups: list[dict]) -> float:
    n = np.array([g["n"] for g in groups], float)
    r = np.array([g["events"] for g in groups], float)
    s = np.arange(len(groups), dtype=float)
    N, R = n.sum(), r.sum()
    if R in (0, N):
        return 1.0
    p = R / N
    t = (s * (r - n * p)).sum()
    var = p * (1 - p) * ((n * s * s).sum() - (n * s).sum() ** 2 / N)
    return float(stats.norm.sf(t / np.sqrt(var)))


ref = {
    "poissonUpper": [float(stats.poisson.sf(k - 1, m)) for k, m in poisson],
    "poissonLower": [float(stats.poisson.cdf(k, m)) for k, m in poisson],
    "normal": [float(stats.norm.sf(z)) for z in normal],
    "trend": [cochran_armitage(g) for g in trend],
    "wilson": [list(proportion_confint(k, n, alpha=0.05, method="wilson")) for k, n in wilson],
}
# Absolute tolerances: the normal tail uses Abramowitz-Stegun (error below 1.5e-7).
tolerance = {"poissonUpper": 1e-10, "poissonLower": 1e-10, "normal": 2e-7, "trend": 2e-7, "wilson": 1e-6}

failed = False
for name, expected in ref.items():
    diff = float(np.max(np.abs(np.array(ts[name], float) - np.array(expected, float))))
    ok = diff <= tolerance[name]
    failed |= not ok
    print(f"{'ok  ' if ok else 'FAIL'} {name:13s} {len(expected):3d} cases  max |TS - reference| = {diff:.2e}  (tolerance {tolerance[name]:.0e})")
sys.exit(1 if failed else 0)
