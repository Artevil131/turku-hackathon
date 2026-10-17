// Pure helpers for the math components (ENGINE.md sections 2 and 3). No React.

import type { IsoDate, IsolateRecord, Phenotype, WardCode } from "@aei/domain";

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

/** P(X = k) for X ~ Poisson(mean), in log space. */
export function poissonPmf(k: number, mean: number): number {
  if (mean <= 0) return k === 0 ? 1 : 0;
  return Math.exp(k * Math.log(mean) - mean - logGamma(k + 1));
}

/** The probability that is shaded: X ≥ k (upper), X ≤ k (lower). Summed from the pmf, no library tail function. */
export function tailSum(tail: "upper" | "lower", k: number, mean: number): number {
  if (tail === "lower") {
    let s = 0;
    for (let x = 0; x <= k; x++) s += poissonPmf(x, mean);
    return Math.min(1, s);
  }
  if (k <= 0) return 1;
  if (mean <= 0) return 0;
  let s = 0;
  for (let x = k; ; x++) {
    const term = poissonPmf(x, mean);
    s += term;
    if (x > mean && (term === 0 || term < s * 1e-16)) break;
  }
  return Math.min(1, s);
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
  /** Shaded probability, from the pmf. */
  shaded: number;
  bars: { k: number; pmf: number; shaded: boolean; observed: boolean }[];
}

/**
 * What the live detector tests (D-020, D-031):
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
  return { tail, mean, k, kMin, kMax, shaded: tailSum(shadedTail, k, mean), bars };
}

/** Density of Beta(a, b) at x in (0, 1), in log space. */
export function betaDensity(x: number, a: number, b: number): number {
  if (x <= 0 || x >= 1) return 0;
  const logB = logGamma(a) + logGamma(b) - logGamma(a + b);
  return Math.exp((a - 1) * Math.log(x) + (b - 1) * Math.log(1 - x) - logB);
}

/** The curve of what `covered` of `known` allows: Beta(covered+1, known−covered+1) (flat prior), sampled on 0..1. */
export function betaCurve(covered: number, known: number, steps = 200): { x: number; y: number }[] {
  const a = covered + 1;
  const b = known - covered + 1;
  const out = [];
  for (let i = 0; i <= steps; i++) {
    const x = Math.min(1 - 1e-9, Math.max(1e-9, i / steps));
    out.push({ x: i / steps, y: betaDensity(x, a, b) });
  }
  return out;
}

/** −log10 p, clipped at `cap`. */
export function surprise(p: number, cap = 6): number {
  if (!(p > 0)) return cap;
  return Math.min(cap, Math.max(0, -Math.log10(p)));
}

/** Alert levels of the live detectors (D-020). */
export const ALPHA: Record<string, number> = {
  "profile-excess": 1e-4,
  "phenotype-excess": 1e-3,
  "sampling-drop": 1e-4,
  "empty-run": 1e-4,
  "rising-trend": 1e-3,
};

/** p for display: plain below 4 decimals only when ≥ 0.001, else a × 10^n form. */
export function formatP(p: number, locale: string): string {
  if (p >= 0.001) return p.toLocaleString(locale, { maximumSignificantDigits: 2 });
  const [m, e] = p.toExponential(1).split("e");
  const mant = Number(m).toLocaleString(locale, { minimumFractionDigits: 1 });
  const exp = String(Number(e)).replace("-", "−");
  return `${mant} × 10^${exp}`;
}

const SUP: Record<string, string> = {
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
  "−": "⁻",
};
export function formatPSup(p: number, locale: string): string {
  return formatP(p, locale).replace(/\^(.+)$/, (_, e: string) => [...e].map((c) => SUP[c] ?? c).join(""));
}

export function formatNum(n: number, locale: string): string {
  const digits = Math.abs(n) >= 10 ? 1 : 2;
  return n.toLocaleString(locale, { maximumFractionDigits: digits });
}

// ---------- weekly patients ----------

const DAY = 86_400_000;
const toMs = (d: IsoDate) => Date.parse(`${d}T00:00:00Z`);
const toIso = (ms: number): IsoDate => new Date(ms).toISOString().slice(0, 10);
export const addDaysIso = (d: IsoDate, n: number): IsoDate => toIso(toMs(d) + n * DAY);

/**
 * Distinct patients per week with `phenotype` in `ward`, for the weeks that start at `from`, `from + 7`, … and end
 * at or before `to` (a last partial week is dropped). To get weeks that end on the as-of date, pass
 * `from = addDaysIso(asOf, −7·n + 1)` and `to = asOf`. Weeks without a patient are returned with count 0.
 */
export function weeklyPatients(
  records: readonly Pick<IsolateRecord, "patientId" | "sampleDate" | "ward" | "phenotypes">[],
  ward: WardCode,
  phenotype: Phenotype,
  from: IsoDate,
  to: IsoDate,
): { start: IsoDate; count: number }[] {
  const weeks: { start: IsoDate; count: number }[] = [];
  const sets: Set<string>[] = [];
  for (let s = from; addDaysIso(s, 6) <= to; s = addDaysIso(s, 7)) {
    weeks.push({ start: s, count: 0 });
    sets.push(new Set());
  }
  const t0 = toMs(from);
  for (const r of records) {
    if (r.ward !== ward || !r.phenotypes.includes(phenotype)) continue;
    const i = Math.floor((toMs(r.sampleDate) - t0) / (7 * DAY));
    if (i >= 0 && i < weeks.length && toMs(r.sampleDate) <= toMs(to)) sets[i]?.add(r.patientId);
  }
  return weeks.map((w, i) => ({ start: w.start, count: sets[i]?.size ?? 0 }));
}
