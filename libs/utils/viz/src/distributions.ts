// Poisson mass and tail shapes for the signal charts. Pure, no React.
// The tails are the live detectors' own tests (@aei/detect), so a drawn shaded area is the p the alert carries.

import { poissonLower, poissonUpper } from "@aei/detect";
import { logGamma } from "./density.ts";

/** P(X = k) for X ~ Poisson(mean), in log space (ENGINE.md 3.2, 3.3). */
export function poissonPmf(k: number, mean: number): number {
  if (mean <= 0) return k === 0 ? 1 : 0;
  return Math.exp(k * Math.log(mean) - mean - logGamma(k + 1));
}

/** The probability that is shaded: X ≥ k (upper), X ≤ k (lower). Reuses @aei/detect's poissonUpper and poissonLower (D-020). */
export function poissonTailMass(tail: "upper" | "lower", k: number, mean: number): number {
  return tail === "upper" ? poissonUpper(k, mean) : poissonLower(k, mean);
}

export type TailKind = "upper" | "lower" | "zero-run";

export interface PoissonPlan {
  tail: TailKind;
  /** The Poisson mean that is drawn. */
  mean: number;
  /** The count that is marked. */
  k: number;
  kMin: number;
  kMax: number;
  /** Shaded probability, from the live detector's tail. */
  shaded: number;
  bars: { k: number; pmf: number; shaded: boolean; observed: boolean }[];
}

/**
 * What the live detector tests (D-020, D-031; ENGINE.md 3.2):
 * profile/phenotype excess: P(X ≥ observed | Poisson(expected));
 * sampling drop: P(X ≤ observed | Poisson(expected));
 * empty run: observed = run length L days, expected = λ per day, p = exp(−λL) = P(X = 0 | Poisson(λL)).
 * Returns null for detectors without a count (rising trend).
 */
export function poissonPlan(detector: string, observed: number, expected: number): PoissonPlan | null {
  let tail: TailKind;
  if (detector === "profile-excess" || detector === "phenotype-excess") tail = "upper";
  else if (detector === "sampling-drop") tail = "lower";
  else if (detector === "empty-run") tail = "zero-run";
  else return null;
  const mean = tail === "zero-run" ? expected * observed : expected;
  const k = tail === "zero-run" ? 0 : Math.round(observed);
  const spread = Math.ceil(4 * Math.sqrt(mean));
  const kMin = Math.max(0, Math.min(k, Math.floor(mean) - spread));
  const kMax = Math.min(kMin + 79, Math.max(k + 2, Math.ceil(mean) + spread, kMin + 4));
  const shadedTail = tail === "upper" ? "upper" : "lower";
  const inTail = (x: number) => (shadedTail === "upper" ? x >= k : x <= k);
  const bars = [];
  for (let x = kMin; x <= kMax; x++) bars.push({ k: x, pmf: poissonPmf(x, mean), shaded: inTail(x), observed: x === k });
  return { tail, mean, k, kMin, kMax, shaded: poissonTailMass(shadedTail, k, mean), bars };
}
