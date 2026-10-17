// Scales and thresholds for the signal charts. Pure, no React.

import { detectorMethodIds, parameterDefaults } from "@aei/methods";

/** −log10 p, clipped at `cap` (the surprise scale; ENGINE.md 3.2). */
export function surprise(p: number, cap = 6): number {
  if (!(p > 0)) return cap;
  return Math.min(cap, Math.max(0, -Math.log10(p)));
}

/** Alert levels of the live detectors (D-020, D-031). */
export const ALPHA: Record<string, number> = Object.fromEntries(
  Object.entries(detectorMethodIds).map(([detector, id]) => [detector, parameterDefaults[id].alpha]),
);
