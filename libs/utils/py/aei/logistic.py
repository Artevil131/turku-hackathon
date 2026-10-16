"""L2-penalised logistic regression by Newton's method (mirrors @aei/logistic).

The intercept is first and not penalised; the Hessian's intercept entry gets 1e-9, the intercept starts at the
smoothed observed log odds, and the fit stops when no weight moves by 1e-8 or more, as in the TypeScript.
Sums run through numpy here, so weights agree with the TypeScript to rounding (about 1e-12), not bit for bit.
"""

from __future__ import annotations

import math
from collections.abc import Sequence
from dataclasses import dataclass

import numpy as np


@dataclass(slots=True)
class LogisticModel:
    weights: list[float]  # intercept first
    iterations: int
    converged: bool


def sigmoid(z: float) -> float:
    return 1 / (1 + math.exp(-z)) if z >= 0 else math.exp(z) / (1 + math.exp(z))


def _sigmoid(z: np.ndarray) -> np.ndarray:
    q = np.exp(-np.abs(z))
    return np.where(z >= 0, 1 / (1 + q), q / (1 + q))


def predict(model: LogisticModel, x: Sequence[float]) -> float:
    z = model.weights[0]
    for w, v in zip(model.weights[1:], x, strict=True):
        z += w * v
    return sigmoid(z)


def fit_logistic(
    x: Sequence[Sequence[float]], y: Sequence[int], l2: float = 1.0, max_iterations: int = 50, tolerance: float = 1e-8
) -> LogisticModel:
    """Fit on rows `x` (features, no intercept column) and 0/1 outcomes `y`."""
    n = len(y)
    d = (len(x[0]) if n else 0) + 1
    X = np.ones((n, d))
    if n and d > 1:
        X[:, 1:] = np.asarray(x, dtype=float)
    Y = np.asarray(y, dtype=float)
    mean = (float(Y.sum()) + 0.5) / (n + 1) if n else 0.5
    w = np.zeros(d)
    w[0] = math.log(mean / (1 - mean))
    penalty = np.full(d, l2)
    penalty[0] = 0.0
    for it in range(1, max_iterations + 1):
        p = _sigmoid(X @ w)
        grad = X.T @ (p - Y) + penalty * w
        hess = (X * (p * (1 - p))[:, None]).T @ X + np.diag(penalty)
        hess[0, 0] += 1e-9
        step = np.linalg.solve(hess, grad)
        w = w - step
        if float(np.max(np.abs(step))) < tolerance:
            return LogisticModel(w.tolist(), it, True)
    return LogisticModel(w.tolist(), max_iterations, False)
