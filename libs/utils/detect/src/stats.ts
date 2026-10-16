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
  // Terms fall from x = max(k, mean) on; stop once they no longer add to the
  // sum, including when they underflow to 0 (a far tail of a tiny mean).
  let sum = 0;
  for (let x = k; ; x++) {
    const term = Math.exp(poissonLogPmf(x, mean));
    sum += term;
    if (x > mean && (term === 0 || term < sum * 1e-15)) break;
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
