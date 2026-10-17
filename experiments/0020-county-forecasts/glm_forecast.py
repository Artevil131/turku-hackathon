"""Rolling Poisson GLM with annual harmonics as a county forecaster for `aei.score_prediction` (experiment 0020).

The model, its guards and the predictive distribution are written out in the experiment's README ("Mathematical
foundation"). In short, for one series and target month t, on the window of the W months before t:

    log mu(tau) = b0 [+ b1 (tau - t) / 12] + sum_{k=1..K} a_k sin(2 pi k tau / 12) + b_k cos(2 pi k tau / 12)

fitted by Fisher scoring (Newton for the canonical link, batched over series), the forecast mean being the fitted curve
at tau = t. The predictive is a negative binomial with mean max(mu_hat, floor) and variance phi * mean, phi from the
window's Pearson statistic (per series, or pooled over a phenotype's counties), Poisson when phi is 1.

    spec = Spec(window=36, k=1, trend=True, rho=0.0, dispersion="quasi_pooled", floor=0.1)
    forecaster = GLMForecaster(spec)               # or {phenotype: Spec}
    score_prediction.evaluate(forecaster)

A forecaster reads only the `History` it is given.
"""

from __future__ import annotations

import math
from collections.abc import Mapping
from dataclasses import dataclass, field

import numpy as np
from scipy import stats

from aei.regional import NATIONAL

FIT, SPARSE, NO_CONVERGE, EXPLOSION, EMPTY = range(5)
STATUS = ("fit", "sparse", "no_converge", "explosion", "empty")
DISPERSIONS = ("poisson", "quasi_pooled", "quasi")  # also the tie order of the selection rule (simplest first)
POISSON_EPS = 1e-9  # phi - 1 below this: Poisson, as aei.regional.upper_tail
QUANTILES = (0.05, 0.5, 0.95)
MAX_STEPS = 30
EXPLOSION_FACTOR = 3.0


@dataclass(frozen=True)
class Spec:
    """One cell of the grid: the mean model (window, k, trend, rho) and the predictive (dispersion, floor)."""

    window: int
    k: int
    trend: bool
    rho: float
    dispersion: str
    floor: float

    @property
    def fit_key(self) -> tuple:
        return (self.window, self.k, self.trend, self.rho)

    @property
    def n_params(self) -> int:
        return 1 + int(self.trend) + 2 * self.k

    def label(self) -> str:
        return f"W{self.window} K{self.k} trend={'on' if self.trend else 'off'} rho={self.rho:g} {self.dispersion} floor={self.floor:g}"

    def as_dict(self) -> dict:
        return {"window": self.window, "k": self.k, "trend": self.trend, "rho": self.rho, "dispersion": self.dispersion, "floor": self.floor}


def design(window: int, target_index: int, k: int, trend: bool) -> tuple[np.ndarray, np.ndarray]:
    """Design matrix of the window (rows tau = t-W .. t-1) and the row of the target month t. `target_index` counts
    months from 2021-01, so the harmonics are tied to the calendar month."""

    def cols(rel: np.ndarray, tau: np.ndarray) -> np.ndarray:
        c = [np.ones_like(rel)]
        if trend:
            c.append(rel / 12.0)
        for h in range(1, k + 1):
            c += [np.sin(2 * np.pi * h * tau / 12.0), np.cos(2 * np.pi * h * tau / 12.0)]
        return np.column_stack(c)

    rel = np.arange(-window, 0, dtype=float)
    return cols(rel, target_index + rel), cols(np.zeros(1), np.array([float(target_index)]))[0]


def _deviance(y: np.ndarray, mu: np.ndarray) -> np.ndarray:
    with np.errstate(divide="ignore", invalid="ignore"):
        t = np.where(y > 0, y * np.log(y / mu), 0.0)
    return 2.0 * (t - (y - mu)).sum(axis=-1)


def _newton(y: np.ndarray, x: np.ndarray, tol: float = 1e-10) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Poisson log-link MLE for every row of `y` (series x window; each row has at least one case) on the shared design
    `x`, by Newton steps (Fisher scoring) with step halving, at most MAX_STEPS. Returns coefficients, fitted means over
    the window and the converged flags."""
    s, p = y.shape[0], x.shape[1]
    beta = np.zeros((s, p))
    beta[:, 0] = np.log(y.mean(axis=1))
    mu = np.exp(np.clip(beta @ x.T, -40, 25))
    dev = _deviance(y, mu)
    active = np.ones(s, bool)
    converged = np.zeros(s, bool)
    eye = np.eye(p)
    for _ in range(MAX_STEPS):
        idx = np.flatnonzero(active)
        if idx.size == 0:
            break
        yy, b, m, d = y[idx], beta[idx], mu[idx], dev[idx]
        grad = (yy - m) @ x
        hess = np.einsum("aw,wp,wq->apq", m, x, x)
        hess = hess + (1e-10 * np.trace(hess, axis1=1, axis2=2) / p)[:, None, None] * eye  # solver conditioning only
        try:
            step = np.linalg.solve(hess, grad[..., None])[..., 0]
        except np.linalg.LinAlgError:
            step = np.einsum("apq,aq->ap", np.linalg.pinv(hess), grad)
        scale = np.ones(idx.size)
        for _h in range(30):  # step halving until the deviance does not rise
            bn = b + scale[:, None] * step
            mn = np.exp(np.clip(bn @ x.T, -40, 25))
            dn = _deviance(yy, mn)
            ok = np.isfinite(dn) & (dn <= d + 1e-12 * (np.abs(d) + 1.0))
            if ok.all():
                break
            scale = np.where(ok, scale, scale / 2)
        acc = idx[ok]
        beta[acc], mu[acc], dev[acc] = bn[ok], mn[ok], dn[ok]
        done = ok & (np.abs(d - dn) < tol * (np.abs(dn) + 0.1))
        converged[idx[done]] = True
        active[idx[done]] = False
        active[idx[~ok]] = False  # no acceptable step: not converged
    return beta, mu, converged


@dataclass
class Fit:
    """The mean model fitted on one batch of series (after the sparse-window rule and the guards).
    `mu`: forecast mean (0 for an empty window), `chi2`: Pearson statistic on the window, `p`: parameters actually used,
    `status`: FIT, SPARSE, NO_CONVERGE, EXPLOSION or EMPTY. `raw_mu`, `raw_chi2`, `raw_converged` are the full model's
    values before guards (NaN where it was not fitted), for the check against statsmodels."""

    mu: np.ndarray
    chi2: np.ndarray
    p: np.ndarray
    status: np.ndarray
    raw_mu: np.ndarray
    raw_chi2: np.ndarray
    raw_converged: np.ndarray


def fit_window(y: np.ndarray, window: int, target_index: int, k: int, trend: bool, rho: float) -> Fit:
    """Fit the mean model on `y` (series x window counts) for the target month `target_index`."""
    s = y.shape[0]
    x, x_t = design(window, target_index, k, trend)
    p = x.shape[1]
    total = y.sum(axis=1)
    ybar = total / window
    status = np.full(s, FIT)
    mu_t = np.zeros(s)
    chi2 = np.zeros(s)
    p_used = np.full(s, p)
    raw_mu = np.full(s, np.nan)
    raw_chi2 = np.full(s, np.nan)
    raw_conv = np.zeros(s, bool)

    empty = total == 0
    status[empty] = EMPTY
    p_used[empty] = 1
    level = np.zeros(s, bool)  # series that end up on the level-only fit
    if p == 1:
        level |= ~empty  # the model is the level alone: its MLE is the window mean, not a fallback
    else:
        sparse = ~empty & (total < rho * window)
        status[sparse] = SPARSE
        level |= sparse
        todo = np.flatnonzero(~empty & ~sparse)
        if todo.size:
            beta, mu_w, conv = _newton(y[todo], x)
            mt = np.exp(np.clip(beta @ x_t, -40, 25))
            with np.errstate(divide="ignore", invalid="ignore"):
                c2 = ((y[todo] - mu_w) ** 2 / mu_w).sum(axis=1)
            raw_mu[todo], raw_chi2[todo], raw_conv[todo] = mt, c2, conv
            blow = mt > EXPLOSION_FACTOR * np.maximum(1.0, y[todo].max(axis=1))
            good = conv & ~blow & np.isfinite(c2) & np.isfinite(mt)
            mu_t[todo[good]], chi2[todo[good]] = mt[good], c2[good]
            status[todo[~conv]] = NO_CONVERGE
            status[todo[conv & blow]] = EXPLOSION
            level[todo[~good]] = True
    lv = np.flatnonzero(level)
    if lv.size:
        yb = ybar[lv]
        mu_t[lv] = yb
        chi2[lv] = ((y[lv] - yb[:, None]) ** 2 / yb[:, None]).sum(axis=1)
        p_used[lv] = 1
    return Fit(mu_t, chi2, p_used, status, raw_mu, raw_chi2, raw_conv)


def dispersions(fit: Fit, window: int, kind: str, national: np.ndarray) -> np.ndarray:
    """phi for each series of a phenotype's batch. `poisson`: 1. `quasi`: max(1, chi2 / (W - p)). `quasi_pooled`: the
    counties of the batch share max(1, sum chi2 / sum (W - p)) over their non-empty windows; national keeps its own. An
    empty window has phi = 1."""
    empty = fit.status == EMPTY
    if kind == "poisson":
        return np.ones(len(fit.mu))
    df = window - fit.p
    own = np.where(empty, 1.0, np.maximum(1.0, fit.chi2 / df))
    if kind == "quasi":
        return own
    if kind != "quasi_pooled":
        raise ValueError(f"unknown dispersion {kind!r}")
    use = ~national & ~empty
    pooled = max(1.0, fit.chi2[use].sum() / df[use].sum()) if use.any() else 1.0
    return np.where(national | empty, own, pooled)


def quantiles(mu: np.ndarray, phi: np.ndarray, qs: tuple[float, ...] = QUANTILES) -> np.ndarray:
    """Predictive quantiles (len(qs) x series) of the Poisson or negative binomial with mean mu and variance phi * mu."""
    out = np.empty((len(qs), len(mu)))
    q = np.asarray(qs)[:, None]
    pois = phi <= 1.0 + POISSON_EPS
    if pois.any():
        out[:, pois] = stats.poisson.ppf(q, mu[pois][None, :])
    if (~pois).any():
        r = mu[~pois] / (phi[~pois] - 1.0)
        out[:, ~pois] = stats.nbinom.ppf(q, r[None, :], (1.0 / phi[~pois])[None, :])
    return out


class NBPredictive:
    """Negative binomial with mean `mu` and variance `phi * mu` (Poisson when phi is 1): the Gamma mixture of Poisson
    means with shape r = mu / (phi - 1), i.e. scipy's nbinom(n=r, p=1/phi). `logpmf` and `ppf` as the harness needs;
    the 5, 50 and 95 % quantiles are precomputed in batch."""

    __slots__ = ("mu", "phi", "_q")

    def __init__(self, mu: float, phi: float, q: tuple[float, float, float]) -> None:
        self.mu, self.phi, self._q = float(mu), float(phi), q

    def logpmf(self, y):
        if np.ndim(y):
            if self.phi <= 1.0 + POISSON_EPS:
                return stats.poisson.logpmf(y, self.mu)
            return stats.nbinom.logpmf(y, self.mu / (self.phi - 1.0), 1.0 / self.phi)
        y, mu, phi = float(y), self.mu, self.phi
        if phi <= 1.0 + POISSON_EPS:
            return y * math.log(mu) - mu - math.lgamma(y + 1.0)
        r = mu / (phi - 1.0)
        return math.lgamma(y + r) - math.lgamma(r) - math.lgamma(y + 1.0) - r * math.log(phi) + y * math.log((phi - 1.0) / phi)

    def ppf(self, q):
        if np.ndim(q) == 0:
            for known, value in zip(QUANTILES, self._q):
                if q == known:
                    return value
            return float(quantiles(np.array([self.mu]), np.array([self.phi]), (float(q),))[0, 0])
        return quantiles(np.array([self.mu]), np.array([self.phi]), tuple(float(v) for v in q))[:, 0]


@dataclass
class FitCache:
    """Fits shared between forecasters, keyed by the setting, the target, the phenotype and the window's content."""

    store: dict = field(default_factory=dict)
    fits: int = 0

    def get(self, y: np.ndarray, window: int, target_index: int, k: int, trend: bool, rho: float, target: str, ph: str) -> Fit:
        key = (window, k, trend, rho, target, ph, hash(y.tobytes()))
        if key not in self.store:
            self.store[key] = fit_window(y, window, target_index, k, trend, rho)
            self.fits += y.shape[0]
        return self.store[key]


class GLMForecaster:
    """A `score_prediction` forecaster: `spec` is one Spec for every phenotype or a mapping phenotype -> Spec. With
    `record`, `records[target]` keeps, per series (in `History.keys` order), mu, phi, the 5/50/95 % quantiles, the fit
    status and the window mean, for the diagnostics; each call overwrites its target's entry."""

    def __init__(self, spec: Spec | Mapping[str, Spec], cache: FitCache | None = None, record: bool = False) -> None:
        self.spec = spec
        self.cache = cache if cache is not None else FitCache()
        self.record = record
        self.records: dict[str, dict[str, np.ndarray]] = {}

    def _spec(self, ph: str) -> Spec:
        return self.spec[ph] if isinstance(self.spec, Mapping) else self.spec

    def __call__(self, history, target: str) -> dict:
        keys = history.keys
        values = history.values
        n_months = values.shape[1]  # the target's index counting from 2021-01
        phenos = sorted({k[0] for k in keys}, key=lambda ph: next(i for i, k in enumerate(keys) if k[0] == ph))
        out: dict = {}
        rec = {name: np.zeros(len(keys)) for name in ("mu", "phi", "q05", "q50", "q95", "status", "window_mean")}
        for ph in phenos:
            idx = np.array([i for i, k in enumerate(keys) if k[0] == ph])
            national = np.array([keys[i][1] == NATIONAL for i in idx])
            sp_ = self._spec(ph)
            y = np.asarray(values[idx, -sp_.window :], dtype=float)
            fit = self.cache.get(y, sp_.window, n_months, sp_.k, sp_.trend, sp_.rho, target, ph)
            phi = dispersions(fit, sp_.window, sp_.dispersion, national)
            mu = np.maximum(fit.mu, sp_.floor)
            q = quantiles(mu, phi)
            for j, i in enumerate(idx):
                out[keys[i]] = NBPredictive(mu[j], phi[j], (q[0, j], q[1, j], q[2, j]))
            rec["mu"][idx], rec["phi"][idx] = mu, phi
            rec["q05"][idx], rec["q50"][idx], rec["q95"][idx] = q
            rec["status"][idx], rec["window_mean"][idx] = fit.status, y.mean(axis=1)
        if self.record:
            self.records[target] = rec
        return out
