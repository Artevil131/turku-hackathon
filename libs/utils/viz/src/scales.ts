// Scales and thresholds for the signal charts. Pure, no React.

/** −log10 p, clipped at `cap` (the surprise scale; ENGINE.md 3.2). */
export function surprise(p: number, cap = 6): number {
  if (!(p > 0)) return cap;
  return Math.min(cap, Math.max(0, -Math.log10(p)));
}

/** Alert levels of the live detectors (D-020, D-031). */
export const ALPHA: Record<string, number> = {
  "profile-excess": 1e-4,
  "phenotype-excess": 1e-3,
  "sampling-drop": 1e-4,
  "empty-run": 1e-4,
  "rising-trend": 1e-3,
};
