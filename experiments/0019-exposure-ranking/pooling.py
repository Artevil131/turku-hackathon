"""Pooled Mann-Whitney statistic over events or trials, as the plan's "Mathematical foundation" has it.

Per event e with n_pos,e positives and n_neg,e negatives, U_e = AUC_e * n_pos,e * n_neg,e is the number of (positive,
negative) pairs of the event where the positive has the higher score (ties half). The pooled statistic is
Σ_e U_e / Σ_e n_pos,e * n_neg,e over events with at least one positive and one negative: the probability that a
positive outranks a negative of the same event, over within-event pairs, so scores of different sources are never
compared. The null pools replicate j of every event, p = (1 + #{null >= U}) / (n + 1) as the harness's `_p_upper`.
The spread beside the AUC is the null's 2.5th and 97.5th percentiles; the bootstrap over events (or trials) is an
addition of the run, not of the plan.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from aei import score_prediction as sp


@dataclass
class EventAuc:
    """One event's AUC for one exposure and one outcome: observed, and per replicate of the rewiring null."""

    key: str
    n_pos: int
    n_neg: int
    auc: float  # NaN when undefined
    null: np.ndarray  # (replicates,) AUC per rewiring; empty when the AUC is undefined

    @property
    def usable(self) -> bool:
        return self.n_pos >= 1 and self.n_neg >= 1 and not np.isnan(self.auc) and len(self.null) > 0

    @property
    def pairs(self) -> int:
        return self.n_pos * self.n_neg

    @property
    def u(self) -> float:
        return round(self.auc * self.pairs * 2) / 2  # U is a multiple of 1/2; rounding removes float noise


def pooled(events: list[EventAuc], *, n_boot: int = 1000, seed: int = 2026) -> dict:
    """The pooled AUC, its rewiring p and null band, and a bootstrap interval over the usable events."""
    use = [e for e in events if e.usable]
    out: dict = {
        "events": len(use),
        "events_total": len(events),
        "positives": int(sum(e.n_pos for e in events)),
        "pairs": int(sum(e.pairs for e in use)),
        "auc": None,
        "p": None,
        "null_lo": None,
        "null_hi": None,
        "null_mean": None,
        "boot_lo": None,
        "boot_hi": None,
    }
    if not use:
        return out
    pairs = np.array([e.pairs for e in use], dtype=float)
    u = np.array([e.u for e in use], dtype=float)
    obs = float(u.sum() / pairs.sum())
    null = (np.stack([e.null * e.pairs for e in use]).sum(axis=0)) / pairs.sum()
    out.update(
        auc=obs,
        p=sp._p_upper(null, obs),
        null_lo=float(np.percentile(null, 2.5)),
        null_hi=float(np.percentile(null, 97.5)),
        null_mean=float(null.mean()),
    )
    if len(use) >= 2:
        rng = np.random.default_rng(seed)
        idx = rng.integers(0, len(use), size=(n_boot, len(use)))
        boot = u[idx].sum(axis=1) / pairs[idx].sum(axis=1)
        out["boot_lo"], out["boot_hi"] = float(np.percentile(boot, 2.5)), float(np.percentile(boot, 97.5))
    return out


def mean_corr(obs: list[float], null: list[np.ndarray]) -> dict:
    """The average over events of a rank correlation, with the permutation null of the average (replicate j of every
    event averaged) and p = (1 + #{null >= observed}) / (n + 1)."""
    keep = [i for i, o in enumerate(obs) if not np.isnan(o)]
    if not keep:
        return {"events": 0, "corr": None, "p": None, "null_lo": None, "null_hi": None}
    m = float(np.mean([obs[i] for i in keep]))
    nm = np.mean(np.stack([null[i] for i in keep]), axis=0)
    return {
        "events": len(keep),
        "corr": m,
        "p": sp._p_upper(nm, m),
        "null_lo": float(np.percentile(nm, 2.5)),
        "null_hi": float(np.percentile(nm, 97.5)),
    }
