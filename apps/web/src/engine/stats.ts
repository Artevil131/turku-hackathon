// Small, dependency-free statistical tests used by the signal engine.
// All functions are pure and work on plain counts.

const LOG_FACT: number[] = [0];

/** ln(n!) for integer n >= 0 (exact table, grown on demand). */
export function logFactorial(n: number): number {
  if (n < 0) return NaN;
  for (let i = LOG_FACT.length; i <= n; i++) LOG_FACT[i] = LOG_FACT[i - 1]! + Math.log(i);
  return LOG_FACT[n]!;
}

function poissonLogPmf(k: number, lambda: number): number {
  if (lambda <= 0) return k === 0 ? 0 : -Infinity;
  return -lambda + k * Math.log(lambda) - logFactorial(k);
}

/** P(X >= k) for X ~ Poisson(lambda). Summed upwards from k, so tiny tails stay accurate. */
export function poissonUpper(k: number, lambda: number): number {
  if (k <= 0) return 1;
  if (lambda <= 0) return 0;
  let sum = 0;
  let i = k;
  let term = Math.exp(poissonLogPmf(k, lambda));
  // Terms fall once i > lambda; stop when they no longer change the sum.
  for (; i < k + 10000; i++) {
    sum += term;
    term *= lambda / (i + 1);
    if (i > lambda && term < sum * 1e-15) break;
  }
  return Math.min(1, sum);
}

/** P(X <= k) for X ~ Poisson(lambda). */
export function poissonLower(k: number, lambda: number): number {
  if (k < 0) return 0;
  if (lambda <= 0) return 1;
  let sum = 0;
  for (let i = 0; i <= k; i++) sum += Math.exp(poissonLogPmf(i, lambda));
  return Math.min(1, sum);
}

function logChoose(n: number, k: number): number {
  return logFactorial(n) - logFactorial(k) - logFactorial(n - k);
}

/**
 * One-sided Fisher exact mid-p that group 1 has a HIGHER proportion than group 2.
 * a of n1 in group 1, b of n2 in group 2. mid-p = P(X > a) + P(X = a) / 2 under the
 * hypergeometric null with the margins fixed.
 */
export function fisherMidPGreater(a: number, n1: number, b: number, n2: number): number {
  const k = a + b;
  const n = n1 + n2;
  if (n1 === 0 || n2 === 0 || k === 0 || k === n) return 1;
  const hi = Math.min(k, n1);
  const lo = Math.max(0, k - n2);
  const denom = logChoose(n, k);
  const pmf = (x: number) => Math.exp(logChoose(n1, x) + logChoose(n2, k - x) - denom);
  let p = 0.5 * pmf(a);
  for (let x = Math.max(a + 1, lo); x <= hi; x++) p += pmf(x);
  return Math.min(1, Math.max(0, p));
}

/** Complementary error function (Numerical Recipes erfcc, relative error < 1.2e-7). */
function erfc(x: number): number {
  const z = Math.abs(x);
  const t = 1 / (1 + 0.5 * z);
  const r =
    t *
    Math.exp(
      -z * z -
        1.26551223 +
        t *
          (1.00002368 +
            t *
              (0.37409196 +
                t *
                  (0.09678418 +
                    t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))),
    );
  return x >= 0 ? r : 2 - r;
}

/** P(Z >= z) for a standard normal Z. */
export function normalUpper(z: number): number {
  return 0.5 * erfc(z / Math.SQRT2);
}

/**
 * Cochran-Armitage test for a rising proportion across ordered bins (scores 0, 1, 2, ...).
 * Returns the z statistic and the one-sided p that the proportion increases.
 */
export function cochranArmitageUp(events: readonly number[], totals: readonly number[]): { z: number; p: number } {
  let N = 0;
  let R = 0;
  let st = 0;
  let stt = 0;
  for (let i = 0; i < totals.length; i++) {
    const n = totals[i]!;
    N += n;
    R += events[i]!;
    st += n * i;
    stt += n * i * i;
  }
  if (N === 0 || R === 0 || R === N) return { z: 0, p: 1 };
  const pbar = R / N;
  let T = 0;
  for (let i = 0; i < totals.length; i++) T += i * (events[i]! - totals[i]! * pbar);
  const v = pbar * (1 - pbar) * (stt - (st * st) / N);
  if (v <= 0) return { z: 0, p: 1 };
  const z = T / Math.sqrt(v);
  return { z, p: normalUpper(z) };
}
