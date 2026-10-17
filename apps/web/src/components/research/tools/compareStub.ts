// TODO: swap this file's import for `@aei/compare` when the m1-compare branch merges. Same signatures, minimal
// implementations (Newcombe interval, log-ratio interval, Cochran-Armitage, grid-integrated Beta), so the
// window can be built and tested before the gear lands. Nothing here is a decision; D-069 names the statistics
// the real gear must provide.

import { wilson } from "@aei/coverage";
import { cochranArmitageRising, normalUpper } from "@aei/detect";
import type { IsolateRecord } from "@aei/domain";
import { betaDensity } from "@aei/viz";

export interface Interval {
  lo: number;
  hi: number;
}

export function proportionDifference(k1: number, n1: number, k2: number, n2: number) {
  const p1 = k1 / n1;
  const p2 = k2 / n2;
  const [l1, u1] = wilson(k1, n1);
  const [l2, u2] = wilson(k2, n2);
  const diff = p1 - p2;
  const interval: Interval = {
    lo: diff - Math.sqrt((p1 - l1) ** 2 + (u2 - p2) ** 2),
    hi: diff + Math.sqrt((u1 - p1) ** 2 + (p2 - l2) ** 2),
  };
  const pooled = (k1 + k2) / (n1 + n2);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / n1 + 1 / n2));
  const z = se === 0 ? 0 : diff / se;
  return { p1, p2, diff, interval, z, p: Math.min(1, 2 * normalUpper(Math.abs(z))) };
}

export function rateRatio(k1: number, t1: number, k2: number, t2: number) {
  const a = k1 === 0 || k2 === 0 ? 0.5 : 0; // Haldane correction only when a count is zero
  const ratio = (k1 + a) / t1 / ((k2 + a) / t2);
  const se = Math.sqrt(1 / (k1 + a) + 1 / (k2 + a));
  const log = Math.log(ratio);
  return {
    rate1: k1 / t1,
    rate2: k2 / t2,
    ratio,
    interval: { lo: Math.exp(log - 1.959964 * se), hi: Math.exp(log + 1.959964 * se) } as Interval,
    p: Math.min(1, 2 * normalUpper(Math.abs(log / se))),
  };
}

export function trendAcross(bins: readonly { events: number; n: number }[]) {
  return { p: cochranArmitageRising(bins) };
}

export interface Beta {
  a: number;
  b: number;
  mean: number;
  interval: Interval;
  grid: { x: number; y: number }[];
}

function summarise(a: number, b: number, points: number): Beta {
  const fine = 4000;
  const xs = Array.from({ length: fine + 1 }, (_, i) => Math.min(1 - 1e-9, Math.max(1e-9, i / fine)));
  const ys = xs.map((x) => betaDensity(x, a, b));
  const cdf: number[] = [0];
  for (let i = 1; i <= fine; i++) cdf.push((cdf[i - 1] as number) + ((ys[i] as number) + (ys[i - 1] as number)) / 2 / fine);
  const total = cdf[fine] as number;
  const at = (q: number) => (xs[cdf.findIndex((c) => c / total >= q)] as number) ?? 1;
  return {
    a,
    b,
    mean: a / (a + b),
    interval: { lo: at(0.025), hi: at(0.975) },
    grid: Array.from({ length: points + 1 }, (_, i) => {
      const j = Math.round((i / points) * fine);
      return { x: j / fine, y: ys[j] as number };
    }),
  };
}

export function betaPosterior(k: number, n: number, prior: { a: number; b: number } = { a: 1, b: 1 }, points = 400): Beta {
  return summarise(prior.a + k, prior.b + n - k, points);
}

export function discountedBeta(
  weeks: readonly { k: number; n: number }[],
  o: { delta: number; m: number; parentShare: number; asOfIndex?: number },
  points = 400,
) {
  const upTo = o.asOfIndex === undefined ? weeks.length : o.asOfIndex + 1;
  let a = o.m * o.parentShare;
  let b = o.m * (1 - o.parentShare);
  for (const w of weeks.slice(0, upTo)) {
    a = o.delta * a + (1 - o.delta) * o.m * o.parentShare + w.k;
    b = o.delta * b + (1 - o.delta) * o.m * (1 - o.parentShare) + (w.n - w.k);
  }
  return { ...summarise(a, b, points), effectiveN: a + b - o.m };
}

export interface PeriodShare {
  from: string;
  to: string;
  k: number;
  n: number;
  share: number;
  interval: Interval;
}

const DAY = 86_400_000;
const shift = (iso: string, days: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);

export function sharesByPeriod(
  records: readonly IsolateRecord[],
  o: {
    from: string;
    to: string;
    periodDays: number;
    event: (r: IsolateRecord) => boolean;
    denominator?: (r: IsolateRecord) => boolean;
  },
): PeriodShare[] {
  const out: PeriodShare[] = [];
  for (let from = o.from; from <= o.to; from = shift(from, o.periodDays)) {
    const to = shift(from, o.periodDays - 1) > o.to ? o.to : shift(from, o.periodDays - 1);
    const inPeriod = records.filter((r) => r.sampleDate >= from && r.sampleDate <= to && (o.denominator ? o.denominator(r) : true));
    const k = inPeriod.filter(o.event).length;
    const n = inPeriod.length;
    const [lo, hi] = wilson(k, n);
    out.push({ from, to, k, n, share: n === 0 ? Number.NaN : k / n, interval: { lo, hi } });
  }
  return out;
}
