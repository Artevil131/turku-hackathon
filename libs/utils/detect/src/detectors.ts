import type { AntibioticCode, Culture, IsoDate, IsolateRecord, Organism, Phenotype, SiteId, WardCode } from "@aei/domain";
import { isIntrinsic } from "@aei/eucast";
import { addDays, daysBetween } from "@aei/replay";
import { binomialUpper, cochranArmitageRising, poissonLower, poissonUpper } from "./stats.ts";

// Candidate deviation detectors (D-016). Each scans a whole history and
// returns the days it would have signalled; the signal on day t uses only
// samples dated on or before t, and baselines leave out the tested window.
// Thresholds are parameters; which detectors and thresholds the tool uses
// is decided from experiments/0002.

export type DetectorName =
  | "profile-excess"
  | "phenotype-excess"
  | "sampling-drop"
  | "volume-jump"
  | "empty-run"
  | "rising-trend"
  | "resistance-shift";

export interface Signal {
  detector: DetectorName;
  /** What the signal is about; signals with the same key form episodes. */
  key: string;
  date: IsoDate;
  ward: WardCode | null;
  /** The site of a hospital-wide signal (no unit) of a site other than the home site (D-051). */
  site?: SiteId;
  organism?: Organism;
  antibiotic?: AntibioticCode;
  phenotype?: Phenotype;
  profile?: string;
  observed: number;
  expected?: number;
  p?: number;
}

export const MIN_BASELINE_ISOLATES = 50;
export const PROFILE_SMOOTHING = 0.5;

export const PROFILE_ANTIBIOTICS: readonly AntibioticCode[] = [
  "AMP",
  "MEC",
  "TZP",
  "FOX",
  "CXM",
  "CRO",
  "CAZ",
  "MEM",
  "CIP",
  "TMP",
  "NIT",
  "VAN",
  "CLI",
];

/** The isolate's S/R results over the 13 antibiotics, "." where not tested. */
export function profileOf(r: Pick<IsolateRecord, "results">): string {
  return PROFILE_ANTIBIOTICS.map((a) => r.results[a] ?? ".").join("");
}

/** At least one R the organism does not have by nature. */
export function hasAcquiredResistance(r: Pick<IsolateRecord, "organism" | "results">): boolean {
  return PROFILE_ANTIBIOTICS.some((a) => r.results[a] === "R" && !isIntrinsic(r.organism, a));
}

/** Sampled on day 3 or later of the stay (CONTEXT.md); defined in @aei/domain, which the coverage list shares. */
export { isHospitalOnset } from "@aei/domain";

// ---------- helpers ----------

const byDate = <T extends { sampleDate: IsoDate }>(a: T, b: T) => (a.sampleDate < b.sampleDate ? -1 : a.sampleDate > b.sampleDate ? 1 : 0);

function groupBy<T>(items: readonly T[], key: (t: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const it of items) {
    const k = key(it);
    const list = out.get(k);
    if (list) list.push(it);
    else out.set(k, [it]);
  }
  return out;
}

/** First index whose date is ≥ `date` in a list sorted by date. */
function lowerBound(dates: readonly IsoDate[], date: IsoDate): number {
  let lo = 0;
  let hi = dates.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if ((dates[mid] as string) < date) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Items dated within [from, to] in a list sorted by date. */
function slice<T extends { sampleDate: IsoDate }>(
  sorted: readonly T[],
  dates: readonly IsoDate[],
  from: IsoDate,
  to: IsoDate,
): readonly T[] {
  return sorted.slice(lowerBound(dates, from), lowerBound(dates, addDays(to, 1)));
}

const distinctPatients = (items: readonly { patientId: string }[]) => new Set(items.map((i) => i.patientId)).size;

// ---------- 2. profile excess ----------

export interface ExcessOptions {
  windowDays: number;
  baselineDays: number;
  alpha: number;
  minObserved: number;
  /** Profile excess only: take the profile's share among isolates of the same specimen type. */
  sameSpecimen?: boolean;
}

/**
 * Patients in one unit with the same organism and profile within the
 * window, against the unit's patients with that organism in the window
 * times the profile's share hospital-wide over the baseline before the
 * window (share smoothed by adding one half).
 */
export function profileExcess(records: readonly IsolateRecord[], o: ExcessOptions): Signal[] {
  const sorted = [...records].sort(byDate);
  const stratum = (r: IsolateRecord) => (o.sameSpecimen ? `${r.organism}|${r.specimen}` : r.organism);
  const byOrganism = groupBy(sorted, stratum);
  const orgDates = new Map([...byOrganism].map(([k, v]) => [k, v.map((r) => r.sampleDate)]));
  const byProfile = groupBy(sorted, (r) => `${stratum(r)}|${profileOf(r)}`);
  const profileDates = new Map([...byProfile].map(([k, v]) => [k, v.map((r) => r.sampleDate)]));
  // The window is counted in the same stratum as the share (organism, or organism and specimen).
  const byUnitOrg = groupBy(sorted, (r) => `${r.ward}|${stratum(r)}`);
  const unitOrgDates = new Map([...byUnitOrg].map(([k, v]) => [k, v.map((r) => r.sampleDate)]));

  const signals: Signal[] = [];
  for (const r of sorted) {
    if (!hasAcquiredResistance(r)) continue;
    const profile = profileOf(r);
    const from = addDays(r.sampleDate, 1 - o.windowDays);
    const baseTo = addDays(from, -1);
    const baseFrom = addDays(from, -o.baselineDays);
    const unitList = byUnitOrg.get(`${r.ward}|${stratum(r)}`) ?? [];
    const inWindow = slice(unitList, unitOrgDates.get(`${r.ward}|${stratum(r)}`) ?? [], from, r.sampleDate);
    const observed = distinctPatients(inWindow.filter((x) => profileOf(x) === profile));
    if (observed < o.minObserved) continue;
    const baseAll = slice(byOrganism.get(stratum(r)) ?? [], orgDates.get(stratum(r)) ?? [], baseFrom, baseTo).length;
    if (baseAll < MIN_BASELINE_ISOLATES) continue;
    const pk = `${stratum(r)}|${profile}`;
    const baseProfile = slice(byProfile.get(pk) ?? [], profileDates.get(pk) ?? [], baseFrom, baseTo).length;
    const expected = distinctPatients(inWindow) * ((baseProfile + PROFILE_SMOOTHING) / (baseAll + 1));
    const p = poissonUpper(observed, expected);
    if (p < o.alpha) {
      signals.push({
        detector: "profile-excess",
        key: `${r.ward}|${r.organism}|${profile}`,
        date: r.sampleDate,
        ward: r.ward,
        organism: r.organism,
        profile,
        observed,
        expected,
        p,
      });
    }
  }
  return signals;
}

// ---------- 3. phenotype excess ----------

/** Patients with a phenotype in one unit within the window, against the unit's share of that phenotype over the baseline. */
export function phenotypeExcess(records: readonly IsolateRecord[], phenotypes: readonly Phenotype[], o: ExcessOptions): Signal[] {
  const sorted = [...records].sort(byDate);
  const byUnit = groupBy(sorted, (r) => r.ward);
  const unitDates = new Map([...byUnit].map(([k, v]) => [k, v.map((r) => r.sampleDate)]));
  const signals: Signal[] = [];
  for (const r of sorted) {
    for (const ph of r.phenotypes) {
      if (!phenotypes.includes(ph)) continue;
      const list = byUnit.get(r.ward) ?? [];
      const dates = unitDates.get(r.ward) ?? [];
      const from = addDays(r.sampleDate, 1 - o.windowDays);
      const inWindow = slice(list, dates, from, r.sampleDate);
      const observed = distinctPatients(inWindow.filter((x) => x.phenotypes.includes(ph)));
      if (observed < o.minObserved) continue;
      const base = slice(list, dates, addDays(from, -o.baselineDays), addDays(from, -1));
      if (base.length < MIN_BASELINE_ISOLATES) continue;
      const share = (base.filter((x) => x.phenotypes.includes(ph)).length + PROFILE_SMOOTHING) / (base.length + 1);
      const expected = distinctPatients(inWindow) * share;
      const p = poissonUpper(observed, expected);
      if (p < o.alpha) {
        signals.push({
          detector: "phenotype-excess",
          key: `${r.ward}|${ph}`,
          date: r.sampleDate,
          ward: r.ward,
          phenotype: ph,
          observed,
          expected,
          p,
        });
      }
    }
  }
  return signals;
}

// ---------- 4. sampling drop ----------

export interface DropOptions {
  windowDays: number;
  baselineDays: number;
  alpha: number;
}

/** Per unit and day: cultures over the window against the window's share of the unit's baseline mean; `tail` gives the p-value. */
function cultureCountSignals(
  cultures: readonly Culture[],
  o: DropOptions,
  detector: DetectorName,
  tail: (observed: number, expected: number) => number,
): Signal[] {
  if (cultures.length === 0) return [];
  const dates = cultures.map((c) => c.sampleDate).sort();
  const start = dates[0] as IsoDate;
  const end = dates.at(-1) as IsoDate;
  const nDays = daysBetween(start, end) + 1;
  const counts = new Map<WardCode, number[]>();
  for (const c of cultures) {
    const arr = counts.get(c.ward) ?? new Array<number>(nDays).fill(0);
    arr[daysBetween(start, c.sampleDate)] = (arr[daysBetween(start, c.sampleDate)] ?? 0) + 1;
    counts.set(c.ward, arr);
  }
  const signals: Signal[] = [];
  for (const [ward, arr] of counts) {
    const prefix = [0];
    for (const n of arr) prefix.push((prefix.at(-1) as number) + n);
    const sum = (i: number, j: number) => (prefix[j] as number) - (prefix[i] as number); // days [i, j)
    for (let t = o.windowDays + o.baselineDays - 1; t < nDays; t++) {
      const observed = sum(t + 1 - o.windowDays, t + 1);
      const baseline = sum(t + 1 - o.windowDays - o.baselineDays, t + 1 - o.windowDays);
      const expected = (baseline / o.baselineDays) * o.windowDays;
      const p = tail(observed, expected);
      if (p < o.alpha) signals.push({ detector, key: ward, date: addDays(start, t), ward, observed, expected, p });
    }
  }
  return signals;
}

/** Cultures in a unit over the window against the window's share of the unit's baseline mean (Poisson lower tail). Evaluated every day. */
export function samplingDrop(cultures: readonly Culture[], o: DropOptions): Signal[] {
  return cultureCountSignals(cultures, o, "sampling-drop", poissonLower);
}

/**
 * The upper-tail twin of `samplingDrop` (D-081): the same windows against the
 * same baseline, Poisson upper tail. A unit with no cultures in its baseline
 * has expected 0 and is not tested (a jump from nothing has no rate to compare with).
 */
export function volumeJump(cultures: readonly Culture[], o: DropOptions): Signal[] {
  return cultureCountSignals(cultures, o, "volume-jump", (observed, expected) => (expected > 0 ? poissonUpper(observed, expected) : 1));
}

// ---------- 4b. empty run ----------

export interface EmptyRunOptions {
  baselineDays: number;
  alpha: number;
}

/**
 * A run of consecutive days with no cultures from a unit (D-031): with
 * lambda the unit's mean daily cultures over the `baselineDays` before the
 * run began, L empty days in a row have probability exp(-lambda·L) under
 * Poisson sampling; signal on each empty day where that is below alpha.
 * `observed` is the run length in days, `expected` lambda per day.
 */
export function emptyRun(cultures: readonly Culture[], o: EmptyRunOptions): Signal[] {
  if (cultures.length === 0) return [];
  const dates = cultures.map((c) => c.sampleDate).sort();
  const start = dates[0] as IsoDate;
  const nDays = daysBetween(start, dates.at(-1) as IsoDate) + 1;
  const counts = new Map<WardCode, number[]>();
  for (const c of cultures) {
    const arr = counts.get(c.ward) ?? new Array<number>(nDays).fill(0);
    const i = daysBetween(start, c.sampleDate);
    arr[i] = (arr[i] ?? 0) + 1;
    counts.set(c.ward, arr);
  }
  const signals: Signal[] = [];
  for (const [ward, arr] of counts) {
    const prefix = [0];
    for (const n of arr) prefix.push((prefix.at(-1) as number) + n);
    let run = 0;
    for (let t = 0; t < nDays; t++) {
      run = arr[t] === 0 ? run + 1 : 0;
      if (run === 0) continue;
      const firstEmpty = t - run + 1;
      if (firstEmpty - o.baselineDays < 0) continue;
      const lambda = ((prefix[firstEmpty] as number) - (prefix[firstEmpty - o.baselineDays] as number)) / o.baselineDays;
      const p = Math.exp(-lambda * run);
      if (p < o.alpha)
        signals.push({ detector: "empty-run", key: ward, date: addDays(start, t), ward, observed: run, expected: lambda, p });
    }
  }
  return signals;
}

// ---------- pairs ----------

export interface Pair {
  organism: Organism;
  antibiotic: AntibioticCode;
  specimen?: IsolateRecord["specimen"];
}

/** The isolates a pair covers that have a result for its antibiotic. */
function inPair(r: IsolateRecord, pair: Pair): boolean {
  return r.organism === pair.organism && (!pair.specimen || r.specimen === pair.specimen) && r.results[pair.antibiotic] !== undefined;
}

const pairKey = (pair: Pair) => `${pair.organism}|${pair.antibiotic}|${pair.specimen ?? "all"}`;

// ---------- 6. rising trend ----------

export interface TrendOptions {
  binDays: number;
  minBins: number;
  alpha: number;
  /**
   * Leave an isolate out of the test made as of `asOf` (for example one that
   * belongs to a cluster already detected by then), so one outbreak is not
   * also reported as a hospital-wide trend.
   */
  exclude?: (r: IsolateRecord, asOf: IsoDate) => boolean;
}

/** Hospital-wide per pair: Cochran-Armitage test for a rise over bins from the start of the data to each bin end. */
export function risingTrend(records: readonly IsolateRecord[], pairs: readonly Pair[], o: TrendOptions): Signal[] {
  const sorted = [...records].sort(byDate);
  if (sorted.length === 0) return [];
  const start = (sorted[0] as IsolateRecord).sampleDate;
  const end = (sorted.at(-1) as IsolateRecord).sampleDate;
  const nBins = Math.floor((daysBetween(start, end) + 1) / o.binDays);
  const signals: Signal[] = [];
  for (const pair of pairs) {
    const tested = sorted.filter((r) => inPair(r, pair));
    const binsAsOf = (asOf: IsoDate) => {
      const bins = Array.from({ length: nBins }, () => ({ events: 0, n: 0 }));
      for (const r of tested) {
        if (r.sampleDate > asOf || o.exclude?.(r, asOf)) continue;
        const bin = bins[Math.floor(daysBetween(start, r.sampleDate) / o.binDays)];
        if (!bin) continue;
        bin.n++;
        if (r.results[pair.antibiotic] === "R") bin.events++;
      }
      return bins;
    };
    const all = o.exclude ? null : binsAsOf(end);
    for (let k = o.minBins; k <= nBins; k++) {
      const bins = all ?? binsAsOf(addDays(start, k * o.binDays - 1));
      const p = cochranArmitageRising(bins.slice(0, k));
      if (p < o.alpha) {
        const last = bins[k - 1] as { events: number; n: number };
        signals.push({
          detector: "rising-trend",
          key: pairKey(pair),
          date: addDays(start, k * o.binDays - 1),
          ward: null,
          organism: pair.organism,
          antibiotic: pair.antibiotic,
          observed: last.n ? last.events / last.n : 0,
          p,
        });
      }
    }
  }
  return signals;
}

// ---------- 7. resistance shift ----------

export interface ShiftOptions {
  windowDays: number;
  baselineDays: number;
  alpha: number;
  /** Known results needed in the baseline. */
  minBaseline: number;
  /** Known results needed in the window. */
  minWindow: number;
  /** Leave an isolate out of the test made as of `asOf` (as `TrendOptions.exclude`). */
  exclude?: (r: IsolateRecord, asOf: IsoDate) => boolean;
}

/**
 * Per unit, specimen, organism and antibiotic (D-080): the resistant results
 * of the last `windowDays` against the same unit's resistant share over the
 * `baselineDays` before the window (window excluded, share smoothed by adding
 * one half as in the excess detectors), one-sided exact binomial test.
 * `observed` is the resistant count in the window, `expected` the window's
 * known results times the baseline share. A result is known when the isolate
 * has an S, I or R for the antibiotic and resistant when it is R, as in
 * `risingTrend`. Evaluated on each day the stratum has a result.
 */
export function resistanceShift(records: readonly IsolateRecord[], o: ShiftOptions): Signal[] {
  const strata = new Map<string, { r: IsolateRecord; antibiotic: AntibioticCode }[]>();
  for (const r of [...records].sort(byDate)) {
    for (const antibiotic of Object.keys(r.results) as AntibioticCode[]) {
      const key = `${r.ward}|${r.specimen}|${r.organism}|${antibiotic}`;
      const list = strata.get(key);
      if (list) list.push({ r, antibiotic });
      else strata.set(key, [{ r, antibiotic }]);
    }
  }
  const signals: Signal[] = [];
  for (const [key, items] of strata) {
    const first = items[0] as { r: IsolateRecord; antibiotic: AntibioticCode };
    const { antibiotic } = first;
    const dates = items.map((x) => x.r.sampleDate);
    const resistant = [0];
    for (const x of items) resistant.push((resistant.at(-1) as number) + (x.r.results[antibiotic] === "R" ? 1 : 0));
    for (let i = 0; i < items.length; i++) {
      const date = dates[i] as IsoDate;
      if (i + 1 < items.length && dates[i + 1] === date) continue; // one test per day
      const from = addDays(date, 1 - o.windowDays);
      const baseFrom = addDays(from, -o.baselineDays);
      const w0 = lowerBound(dates, from);
      const b0 = lowerBound(dates, baseFrom);
      const w1 = i + 1;
      let nWindow = w1 - w0;
      let nBase = w0 - b0;
      let kWindow = (resistant[w1] as number) - (resistant[w0] as number);
      let kBase = (resistant[w0] as number) - (resistant[b0] as number);
      // Leaving isolates out only lowers the counts, so these gates are necessary either way.
      if (kWindow === 0 || nWindow < o.minWindow || nBase < o.minBaseline) continue;
      if (o.exclude) {
        const kept = (j: number) => !o.exclude?.((items[j] as { r: IsolateRecord }).r, date);
        nWindow = kWindow = nBase = kBase = 0;
        for (let j = b0; j < w1; j++) {
          if (!kept(j)) continue;
          const isR = (items[j] as { r: IsolateRecord }).r.results[antibiotic] === "R" ? 1 : 0;
          if (j < w0) {
            nBase++;
            kBase += isR;
          } else {
            nWindow++;
            kWindow += isR;
          }
        }
        if (nWindow < o.minWindow || nBase < o.minBaseline) continue;
      }
      const expected = nWindow * ((kBase + PROFILE_SMOOTHING) / (nBase + 1));
      const p = binomialUpper(kWindow, nWindow, (kBase + PROFILE_SMOOTHING) / (nBase + 1));
      if (p < o.alpha) {
        const r = (items[i] as { r: IsolateRecord }).r;
        signals.push({
          detector: "resistance-shift",
          key,
          date,
          ward: r.ward,
          organism: r.organism,
          antibiotic,
          observed: kWindow,
          expected,
          p,
        });
      }
    }
  }
  return signals;
}

// ---------- episodes ----------

export interface Episode {
  detector: DetectorName;
  key: string;
  first: Signal;
  last: Signal;
  signals: number;
}

export const EPISODE_DAYS = 28;

/** Signals with the same detector and key, at most `gapDays` apart, merged into one episode. */
export function episodes(signals: readonly Signal[], gapDays = EPISODE_DAYS): Episode[] {
  const out: Episode[] = [];
  for (const [, list] of groupBy(signals, (s) => `${s.detector}|${s.key}`)) {
    list.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    let current: Episode | null = null;
    for (const s of list) {
      if (current && daysBetween(current.last.date, s.date) <= gapDays) {
        current.last = s;
        current.signals++;
      } else {
        current = { detector: s.detector, key: s.key, first: s, last: s, signals: 1 };
        out.push(current);
      }
    }
  }
  return out.sort((a, b) => (a.first.date < b.first.date ? -1 : a.first.date > b.first.date ? 1 : 0));
}
