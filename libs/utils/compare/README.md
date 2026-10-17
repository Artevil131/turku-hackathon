# @aei/compare

The researcher's first statistical tools (D-068). Pure functions; the Tools window calls them, and
`aei.compare` (libs/utils/py/aei/compare.py) mirrors them with the same arithmetic, parity-tested to 1e-9.

    proportionDifference(k1, n1, k2, n2)    // diff = p2 − p1, Newcombe hybrid score interval (Wilson, z = 1.96), pooled two-sided z test
    rateRatio(k1, t1, k2, t2)               // rate2/rate1, exact conditional 95 % interval (Clopper–Pearson by bisection), exact two-sided p
    trendAcross(bins)                       // one-sided Cochran–Armitage, the live detector's test
    betaPosterior(k, n, prior?, points?)    // Beta(a0 + k, b0 + n − k): mean, central 95 % interval, density grid
    discountedBeta(weeks, { delta, m, parentShare, asOfIndex?, points? })   // D-041: weights delta^age, prior m × share
    sharesByPeriod(records, { from, to, periodDays, event, denominator? })  // k, n, share, Wilson interval per period

Edges: `n = 0` in `proportionDifference` gives NaN for everything but the shares; no events in `rateRatio`
gives ratio NaN, interval 0 to Infinity, p = 1; `k1 = 0` gives ratio Infinity. The Beta interval is read
from a fixed 4000-cell grid (accurate to about 1e-3 near the ends, less for a Beta with a parameter
below 1), independent of the `points` plotted. Built on `@aei/coverage` (`wilson`), `@aei/detect`
(`cochranArmitageRising`, `normalUpper`), `@aei/viz` (`betaDensity`, `logGamma`) and `@aei/replay`.
