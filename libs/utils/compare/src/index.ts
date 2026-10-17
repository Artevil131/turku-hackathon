import { wilson } from "@aei/coverage";
import { cochranArmitageRising, normalUpper } from "@aei/detect";
import { addDays, daysBetween } from "@aei/replay";
import { betaDensity, logGamma } from "@aei/viz";

// The researcher's first statistical tools: two shares, two rates, a trend, a Beta posterior and
// the discounted Beta of D-041, shares by period. Pure functions; the interval and test choices
// are D-068. The Python mirror is libs/utils/py/aei/compare.py (same arithmetic, parity-tested).

export interface Interval {
  lo: number;
  hi: number;
}

const Z = 1.96;
const ALPHA = 0.025;
const BISECTIONS = 100;
/** Cells of the internal grid the Beta interval is read from; independent of the plotted `points`. */
const INTERVAL_CELLS = 4000;

/**
 * Two proportions: k1 of n1 against k2 of n2. diff = p2 − p1; the interval is Newcombe's hybrid score
 * interval built from the two Wilson intervals (z = 1.96); p is the two-sided normal test of the
 * difference (pooled). With n1 or n2 = 0 nothing can be said: every number but the shares is NaN.
 */
export function proportionDifference(
  k1: number,
  n1: number,
  k2: number,
  n2: number,
): { p1: number; p2: number; diff: number; interval: Interval; z: number; p: number } {
  const p1 = n1 > 0 ? k1 / n1 : Number.NaN;
  const p2 = n2 > 0 ? k2 / n2 : Number.NaN;
  if (n1 === 0 || n2 === 0) return { p1, p2, diff: Number.NaN, interval: { lo: Number.NaN, hi: Number.NaN }, z: Number.NaN, p: Number.NaN };
  const [l1, u1] = wilson(k1, n1, Z);
  const [l2, u2] = wilson(k2, n2, Z);
  const diff = p2 - p1;
  const interval = {
    lo: diff - Math.sqrt((p2 - l2) ** 2 + (u1 - p1) ** 2),
    hi: diff + Math.sqrt((u2 - p2) ** 2 + (p1 - l1) ** 2),
  };
  const pooled = (k1 + k2) / (n1 + n2);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / n1 + 1 / n2));
  const z = se > 0 ? diff / se : 0;
  return { p1, p2, diff, interval, z, p: z === 0 ? 1 : Math.min(1, 2 * normalUpper(Math.abs(z))) };
}

const logChoose = (n: number, k: number) => logGamma(n + 1) - logGamma(k + 1) - logGamma(n - k + 1);

function binomialPmf(k: number, n: number, p: number): number {
  if (p <= 0) return k === 0 ? 1 : 0;
  if (p >= 1) return k === n ? 1 : 0;
  return Math.exp(logChoose(n, k) + k * Math.log(p) + (n - k) * Math.log(1 - p));
}

function binomialSum(from: number, to: number, n: number, p: number): number {
  let s = 0;
  for (let i = from; i <= to; i++) s += binomialPmf(i, n, p);
  return Math.min(1, s);
}

/** Clopper–Pearson bounds for k of n by bisection on the binomial tails (each tail ALPHA). */
function clopperPearson(k: number, n: number): [number, number] {
  let lo = 0;
  if (k > 0) {
    let a = 0;
    let b = 1;
    for (let i = 0; i < BISECTIONS; i++) {
      const m = (a + b) / 2;
      if (binomialSum(k, n, n, m) < ALPHA) a = m;
      else b = m;
    }
    lo = (a + b) / 2;
  }
  let hi = 1;
  if (k < n) {
    let a = 0;
    let b = 1;
    for (let i = 0; i < BISECTIONS; i++) {
      const m = (a + b) / 2;
      if (binomialSum(0, k, n, m) > ALPHA) a = m;
      else b = m;
    }
    hi = (a + b) / 2;
  }
  return [lo, hi];
}

/**
 * Two Poisson counts over exposures t1, t2 (e.g. weeks): ratio = rate2/rate1 with the exact conditional
 * (binomial) 95 % interval and the two-sided exact p. Given k1 + k2 events, k2 is binomial with
 * π = t2/(t1+t2) under equal rates; the interval is Clopper–Pearson on k2 of k1 + k2 turned into a
 * ratio, the p sums every outcome no likelier than the observed one. No events at all: ratio NaN,
 * interval 0 to Infinity, p = 1. Exposures must be positive.
 */
export function rateRatio(
  k1: number,
  t1: number,
  k2: number,
  t2: number,
): { rate1: number; rate2: number; ratio: number; interval: Interval; p: number } {
  if (!(t1 > 0 && t2 > 0)) throw new RangeError("rateRatio: exposures must be positive");
  const rate1 = k1 / t1;
  const rate2 = k2 / t2;
  const total = k1 + k2;
  if (total === 0) return { rate1, rate2, ratio: Number.NaN, interval: { lo: 0, hi: Number.POSITIVE_INFINITY }, p: 1 };
  const [pl, pu] = clopperPearson(k2, total);
  const scale = t1 / t2;
  const toRatio = (q: number) => (q >= 1 ? Number.POSITIVE_INFINITY : (q / (1 - q)) * scale);
  const pi0 = t2 / (t1 + t2);
  const observed = binomialPmf(k2, total, pi0);
  let p = 0;
  for (let i = 0; i <= total; i++) {
    const m = binomialPmf(i, total, pi0);
    if (m <= observed * (1 + 1e-7)) p += m;
  }
  return {
    rate1,
    rate2,
    ratio: k1 === 0 ? Number.POSITIVE_INFINITY : rate2 / rate1,
    interval: { lo: toRatio(pl), hi: toRatio(pu) },
    p: Math.min(1, p),
  };
}

/** Trend across ordered bins, the same one-sided Cochran–Armitage the live detector uses (`cochranArmitageRising`); returns its p. */
export function trendAcross(bins: readonly { events: number; n: number }[]): { p: number } {
  return { p: cochranArmitageRising(bins) };
}

const clampX = (x: number) => Math.min(1 - 1e-9, Math.max(1e-9, x));

/** Central 95 % interval of Beta(a, b) from a fixed midpoint grid, linear inside the crossing cell. */
function betaInterval(a: number, b: number): Interval {
  const n = INTERVAL_CELLS;
  const mass: number[] = [];
  let total = 0;
  for (let i = 0; i < n; i++) {
    const m = betaDensity((i + 0.5) / n, a, b);
    mass.push(m);
    total += m;
  }
  const quantile = (q: number) => {
    const target = q * total;
    let cum = 0;
    for (let i = 0; i < n; i++) {
      const m = mass[i] as number;
      if (cum + m >= target) return (i + (m > 0 ? (target - cum) / m : 0)) / n;
      cum += m;
    }
    return 1;
  };
  return { lo: quantile(ALPHA), hi: quantile(1 - ALPHA) };
}

/**
 * Beta posterior for k of n with prior Beta(a0, b0) (flat 1,1 by default): parameters, mean, the central
 * 95 % interval (numerical, from a fixed 4000-cell grid), and the density on `points` grid points over
 * [0, 1] (default 201, end points evaluated just inside). k may be fractional (discounted counts);
 * a posterior with a or b not above 0 is a RangeError.
 */
export function betaPosterior(
  k: number,
  n: number,
  prior: { a: number; b: number } = { a: 1, b: 1 },
  points = 201,
): { a: number; b: number; mean: number; interval: Interval; grid: { x: number; y: number }[] } {
  const a = prior.a + k;
  const b = prior.b + n - k;
  if (!(a > 0 && b > 0)) throw new RangeError("betaPosterior: both Beta parameters must be positive");
  const steps = Math.max(2, Math.floor(points)) - 1;
  const grid = [];
  for (let i = 0; i <= steps; i++) {
    const x = i / steps;
    grid.push({ x, y: betaDensity(clampX(x), a, b) });
  }
  return { a, b, mean: a / (a + b), interval: betaInterval(a, b), grid };
}

/**
 * D-041's discounted Beta: counts per week (oldest first) are weighted by delta^(weeks before asOf),
 * pseudo-counts m × share from the level above as the prior; returns the posterior as above for the
 * week at `asOfIndex` (default the last), with the discounted sample size. Weeks after it are ignored.
 */
export function discountedBeta(
  weeks: readonly { k: number; n: number }[],
  options: { delta: number; m: number; parentShare: number; asOfIndex?: number; points?: number },
): ReturnType<typeof betaPosterior> & { effectiveN: number } {
  const asOf = options.asOfIndex ?? weeks.length - 1;
  let k = 0;
  let n = 0;
  for (let i = 0; i <= asOf && i < weeks.length; i++) {
    const w = options.delta ** (asOf - i);
    const week = weeks[i] as { k: number; n: number };
    k += w * week.k;
    n += w * week.n;
  }
  const prior = { a: options.m * options.parentShare, b: options.m * (1 - options.parentShare) };
  return { ...betaPosterior(k, n, prior, options.points), effectiveN: n };
}

/**
 * Shares per period from records: `periodDays` from `from` to `to` (inclusive), k = records passing `event`
 * (among those passing `denominator`, so k ≤ n), n = records passing `denominator` (default all); each with
 * its Wilson 95 % interval. The last period is cut at `to`. n = 0: share and interval null.
 */
export function sharesByPeriod<R extends { sampleDate: string }>(
  records: readonly R[],
  options: { from: string; to: string; periodDays: number; event: (r: R) => boolean; denominator?: (r: R) => boolean },
): { from: string; to: string; k: number; n: number; share: number | null; interval: Interval | null }[] {
  const { from, to, periodDays } = options;
  if (!(Number.isInteger(periodDays) && periodDays >= 1))
    throw new RangeError("sharesByPeriod: periodDays must be a whole number of days, at least 1");
  const periods: { from: string; to: string; k: number; n: number }[] = [];
  for (let start = from; start <= to; start = addDays(start, periodDays)) {
    const end = addDays(start, periodDays - 1);
    periods.push({ from: start, to: end < to ? end : to, k: 0, n: 0 });
  }
  const inDenominator = options.denominator ?? (() => true);
  for (const r of records) {
    if (r.sampleDate < from || r.sampleDate > to || !inDenominator(r)) continue;
    const period = periods[Math.floor(daysBetween(from, r.sampleDate) / periodDays)];
    if (!period) continue;
    period.n++;
    if (options.event(r)) period.k++;
  }
  return periods.map((p) => {
    if (p.n === 0) return { ...p, share: null, interval: null };
    const [lo, hi] = wilson(p.k, p.n);
    return { ...p, share: p.k / p.n, interval: { lo, hi } };
  });
}
