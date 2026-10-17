import { betaPosterior, discountedBeta, type Interval, proportionDifference, rateRatio, sharesByPeriod, trendAcross } from "@aei/compare";

type Beta = ReturnType<typeof betaPosterior>;
type PeriodShare = ReturnType<typeof sharesByPeriod>[number];

import { firstIsolates } from "@aei/counting";
import { wilson } from "@aei/coverage";
import { episodes, LIVE_SETTINGS, phenotypeExcess, poissonLower, poissonUpper, profileExcess, type Signal } from "@aei/detect";
import type { AntibioticCode, IsolateRecord, Phenotype } from "@aei/domain";
import type { ExportTable } from "@aei/export";
import { daysBetween, shift } from "../feed/model.ts";

// The pure side of the Tools window (D-065 engine A, D-076): a slice, five analyses over records already
// fetched, each returning numbers only from gear calls, plus the table and the Python call of the result.

export interface Frame {
  from: string;
  to: string;
  /** "" is every unit. */
  unit: string;
}
export interface Slice extends Frame {
  organism: string;
  specimen: string;
  /** "" is no phenotype. */
  phenotype: Phenotype | "";
  firstOnly: boolean;
}
/** What is counted as an event: carrying a phenotype, or being resistant (R) to an antibiotic. */
export type EventSpec = { type: "phenotype"; code: Phenotype } | { type: "antibiotic"; code: AntibioticCode };

export const eventKey = (e: EventSpec) => `${e.type}:${e.code}`;
export const eventLabelCode = (e: EventSpec) => e.code;
export function parseEvent(v: string): EventSpec {
  const [type, code] = v.split(":");
  return type === "antibiotic" ? { type, code: code as AntibioticCode } : { type: "phenotype", code: code as Phenotype };
}
export const isEvent = (e: EventSpec) => (r: IsolateRecord) =>
  e.type === "phenotype" ? r.phenotypes.includes(e.code) : r.results[e.code] === "R";
/** Phenotypes count over every isolate; an antibiotic only over the isolates tested for it. */
export const isTested = (e: EventSpec) => (r: IsolateRecord) => e.type === "phenotype" || r.results[e.code] !== undefined;

export const frameDays = (f: Pick<Frame, "from" | "to">) => daysBetween(f.from, f.to) + 1;

/** The slice's rows: the first-isolate rule (@aei/counting) within the frame when asked. */
export function prepare(records: readonly IsolateRecord[], frame: Frame, firstOnly: boolean): IsolateRecord[] {
  const inFrame = records.filter((r) => r.sampleDate >= frame.from && r.sampleDate <= frame.to);
  return firstOnly ? firstIsolates(inFrame, { from: frame.from, to: frame.to }) : inFrame;
}

export const Z_TAIL = 0.025;

/** Exact (Garwood) 95 % interval of a Poisson mean given k, by bisection on the detector gear's tails. */
export function poissonInterval(k: number): Interval {
  const bisect = (f: (m: number) => number, target: number, lo: number, hi: number, increasing: boolean) => {
    for (let i = 0; i < 80; i++) {
      const mid = (lo + hi) / 2;
      if (f(mid) < target === increasing) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  };
  const top = k + 10 * Math.sqrt(k + 1) + 20;
  return {
    lo: k === 0 ? 0 : bisect((m) => poissonUpper(k, m), Z_TAIL, 0, k, true),
    hi: bisect((m) => poissonLower(k, m), Z_TAIL, k, top, false),
  };
}

// ---------- 1. rate in a frame ----------

export interface RateResult {
  kind: "rate";
  slice: Slice;
  days: number;
  weeks: number;
  /** Isolates counted: those carrying the phenotype when one is set, else all in the slice. */
  count: number;
  cultures: number;
  perWeek: number;
  perWeekInterval: Interval;
  per100Cultures: number;
  share: { k: number; n: number; share: number; interval: Interval } | null;
}

export function computeRate(rows: readonly IsolateRecord[], slice: Slice): RateResult {
  const ph = slice.phenotype;
  const counted = ph ? rows.filter((r) => r.phenotypes.includes(ph)) : [...rows];
  const cultures = new Set(rows.map((r) => r.cultureId)).size;
  const days = frameDays(slice);
  const weeks = days / 7;
  const ci = poissonInterval(counted.length);
  const [lo, hi] = wilson(counted.length, rows.length);
  return {
    kind: "rate",
    slice,
    days,
    weeks,
    count: counted.length,
    cultures,
    perWeek: counted.length / weeks,
    perWeekInterval: { lo: ci.lo / weeks, hi: ci.hi / weeks },
    per100Cultures: cultures === 0 ? Number.NaN : (100 * counted.length) / cultures,
    share: ph && rows.length > 0 ? { k: counted.length, n: rows.length, share: counted.length / rows.length, interval: { lo, hi } } : null,
  };
}

// ---------- 2. compare two frames ----------

export interface FrameCounts {
  frame: Frame;
  k: number;
  n: number;
  weeks: number;
}
export interface CompareResult {
  kind: "compare";
  slice: Slice;
  event: EventSpec;
  a: FrameCounts;
  b: FrameCounts;
  difference: ReturnType<typeof proportionDifference> | null;
  ratio: ReturnType<typeof rateRatio> | null;
  trend: { p: number; periods: number } | null;
  higher: "a" | "b" | "same";
  excludesZero: boolean;
}

export const TREND_PERIOD_DAYS = 7;
export const MIN_TREND_PERIODS = 3;

function countsOf(rows: readonly IsolateRecord[], frame: Frame, event: EventSpec): FrameCounts {
  const tested = rows.filter(isTested(event));
  return { frame, k: tested.filter(isEvent(event)).length, n: tested.length, weeks: frameDays(frame) / 7 };
}

export function computeCompare(
  rowsA: readonly IsolateRecord[],
  rowsB: readonly IsolateRecord[],
  slice: Slice,
  frameB: Frame,
  event: EventSpec,
): CompareResult {
  const a = countsOf(rowsA, slice, event);
  const b = countsOf(rowsB, frameB, event);
  const both = a.n > 0 && b.n > 0;
  // The gear reports the second frame against the first (diff = p2 − p1, ratio = rate2 / rate1); the
  // cell reads A − B and A ÷ B, so the sign and the ratio are turned around for display (p1, p2, p unchanged).
  const rawDiff = both ? proportionDifference(a.k, a.n, b.k, b.n) : null;
  const difference = rawDiff ? { ...rawDiff, diff: -rawDiff.diff, interval: { lo: -rawDiff.interval.hi, hi: -rawDiff.interval.lo } } : null;
  const rawRatio = a.weeks > 0 && b.weeks > 0 ? rateRatio(a.k, a.weeks, b.k, b.weeks) : null;
  const ratio = rawRatio
    ? { ...rawRatio, ratio: 1 / rawRatio.ratio, interval: { lo: 1 / rawRatio.interval.hi, hi: 1 / rawRatio.interval.lo } }
    : null;
  const binsOf = (rows: readonly IsolateRecord[], f: Frame) =>
    sharesByPeriod(rows, { from: f.from, to: f.to, periodDays: TREND_PERIOD_DAYS, event: isEvent(event), denominator: isTested(event) });
  const binsA = binsOf(rowsA, slice);
  const binsB = binsOf(rowsB, frameB);
  const ordered = [...binsA, ...binsB].sort((x, y) => (x.from < y.from ? -1 : 1));
  const trend =
    binsA.length >= MIN_TREND_PERIODS && binsB.length >= MIN_TREND_PERIODS
      ? { p: trendAcross(ordered.map((s) => ({ events: s.k, n: s.n }))).p, periods: ordered.length }
      : null;
  const diff = difference?.diff ?? 0;
  return {
    kind: "compare",
    slice,
    event,
    a,
    b,
    difference,
    ratio,
    trend,
    higher: diff > 0 ? "a" : diff < 0 ? "b" : "same",
    excludesZero: difference ? difference.interval.lo > 0 || difference.interval.hi < 0 : false,
  };
}

// ---------- 3. share over time ----------

export interface SharesResult {
  kind: "shares";
  slice: Slice;
  event: EventSpec;
  periodDays: number;
  points: PeriodShare[];
}

export function computeShares(rows: readonly IsolateRecord[], slice: Slice, event: EventSpec, periodDays: number): SharesResult {
  return {
    kind: "shares",
    slice,
    event,
    periodDays,
    points: sharesByPeriod(rows, { from: slice.from, to: slice.to, periodDays, event: isEvent(event), denominator: isTested(event) }),
  };
}

// ---------- 4. Beta posterior ----------

export interface BetaResult {
  kind: "beta";
  slice: Slice;
  event: EventSpec;
  k: number;
  n: number;
  posterior: Beta;
  discounted: { delta: number; m: number; parentShare: number; weeks: number; posterior: Beta & { effectiveN: number } } | null;
}

export interface Discount {
  delta: number;
  m: number;
}

/** `parentRows` are the hospital-wide rows of the same frame, for the D-041 prior; null when not discounted. */
export function computeBeta(
  rows: readonly IsolateRecord[],
  parentRows: readonly IsolateRecord[] | null,
  slice: Slice,
  event: EventSpec,
  discount: Discount | null,
): BetaResult {
  const tested = rows.filter(isTested(event));
  const k = tested.filter(isEvent(event)).length;
  const base = { kind: "beta" as const, slice, event, k, n: tested.length, posterior: betaPosterior(k, tested.length) };
  if (!discount || !parentRows) return { ...base, discounted: null };
  const parentTested = parentRows.filter(isTested(event));
  const parentShare = parentTested.length === 0 ? 0.5 : parentTested.filter(isEvent(event)).length / parentTested.length;
  const weekly = sharesByPeriod(rows, {
    from: slice.from,
    to: slice.to,
    periodDays: 7,
    event: isEvent(event),
    denominator: isTested(event),
  }).map((w) => ({ k: w.k, n: w.n }));
  return {
    ...base,
    discounted: { ...discount, parentShare, weeks: weekly.length, posterior: discountedBeta(weekly, { ...discount, parentShare }) },
  };
}

// ---------- 5. a detector here ----------

export type DetectorChoice = "phenotype" | "profile";
export interface DetectorRow {
  key: string;
  unit: string | null;
  organism: string | null;
  label: string;
  first: string;
  last: string;
  signals: number;
  observed: number;
  expected: number | null;
  p: number | null;
}
export interface DetectorResult {
  kind: "detector";
  slice: Slice;
  detector: DetectorChoice;
  phenotypes: Phenotype[];
  rows: DetectorRow[];
  fetched: number;
}

export const BASELINE_DAYS = 365;
export const baselineStart = (from: string) => shift(from, -BASELINE_DAYS);

/** `all` is every unit and organism from 365 days before the frame, so the baseline is the live detector's. */
export function computeDetector(
  all: readonly IsolateRecord[],
  slice: Slice,
  detector: DetectorChoice,
  phenotypes: readonly Phenotype[],
): DetectorResult {
  const signals: Signal[] =
    detector === "profile"
      ? profileExcess(all, LIVE_SETTINGS.profileExcess)
      : phenotypeExcess(all, phenotypes, LIVE_SETTINGS.phenotypeExcess);
  const inSlice = signals.filter(
    (s) =>
      s.date >= slice.from &&
      s.date <= slice.to &&
      (!slice.unit || s.ward === slice.unit) &&
      (!slice.organism || !s.organism || s.organism === slice.organism),
  );
  const rows = episodes(inSlice).map((e): DetectorRow => {
    const same = inSlice.filter((s) => s.detector === e.detector && s.key === e.key && s.date >= e.first.date && s.date <= e.last.date);
    const best = same.reduce((x, y) => ((y.p ?? 1) < (x.p ?? 1) ? y : x), e.first);
    return {
      key: e.key,
      unit: best.ward,
      organism: best.organism ?? null,
      label: best.phenotype ?? best.profile ?? "",
      first: e.first.date,
      last: e.last.date,
      signals: e.signals,
      observed: best.observed,
      expected: best.expected ?? null,
      p: best.p ?? null,
    };
  });
  return { kind: "detector", slice, detector, phenotypes: [...phenotypes], rows, fetched: all.length };
}

export type CellResult = RateResult | CompareResult | SharesResult | BetaResult | DetectorResult;
export interface Cell {
  id: number;
  result: CellResult;
}
export type ToolId = CellResult["kind"];
export const TOOL_IDS: readonly ToolId[] = ["rate", "compare", "shares", "beta", "detector"];

// ---------- Python and CSV ----------

const q = (v: string) => JSON.stringify(v);
const num = (v: number) => (Number.isInteger(v) ? String(v) : String(Number(v.toPrecision(10))));

/** The call a researcher pastes into a notebook (aei, D-061): same arguments as the gear call. */
export function pythonCall(r: CellResult): string {
  switch (r.kind) {
    case "rate":
      return `aei.coverage.wilson(k=${r.share?.k ?? r.count}, n=${r.share?.n ?? r.count})  # share; the count's Poisson interval: k=${r.count}`;
    case "compare": {
      const lines = [
        `aei.compare.proportion_difference(k1=${r.a.k}, n1=${r.a.n}, k2=${r.b.k}, n2=${r.b.n})  # diff = B - A; the cell shows A - B`,
      ];
      lines.push(`aei.compare.rate_ratio(k1=${r.a.k}, t1=${num(r.a.weeks)}, k2=${r.b.k}, t2=${num(r.b.weeks)})`);
      if (r.trend) lines.push(`aei.compare.trend_across(bins=[...])  # ${r.trend.periods} weekly {events, n} bins, A then B`);
      return lines.join("\n");
    }
    case "shares":
      return `aei.compare.shares_by_period(records, from_=${q(r.slice.from)}, to=${q(r.slice.to)}, period_days=${r.periodDays}, event=${q(eventKey(r.event))})`;
    case "beta": {
      const plain = `aei.compare.beta_posterior(k=${r.k}, n=${r.n})`;
      if (!r.discounted) return plain;
      const d = r.discounted;
      return `${plain}\naei.compare.discounted_beta(weeks, delta=${num(d.delta)}, m=${num(d.m)}, parent_share=${num(d.parentShare)})  # weeks: ${d.weeks} weekly {k, n}`;
    }
    case "detector": {
      const live = r.detector === "profile" ? LIVE_SETTINGS.profileExcess : LIVE_SETTINGS.phenotypeExcess;
      const opts = `window_days=${live.windowDays}, baseline_days=${live.baselineDays}, alpha=${live.alpha}, min_observed=${live.minObserved}`;
      return r.detector === "profile"
        ? `aei.detect.profile_excess(records, ${opts}, same_specimen=True)`
        : `aei.detect.phenotype_excess(records, phenotypes=[${r.phenotypes.map(q).join(", ")}], ${opts})`;
    }
  }
}

type Row = ExportTable["rows"][number];
const table = (name: string, title: string, keys: string[], rows: Row[]): ExportTable => ({
  name,
  title,
  columns: keys.map((key) => ({ key, label: key })),
  rows,
});
const finite = (v: number | undefined) => (v === undefined || !Number.isFinite(v) ? null : v);

/** The cell's numbers as one table, for the friend's CSV exporter (`toCsv`). */
export function cellTable(r: CellResult): ExportTable {
  switch (r.kind) {
    case "rate":
      return table(
        "tools-rate",
        "Rate in a frame",
        ["measure", "value", "lo", "hi"],
        [
          { measure: "count", value: r.count, lo: finite(poissonInterval(r.count).lo), hi: finite(poissonInterval(r.count).hi) },
          { measure: "per_week", value: finite(r.perWeek), lo: finite(r.perWeekInterval.lo), hi: finite(r.perWeekInterval.hi) },
          { measure: "cultures", value: r.cultures, lo: null, hi: null },
          { measure: "per_100_cultures", value: finite(r.per100Cultures), lo: null, hi: null },
          ...(r.share ? [{ measure: "share", value: r.share.share, lo: r.share.interval.lo, hi: r.share.interval.hi }] : []),
        ],
      );
    case "compare":
      return table(
        "tools-compare",
        "Compare two frames",
        ["measure", "frame_a", "frame_b", "estimate", "lo", "hi", "p"],
        [
          {
            measure: "share",
            frame_a: finite(r.difference?.p1),
            frame_b: finite(r.difference?.p2),
            estimate: finite(r.difference?.diff),
            lo: finite(r.difference?.interval.lo),
            hi: finite(r.difference?.interval.hi),
            p: finite(r.difference?.p),
          },
          {
            measure: "events_per_week",
            frame_a: finite(r.ratio?.rate1),
            frame_b: finite(r.ratio?.rate2),
            estimate: finite(r.ratio?.ratio),
            lo: finite(r.ratio?.interval.lo),
            hi: finite(r.ratio?.interval.hi),
            p: finite(r.ratio?.p),
          },
          ...(r.trend ? [{ measure: "trend_across", frame_a: null, frame_b: null, estimate: null, lo: null, hi: null, p: r.trend.p }] : []),
        ],
      );
    case "shares":
      return table(
        "tools-shares",
        "Share over time",
        ["from", "to", "k", "n", "share", "lo", "hi"],
        r.points.map((s) => ({
          from: s.from,
          to: s.to,
          k: s.k,
          n: s.n,
          share: s.share === null ? "" : finite(s.share),
          lo: s.interval === null ? "" : finite(s.interval.lo),
          hi: s.interval === null ? "" : finite(s.interval.hi),
        })),
      );
    case "beta": {
      const row = (name: string, b: Beta, effectiveN: number | null): Row => ({
        posterior: name,
        a: b.a,
        b: b.b,
        mean: b.mean,
        lo: b.interval.lo,
        hi: b.interval.hi,
        effective_n: effectiveN,
      });
      return table(
        "tools-beta",
        "Beta posterior",
        ["posterior", "a", "b", "mean", "lo", "hi", "effective_n"],
        [
          row("flat prior", r.posterior, null),
          ...(r.discounted ? [row("D-041 discounted", r.discounted.posterior, r.discounted.posterior.effectiveN)] : []),
        ],
      );
    }
    case "detector":
      return table(
        "tools-detector",
        "Detector here",
        ["unit", "organism", "what", "first", "last", "signals", "observed", "expected", "p"],
        r.rows.map((e) => ({
          unit: e.unit,
          organism: e.organism,
          what: e.label,
          first: e.first,
          last: e.last,
          signals: e.signals,
          observed: e.observed,
          expected: e.expected,
          p: e.p,
        })),
      );
  }
}
