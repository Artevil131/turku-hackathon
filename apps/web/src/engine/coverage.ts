import type { Antibiotic, IsoDate, Result } from "../feed/types.ts";
import { awareOf } from "./aware.ts";
import { firstPositions, indexResults, type ResultIndex } from "./counting.ts";
import { addDays, addMonths, minDate, monthEnd, monthStart, toDayNumber } from "./dates.ts";
import { isIntrinsicallyResistant } from "./eucast.ts";
import type {
  AgeBand,
  Catalog,
  CoverageOptions,
  CoverageResult,
  DrugFigure,
  LikelyOrganism,
  MonthPoint,
  Onset,
  PatientQuery,
  Share,
  TopReason,
  Widening,
} from "./types.ts";

// Provisional rules (set by the team, not yet in DECISIONS.md; change them here):
// 1. Organism not known, an isolate with no result for an antibiotic counts
//    as "doesn't work" only when EUCAST lists the pair as expected resistant
//    (eucast.ts): labs leave those out. Otherwise the lab simply did not test
//    it, so the isolate is unknown for that antibiotic and leaves its n.
// 2. Organism not known, an antibiotic is shown only when its known part
//    (results + expected resistant) is at least minKnownShare (half) of the
//    first isolates in the main window, after THL Finres, which reports an
//    antibiotic only when more than half of the isolates were tested.
// 3. Organism not known, widening and the four-week window also need every
//    antibiotic shown to rest on minIsolates known answers (not only
//    minIsolates first isolates), so a thinly tested antibiotic is not
//    outranked just for being thin.
// 4. Organism known: n is the isolates of that organism with a result.
//
// "For patients like this one on this unit lately, how often did each
// antibiotic work?" Pure functions over the results released so far.
//
// Counting: first isolate per patient, per organism, per specimen in the
// window, among the isolates that match the query (counting.ts). With the
// organism not known a share reads "of these infections whose answer is
// known, this many would this antibiotic have covered".

/** CoverageOptions plus the rule for antibiotics the lab did not test. */
export interface CoverageTuning extends CoverageOptions {
  /**
   * Organism not known: show an antibiotic only when results plus expected
   * resistance cover at least this share (0-1) of the first isolates in the
   * main window. 0.5 after THL Finres (an antibiotic is reported only when
   * more than half of the isolates were tested).
   */
  minKnownShare: number;
}

export const MIN_KNOWN_SHARE = 0.5;

export const DEFAULT_COVERAGE: CoverageTuning = {
  minIsolates: 30,
  recentDays: 28,
  yearDays: 365,
  rank: "access-first",
  accessMargin: 10,
  minKnownShare: MIN_KNOWN_SHARE,
};

/** PatientQuery.ward for every unit (what widening sets when the unit's own results are too few). */
export const EVERY_UNIT = "";

/** The order filters are dropped in when the year window is not enough (rule 3 above). Organism and specimen are never dropped. */
export const WIDENING_ORDER: readonly Widening[] = ["age", "sex", "onset", "ward"];

export function ageBandOf(age: number): AgeBand {
  return age >= 65 ? "65plus" : "under65";
}

/** hospital = sampled on day 3 of the stay or later (sampleDate >= admissionDate + 2 days); community otherwise. */
export function onsetOf(r: Result): Onset {
  if (!r.admissionDate) return "community";
  return toDayNumber(r.sampleDate) - toDayNumber(r.admissionDate) >= 2 ? "hospital" : "community";
}

/** Screening tests (e.g. a cefoxitin MRSA screen) say something about the organism, not a treatment. */
export function isScreen(antibiotic: Antibiotic): boolean {
  return /screen/i.test(antibiotic.class) || /screen/i.test(antibiotic.en);
}

/** Antibiotics the lab reports for this specimen ("all" or that specimen), screening tests left out, in catalog order. */
export function treatmentsFor(catalog: Catalog, specimen: string): Antibiotic[] {
  return catalog.antibiotics.filter(
    (a) => !isScreen(a) && (a.reportedFor === "all" || specimen === "" || a.reportedFor === specimen),
  );
}

/** Works / n as 0-1, or null when n = 0. */
export function shareValue(share: Share): number | null {
  return share.n > 0 ? share.works / share.n : null;
}

// ---------- Index: onset and age band per result, once per results array ----------

interface Context {
  index: ResultIndex;
  hospital: Uint8Array; // 1 = hospital onset
  senior: Uint8Array; // 1 = 65 or older
}

const contexts = new WeakMap<ResultIndex, Context>();
// The most recent context: when the new index starts with the same results
// (the feed appended a day), only the new results are classified.
let latest: Context | null = null;

function contextOf(results: readonly Result[]): Context {
  const index = indexResults(results);
  let ctx = contexts.get(index);
  if (!ctx) {
    const n = index.sorted.length;
    const hospital = new Uint8Array(n);
    const senior = new Uint8Array(n);
    let start = 0;
    if (latest && isPrefix(latest.index.sorted, index.sorted)) {
      hospital.set(latest.hospital);
      senior.set(latest.senior);
      start = latest.index.sorted.length;
    }
    for (let i = start; i < n; i++) {
      const r = index.sorted[i]!;
      hospital[i] = onsetOf(r) === "hospital" ? 1 : 0;
      senior[i] = ageBandOf(r.ageYears) === "65plus" ? 1 : 0;
    }
    ctx = { index, hospital, senior };
    contexts.set(index, ctx);
  }
  latest = ctx;
  return ctx;
}

function isPrefix(a: readonly Result[], b: readonly Result[]): boolean {
  if (a.length > b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** A position filter for the query. Empty ward or specimen = any. */
function matcher(ctx: Context, q: PatientQuery): (position: number) => boolean {
  const { sorted } = ctx.index;
  const { hospital, senior } = ctx;
  const ward = q.ward;
  const specimen = q.specimen;
  const sex = q.sex;
  const organism = q.organism;
  const age = q.age === undefined ? -1 : q.age === "65plus" ? 1 : 0;
  const onset = q.onset === undefined ? -1 : q.onset === "hospital" ? 1 : 0;
  return (i) => {
    const r = sorted[i]!;
    if (specimen && r.specimen !== specimen) return false;
    if (ward && r.ward !== ward) return false;
    if (organism !== undefined && r.organism !== organism) return false;
    if (sex !== undefined && r.sex !== sex) return false;
    if (age !== -1 && senior[i] !== age) return false;
    if (onset !== -1 && hospital[i] !== onset) return false;
    return true;
  };
}

function select(ctx: Context, from: IsoDate, to: IsoDate, q: PatientQuery): number[] {
  return firstPositions(ctx.index, from, to, matcher(ctx, q));
}

/** A copy holding only the filters that are set. */
function cleanQuery(q: PatientQuery): PatientQuery {
  const out: PatientQuery = { ward: q.ward, specimen: q.specimen };
  if (q.sex !== undefined && q.sex !== "") out.sex = q.sex;
  if (q.age !== undefined) out.age = q.age;
  if (q.onset !== undefined) out.onset = q.onset;
  if (q.organism !== undefined && q.organism !== "") out.organism = q.organism;
  return out;
}

function isSet(q: PatientQuery, f: Widening): boolean {
  return f === "ward" ? q.ward !== EVERY_UNIT : q[f] !== undefined;
}

function without(q: PatientQuery, f: Widening): PatientQuery {
  const out = { ...q };
  if (f === "ward") out.ward = EVERY_UNIT;
  else delete out[f];
  return out;
}

/** Per organism: 1 where EUCAST lists it as expected resistant to the antibiotic at that index. */
type ExpectedResistance = (organism: string) => Uint8Array;

function expectedResistance(antibiotics: readonly (Antibiotic | undefined)[]): ExpectedResistance {
  const rows = new Map<string, Uint8Array>();
  return (organism) => {
    let row = rows.get(organism);
    if (!row) {
      const r = new Uint8Array(antibiotics.length);
      antibiotics.forEach((a, j) => {
        if (a && isIntrinsicallyResistant(organism, a)) r[j] = 1;
      });
      rows.set(organism, r);
      row = r;
    }
    return row;
  };
}

/**
 * Per antibiotic: isolates that were susceptible, isolates with any result,
 * and isolates without a result that are expected resistant (counted only
 * when `expected` is given, i.e. the organism is not known).
 */
function tally(sorted: readonly Result[], positions: readonly number[], codes: readonly string[], expected?: ExpectedResistance) {
  const works = new Int32Array(codes.length);
  const tested = new Int32Array(codes.length);
  const resistant = new Int32Array(codes.length);
  for (const p of positions) {
    const r = sorted[p]!;
    const res = r.results;
    let row: Uint8Array | undefined;
    for (let j = 0; j < codes.length; j++) {
      const v = res[codes[j]!];
      if (v === undefined) {
        if (expected && (row ??= expected(r.organism))[j]) resistant[j]!++;
        continue;
      }
      tested[j]!++;
      if (v === "S") works[j]!++;
    }
  }
  return { works, tested, resistant, isolates: positions.length };
}

type Tally = ReturnType<typeof tally>;

/** n = isolates with a result, plus (organism not known) isolates without one that are expected resistant. */
function shareOf(t: Tally, j: number, organismKnown: boolean): Share {
  return { works: t.works[j]!, n: organismKnown ? t.tested[j]! : t.tested[j]! + t.resistant[j]! };
}

/** Organism not known: results plus expected resistance cover at least minKnownShare of the window's first isolates. */
function knownEnough(t: Tally, j: number, minKnownShare: number): boolean {
  return t.isolates > 0 && t.tested[j]! + t.resistant[j]! >= minKnownShare * t.isolates - 1e-9;
}

// ---------- coverage ----------

export function coverage(
  results: readonly Result[],
  asOf: IsoDate,
  query: PatientQuery,
  catalog: Catalog,
  options: Partial<CoverageTuning> = {},
): CoverageResult {
  const o: CoverageTuning = { ...DEFAULT_COVERAGE, ...options };
  const min = o.minIsolates;
  const ctx = contextOf(results);
  const { sorted } = ctx.index;
  const recentFrom = addDays(asOf, -o.recentDays);
  const yearFrom = addDays(asOf, -o.yearDays);

  // Organism and specimen are never widened, so these hold for every step.
  let q = cleanQuery(query);
  const organismKnown = q.organism !== undefined;
  const treatments = treatmentsFor(catalog, q.specimen);
  const codes = treatments.map((a) => a.code);
  const expected = organismKnown ? undefined : expectedResistance(treatments);
  const tallyOf = (positions: readonly number[]) => tally(sorted, positions, codes, expected);

  // Enough = minIsolates first isolates; with the organism not known, also
  // every antibiotic that would be shown (tested in the year, known part at
  // least minKnownShare) rests on minIsolates known answers. Otherwise an
  // antibiotic the lab tests for only some organisms is left too thin to rank.
  const enough = (t: Tally, year: Tally): boolean => {
    if (t.isolates < min) return false;
    if (organismKnown) return true;
    for (let j = 0; j < codes.length; j++) {
      if (year.tested[j]! > 0 && knownEnough(t, j, o.minKnownShare) && t.tested[j]! + t.resistant[j]! < min) return false;
    }
    return true;
  };

  // Widen until the year window is enough.
  const widened: Widening[] = [];
  let year = select(ctx, yearFrom, asOf, q);
  let tYear = tallyOf(year);
  for (const f of WIDENING_ORDER) {
    if (enough(tYear, tYear)) break;
    if (!isSet(q, f)) continue;
    q = without(q, f);
    widened.push(f);
    year = select(ctx, yearFrom, asOf, q);
    tYear = tallyOf(year);
  }
  const recent = select(ctx, recentFrom, asOf, q);
  const tRecent = tallyOf(recent);
  const window = enough(tRecent, tYear) ? "recent" : "year";
  const hospitalQuery = isSet(q, "ward") ? without(q, "ward") : q;
  const hospital = hospitalQuery === q ? year : select(ctx, yearFrom, asOf, hospitalQuery);
  const tHospital = hospital === year ? tYear : tallyOf(hospital);
  const tMain = window === "recent" ? tRecent : tYear;

  const figures: DrugFigure[] = [];
  const catalogOrder = new Map<string, number>();
  treatments.forEach((a, j) => {
    // No result at all in the year window: no evidence either way, so it is left out.
    if (tYear.tested[j] === 0) return;
    // Organism not known: too few of these infections have a known answer for this antibiotic.
    if (!organismKnown && !knownEnough(tMain, j, o.minKnownShare)) return;
    const y = shareOf(tYear, j, organismKnown);
    const r = shareOf(tRecent, j, organismKnown);
    const ry = shareValue(r);
    const yy = shareValue(y);
    catalogOrder.set(a.code, j);
    figures.push({
      antibiotic: a.code,
      aware: awareOf(a),
      main: window === "recent" ? r : y,
      recent: r,
      year: y,
      hospitalYear: shareOf(tHospital, j, organismKnown),
      change: r.n >= min && y.n >= min && ry !== null && yy !== null ? Math.round(100 * (ry - yy)) : null,
    });
  });

  const { drugs, topReason } = rank(figures, o, catalogOrder);
  const n = window === "recent" ? recent.length : year.length;

  return {
    asOf,
    basis: { query: q, widened, window, n, recentN: recent.length, yearN: year.length, enough: n >= min },
    drugs,
    topReason,
    organisms: organismsOf(ctx, yearFrom, asOf, q, year),
  };
}

/**
 * Coverage order: figures resting on minIsolates or more first, then thinner
 * ones, then none (so a share from a handful of isolates never leads); within
 * each, the higher share first, ties Access first, then catalog order.
 * access-first then moves the best Access antibiotic within accessMargin
 * points of the best figure to the front.
 */
function rank(
  figures: DrugFigure[],
  o: CoverageOptions,
  catalogOrder: Map<string, number>,
): { drugs: DrugFigure[]; topReason: TopReason | null } {
  const min = o.minIsolates;
  const tier = (d: DrugFigure) => (d.main.n === 0 ? 2 : d.main.n >= min ? 0 : 1);
  const value = (d: DrugFigure) => shareValue(d.main) ?? -1;
  const ordered = figures.slice().sort(
    (a, b) =>
      tier(a) - tier(b) ||
      value(b) - value(a) ||
      Number(b.aware === "access") - Number(a.aware === "access") ||
      (catalogOrder.get(a.antibiotic) ?? 0) - (catalogOrder.get(b.antibiotic) ?? 0),
  );
  const top = ordered[0];
  if (!top || top.main.n === 0) return { drugs: ordered, topReason: null };
  if (o.rank === "coverage") return { drugs: ordered, topReason: { kind: "highest" } };

  const reliable = ordered.filter((d) => d.main.n >= min);
  const pool = reliable.length > 0 ? reliable : ordered.filter((d) => d.main.n > 0);
  const best = pool[0]!;
  const floor = value(best) - o.accessMargin / 100 - 1e-9;
  const access = pool.find((d) => d.aware === "access" && value(d) >= floor);
  if (!access || access === top) return { drugs: ordered, topReason: { kind: "highest" } };
  return {
    drugs: [access, ...ordered.filter((d) => d !== access)],
    topReason: { kind: "access-preferred", strongest: best.antibiotic, strongestShare: best.main },
  };
}

/** Organisms behind this infection: year window, the final query without organism, most common first. */
function organismsOf(ctx: Context, from: IsoDate, to: IsoDate, q: PatientQuery, year: number[]): LikelyOrganism[] {
  let positions = year;
  if (q.organism !== undefined) {
    const anyOrganism = { ...q };
    delete anyOrganism.organism;
    positions = select(ctx, from, to, anyOrganism);
  }
  const counts = new Map<string, number>();
  for (const p of positions) {
    const organism = ctx.index.sorted[p]!.organism;
    counts.set(organism, (counts.get(organism) ?? 0) + 1);
  }
  const total = positions.length;
  return [...counts]
    .map(([organism, n]) => ({ organism, n, share: n / total }))
    .sort((a, b) => b.n - a.n || (a.organism < b.organism ? -1 : a.organism > b.organism ? 1 : 0));
}

// ---------- monthly ----------

/**
 * The share for one antibiotic in each of the last `months` calendar months up
 * to asOf's month (that month only up to asOf), oldest first. First isolates
 * per month matching the query as given (no widening); same missing-result
 * rules as coverage(). Organism not known: pass the catalog so a missing
 * result can count as expected resistant (without it every missing result is
 * unknown), and a month whose known part is under minKnownShare of its first
 * isolates gets no figure (n = 0).
 */
export function monthly(
  results: readonly Result[],
  asOf: IsoDate,
  query: PatientQuery,
  antibiotic: string,
  months: number,
  catalog?: Catalog,
  minKnownShare: number = MIN_KNOWN_SHARE,
): MonthPoint[] {
  const ctx = contextOf(results);
  const q = cleanQuery(query);
  const keep = matcher(ctx, q);
  const organismKnown = q.organism !== undefined;
  const expected = organismKnown ? undefined : expectedResistance([catalog?.antibiotics.find((a) => a.code === antibiotic)]);
  const last = monthStart(asOf);
  const points: MonthPoint[] = [];
  for (let i = Math.max(0, Math.floor(months)) - 1; i >= 0; i--) {
    const month = addMonths(last, -i);
    const positions = firstPositions(ctx.index, addDays(month, -1), minDate(monthEnd(month), asOf), keep);
    const t = tally(ctx.index.sorted, positions, [antibiotic], expected);
    const known = organismKnown || knownEnough(t, 0, minKnownShare);
    points.push({ month, share: known ? shareOf(t, 0, organismKnown) : { works: 0, n: 0 } });
  }
  return points;
}
