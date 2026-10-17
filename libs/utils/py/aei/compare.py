"""The researcher's first statistical tools (mirrors @aei/compare; D-074): two shares, two rates, a trend, a Beta posterior,
the discounted Beta of D-041 and shares by period. Same arithmetic as the TypeScript, so the numbers agree to 1e-9."""

from __future__ import annotations

import math
from collections.abc import Callable, Sequence
from typing import Any

from aei.coverage import wilson
from aei.dates import add_days, days_between
from aei.detect import cochran_armitage_rising, normal_upper

Z = 1.96
ALPHA = 0.025
BISECTIONS = 100
INTERVAL_CELLS = 4000
NAN = float("nan")
INF = float("inf")


def proportion_difference(k1: int, n1: int, k2: int, n2: int) -> dict[str, Any]:
    """k1 of n1 against k2 of n2: diff = p2 - p1, Newcombe's hybrid score interval (Wilson, z = 1.96), pooled two-sided z test."""
    p1 = k1 / n1 if n1 > 0 else NAN
    p2 = k2 / n2 if n2 > 0 else NAN
    if n1 == 0 or n2 == 0:
        return {"p1": p1, "p2": p2, "diff": NAN, "interval": {"lo": NAN, "hi": NAN}, "z": NAN, "p": NAN}
    l1, u1 = wilson(k1, n1, Z)
    l2, u2 = wilson(k2, n2, Z)
    diff = p2 - p1
    interval = {
        "lo": diff - math.sqrt((p2 - l2) ** 2 + (u1 - p1) ** 2),
        "hi": diff + math.sqrt((u2 - p2) ** 2 + (p1 - l1) ** 2),
    }
    pooled = (k1 + k2) / (n1 + n2)
    se = math.sqrt(pooled * (1 - pooled) * (1 / n1 + 1 / n2))
    z = diff / se if se > 0 else 0.0
    return {"p1": p1, "p2": p2, "diff": diff, "interval": interval, "z": z, "p": 1.0 if z == 0 else min(1.0, 2 * normal_upper(abs(z)))}


def _log_choose(n: int, k: int) -> float:
    return math.lgamma(n + 1) - math.lgamma(k + 1) - math.lgamma(n - k + 1)


def _binomial_pmf(k: int, n: int, p: float) -> float:
    if p <= 0:
        return 1.0 if k == 0 else 0.0
    if p >= 1:
        return 1.0 if k == n else 0.0
    return math.exp(_log_choose(n, k) + k * math.log(p) + (n - k) * math.log(1 - p))


def _binomial_sum(start: int, stop: int, n: int, p: float) -> float:
    return min(1.0, sum(_binomial_pmf(i, n, p) for i in range(start, stop + 1)))


def _clopper_pearson(k: int, n: int) -> tuple[float, float]:
    """Clopper-Pearson bounds by bisection on the binomial tails (each ALPHA), as in the TypeScript."""
    lo = 0.0
    if k > 0:
        a, b = 0.0, 1.0
        for _ in range(BISECTIONS):
            m = (a + b) / 2
            if _binomial_sum(k, n, n, m) < ALPHA:
                a = m
            else:
                b = m
        lo = (a + b) / 2
    hi = 1.0
    if k < n:
        a, b = 0.0, 1.0
        for _ in range(BISECTIONS):
            m = (a + b) / 2
            if _binomial_sum(0, k, n, m) > ALPHA:
                a = m
            else:
                b = m
        hi = (a + b) / 2
    return lo, hi


def rate_ratio(k1: int, t1: float, k2: int, t2: float) -> dict[str, Any]:
    """Two Poisson counts over exposures: ratio rate2/rate1, exact conditional (binomial) 95 % interval, two-sided exact p."""
    if not (t1 > 0 and t2 > 0):
        raise ValueError("rate_ratio: exposures must be positive")
    rate1, rate2 = k1 / t1, k2 / t2
    total = k1 + k2
    if total == 0:
        return {"rate1": rate1, "rate2": rate2, "ratio": NAN, "interval": {"lo": 0.0, "hi": INF}, "p": 1.0}
    pl, pu = _clopper_pearson(k2, total)
    scale = t1 / t2

    def to_ratio(q: float) -> float:
        return INF if q >= 1 else (q / (1 - q)) * scale

    pi0 = t2 / (t1 + t2)
    observed = _binomial_pmf(k2, total, pi0)
    p = 0.0
    for i in range(total + 1):
        m = _binomial_pmf(i, total, pi0)
        if m <= observed * (1 + 1e-7):
            p += m
    ratio = INF if k1 == 0 else rate2 / rate1
    return {"rate1": rate1, "rate2": rate2, "ratio": ratio, "interval": {"lo": to_ratio(pl), "hi": to_ratio(pu)}, "p": min(1.0, p)}


def trend_across(bins: Sequence[tuple[int, int]]) -> dict[str, float]:
    """One-sided Cochran-Armitage p over ordered (events, n) bins, the live detector's test."""
    return {"p": cochran_armitage_rising(bins)}


def _log_gamma(x: float) -> float:
    """ln Γ by the same Lanczos approximation as @aei/viz (g = 7, n = 9)."""
    if x < 0.5:
        return math.log(math.pi / math.sin(math.pi * x)) - _log_gamma(1 - x)
    c = [
        0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905,
        -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
    ]
    y = x - 1
    a = c[0]
    t = y + 7.5
    for i in range(1, 9):
        a += c[i] / (y + i)
    return 0.5 * math.log(2 * math.pi) + (y + 0.5) * math.log(t) - t + math.log(a)


def beta_density(x: float, a: float, b: float) -> float:
    if x <= 0 or x >= 1:
        return 0.0
    log_b = _log_gamma(a) + _log_gamma(b) - _log_gamma(a + b)
    return math.exp((a - 1) * math.log(x) + (b - 1) * math.log(1 - x) - log_b)


def _beta_interval(a: float, b: float) -> dict[str, float]:
    n = INTERVAL_CELLS
    mass = [beta_density((i + 0.5) / n, a, b) for i in range(n)]
    total = 0.0
    for m in mass:
        total += m

    def quantile(q: float) -> float:
        target = q * total
        cum = 0.0
        for i, m in enumerate(mass):
            if cum + m >= target:
                return (i + ((target - cum) / m if m > 0 else 0)) / n
            cum += m
        return 1.0

    return {"lo": quantile(ALPHA), "hi": quantile(1 - ALPHA)}


def beta_posterior(k: float, n: float, prior: tuple[float, float] = (1, 1), points: int = 201) -> dict[str, Any]:
    """Beta posterior for k of n with prior Beta(a0, b0): a, b, mean, central 95 % interval (4000-cell grid), density on `points` points."""
    a = prior[0] + k
    b = prior[1] + n - k
    if not (a > 0 and b > 0):
        raise ValueError("beta_posterior: both Beta parameters must be positive")
    steps = max(2, int(points)) - 1
    grid = [{"x": i / steps, "y": beta_density(min(1 - 1e-9, max(1e-9, i / steps)), a, b)} for i in range(steps + 1)]
    return {"a": a, "b": b, "mean": a / (a + b), "interval": _beta_interval(a, b), "grid": grid}


def discounted_beta(
    weeks: Sequence[tuple[float, float]], delta: float, m: float, parent_share: float, as_of_index: int | None = None, points: int = 201
) -> dict[str, Any]:
    """D-041's discounted Beta: weekly (k, n), oldest first, weighted delta^(weeks before as-of); prior m × share, m × (1 - share)."""
    as_of = len(weeks) - 1 if as_of_index is None else as_of_index
    k = 0.0
    n = 0.0
    for i in range(min(as_of, len(weeks) - 1) + 1):
        w = delta ** (as_of - i)
        k += w * weeks[i][0]
        n += w * weeks[i][1]
    out = beta_posterior(k, n, (m * parent_share, m * (1 - parent_share)), points)
    out["effectiveN"] = n
    return out


def shares_by_period(
    records: Sequence[Any],
    start: str,
    end: str,
    period_days: int,
    event: Callable[[Any], bool],
    denominator: Callable[[Any], bool] | None = None,
    date: Callable[[Any], str] = lambda r: r.sample_date,
) -> list[dict[str, Any]]:
    """Shares per period of `period_days` from `start` to `end` inclusive (the last one cut at `end`), k among those passing
    `denominator`, each with its Wilson 95 % interval; share and interval None when n is 0."""
    if period_days < 1:
        raise ValueError("shares_by_period: period_days must be at least 1")
    periods: list[dict[str, Any]] = []
    day = start
    while day <= end:
        stop = add_days(day, period_days - 1)
        periods.append({"from": day, "to": stop if stop < end else end, "k": 0, "n": 0})
        day = add_days(day, period_days)
    for r in records:
        d = date(r)
        if d < start or d > end or (denominator is not None and not denominator(r)):
            continue
        idx = days_between(start, d) // period_days
        if 0 <= idx < len(periods):
            periods[idx]["n"] += 1
            if event(r):
                periods[idx]["k"] += 1
    for p in periods:
        if p["n"] == 0:
            p["share"], p["interval"] = None, None
        else:
            lo, hi = wilson(p["k"], p["n"])
            p["share"], p["interval"] = p["k"] / p["n"], {"lo": lo, "hi": hi}
    return periods
