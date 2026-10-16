// Small exact and asymptotic tests used by the detectors. Pure functions.

const LOG_FACT: number[] = [0];
function logFactorial(n: number): number {
  for (let i = LOG_FACT.length; i <= n; i++) LOG_FACT.push((LOG_FACT[i - 1] as number) + Math.log(i));
  return LOG_FACT[n] as number;
}

const poissonLogPmf = (k: number, mean: number) => (mean === 0 ? (k === 0 ? 0 : -Infinity) : k * Math.log(mean) - mean - logFactorial(k));

/** P(X ≥ k) for X ~ Poisson(mean). */
export function poissonUpper(k: number, mean: number): number {
  if (k <= 0) return 1;
  if (mean <= 0) return 0;
  let sum = 0;
  for (let x = k; ; x++) {
    const term = Math.exp(poissonLogPmf(x, mean));
    sum += term;
    if (x > mean && term < sum * 1e-15) break;
  }
  return Math.min(1, sum);
}

/** P(X ≤ k) for X ~ Poisson(mean). */
export function poissonLower(k: number, mean: number): number {
  if (k < 0) return 0;
  if (mean <= 0) return 1;
  let sum = 0;
  for (let x = 0; x <= k; x++) sum += Math.exp(poissonLogPmf(x, mean));
  return Math.min(1, sum);
}

/**
 * One-sided mid-p Fisher exact test that the first row has a higher
 * proportion than the second: rows (a, b) and (c, d), first column the
 * events. Returns P(X > a) + P(X = a) / 2 under the hypergeometric null.
 */
export function fisherMidPGreater(a: number, b: number, c: number, d: number): number {
  const row1 = a + b;
  const col1 = a + c;
  const n = a + b + c + d;
  const lo = Math.max(0, col1 - (n - row1));
  const hi = Math.min(row1, col1);
  const logDen = logFactorial(n) - logFactorial(row1) - logFactorial(n - row1) - logFactorial(col1) - logFactorial(n - col1);
  const logP = (x: number) =>
    -logDen - logFactorial(x) - logFactorial(row1 - x) - logFactorial(col1 - x) - logFactorial(n - row1 - col1 + x);
  if (a < lo || a > hi) return a > hi ? 0 : 1;
  let p = 0.5 * Math.exp(logP(a));
  for (let x = a + 1; x <= hi; x++) p += Math.exp(logP(x));
  return Math.min(1, p);
}

/** Standard normal upper tail, P(Z ≥ z). */
export function normalUpper(z: number): number {
  // Abramowitz and Stegun 7.1.26 on erfc, absolute error below 1.5e-7.
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const erfc = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429)))) * Math.exp(-x * x);
  return z >= 0 ? erfc / 2 : 1 - erfc / 2;
}

/**
 * Cochran-Armitage test for a rising proportion over ordered groups
 * (scores 0, 1, 2, ...). Returns the one-sided p-value for an increase.
 */
export function cochranArmitageRising(groups: readonly { events: number; n: number }[]): number {
  const N = groups.reduce((s, g) => s + g.n, 0);
  const R = groups.reduce((s, g) => s + g.events, 0);
  if (N === 0 || R === 0 || R === N) return 1;
  const pBar = R / N;
  let t = 0;
  let sx = 0;
  let sxx = 0;
  groups.forEach((g, i) => {
    t += i * (g.events - g.n * pBar);
    sx += g.n * i;
    sxx += g.n * i * i;
  });
  const variance = pBar * (1 - pBar) * (sxx - (sx * sx) / N);
  return variance > 0 ? normalUpper(t / Math.sqrt(variance)) : 1;
}
