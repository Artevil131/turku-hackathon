// Densities for the coverage chart. Pure, no React.
// ENGINE.md section 0 (Beta for a proportion) and 2.1 (a share with borrowed strength; here the flat prior, Beta(1, 1)).
// No decision in DECISIONS.md fixes the plotted prior; the curve only shows what `covered` of `known` allows.

/** ln Γ(x) by the Lanczos approximation (g = 7, n = 9), with reflection below 0.5. */
export function logGamma(x: number): number {
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  const y = x - 1;
  let a = c[0] as number;
  const t = y + 7.5;
  for (let i = 1; i < 9; i++) a += (c[i] as number) / (y + i);
  return 0.5 * Math.log(2 * Math.PI) + (y + 0.5) * Math.log(t) - t + Math.log(a);
}

/** Density of Beta(a, b) at x in (0, 1), in log space (ENGINE.md section 0). */
export function betaDensity(x: number, a: number, b: number): number {
  if (x <= 0 || x >= 1) return 0;
  const logB = logGamma(a) + logGamma(b) - logGamma(a + b);
  return Math.exp((a - 1) * Math.log(x) + (b - 1) * Math.log(1 - x) - logB);
}

/** The curve of what `covered` of `known` allows: Beta(covered+1, known−covered+1) (flat prior), sampled on 0..1 (ENGINE.md 2.1). */
export function betaGrid(covered: number, known: number, steps = 200): { x: number; y: number }[] {
  const a = covered + 1;
  const b = known - covered + 1;
  const out = [];
  for (let i = 0; i <= steps; i++) {
    const x = Math.min(1 - 1e-9, Math.max(1e-9, i / steps));
    out.push({ x: i / steps, y: betaDensity(x, a, b) });
  }
  return out;
}
