import type { IsoDate, Result } from "../feed/types.ts";

// The organiser's counting rule: only the first isolate per patient, per
// organism, per specimen in the period is counted, so one patient sampled ten
// times does not count ten times.
//
// Two ways in:
//   firstIsolates()   plain and order-free, for any array of results.
//   indexResults() + firstPositions()   the same rule over a pre-sorted index,
//                     cached by the results array's identity, for code that
//                     counts the same released results many times per render.

/** The de-duplication key: one patient, one organism, one specimen. */
export function isolateKey(r: Result): string {
  return `${r.patientId}\u0000${r.organism}\u0000${r.specimen}`;
}

/** Time order: earlier sample first, then lower isolate id. */
export function compareResults(a: Result, b: Result): number {
  if (a.sampleDate !== b.sampleDate) return a.sampleDate < b.sampleDate ? -1 : 1;
  if (a.isolateId !== b.isolateId) return a.isolateId < b.isolateId ? -1 : 1;
  return 0;
}

/**
 * First isolates among results sampled in (from, to] — `from` exclusive, `to`
 * inclusive, null = open — that `keep` accepts (all when omitted): the earliest
 * per (patient, organism, specimen), ties by isolate id. In time order.
 *
 * `keep` is applied before de-duplication, so the count answers "patients like
 * this one": a patient first sampled on another unit still counts once here.
 */
export function firstIsolates(
  results: readonly Result[],
  from: IsoDate | null,
  to: IsoDate | null,
  keep?: (r: Result) => boolean,
): Result[] {
  const first = new Map<string, Result>();
  for (const r of results) {
    if (from !== null && r.sampleDate <= from) continue;
    if (to !== null && r.sampleDate > to) continue;
    if (keep && !keep(r)) continue;
    const key = isolateKey(r);
    const seen = first.get(key);
    if (!seen || compareResults(r, seen) < 0) first.set(key, r);
  }
  return [...first.values()].sort(compareResults);
}

// ---------- Index: the same rule, fast enough for every render ----------

export interface ResultIndex {
  /** The results in time order (sample date, then isolate id). */
  readonly sorted: readonly Result[];
  /** sorted[i].sampleDate, for binary search. */
  readonly dates: readonly IsoDate[];
  /** De-duplication key id of sorted[i]; equal ids = same patient, organism and specimen. */
  readonly keys: Int32Array;
  /** Number of distinct key ids. */
  readonly keyCount: number;
}

interface BuiltIndex extends ResultIndex {
  /** Whether the array was already in time order (then `sorted` is a snapshot of it). */
  readonly inputSorted: boolean;
}

const cache = new WeakMap<readonly Result[], BuiltIndex>();
// The most recent index: a new array that only appends to its array (the
// feed's daily arrivals) extends it instead of being indexed from scratch.
let latest: BuiltIndex | null = null;

// Key ids are stable for the session: the same patient, organism and specimen
// always get the same id, in every index.
const patientIds = new Map<string, number>();
const organismIds = new Map<string, number>();
const specimenIds = new Map<string, number>();
const comboIds = new Map<number, number>();
const comboIdsByText = new Map<string, number>(); // only for code lists too long for the numeric key
let keyCount = 0;

function idOf(map: Map<string, number>, value: string): number {
  let id = map.get(value);
  if (id === undefined) {
    id = map.size;
    map.set(value, id);
  }
  return id;
}

function keyIdOf(r: Result): number {
  const p = idOf(patientIds, r.patientId);
  const o = idOf(organismIds, r.organism);
  const s = idOf(specimenIds, r.specimen);
  let id: number | undefined;
  if (o < 65_536 && s < 1_024 && p < 2 ** 26) {
    const combo = (p * 65_536 + o) * 1_024 + s;
    id = comboIds.get(combo);
    if (id === undefined) comboIds.set(combo, (id = keyCount++));
  } else {
    const combo = `${p}:${o}:${s}`;
    id = comboIdsByText.get(combo);
    if (id === undefined) comboIdsByText.set(combo, (id = keyCount++));
  }
  return id;
}

/**
 * The index of a results array, built once per array identity. An array that
 * starts with exactly the results of the previously indexed one, followed by
 * later results (a new array per arrival, or results pushed onto the same
 * array), is indexed by extending the previous index. Other in-place changes
 * to an indexed array are not noticed: replace the array instead.
 */
export function indexResults(results: readonly Result[]): ResultIndex {
  const cached = cache.get(results);
  if (cached && cached.sorted.length === results.length) return cached;
  const base = cached ?? latest;
  const index = (base && extension(base, results)) || build(results);
  cache.set(results, index);
  latest = index;
  return index;
}

function build(results: readonly Result[]): BuiltIndex {
  const inputSorted = isSorted(results, 0);
  const sorted = inputSorted ? results.slice() : results.slice().sort(compareResults);
  const dates = new Array<IsoDate>(sorted.length);
  const keys = new Int32Array(sorted.length);
  for (let i = 0; i < sorted.length; i++) {
    const r = sorted[i]!;
    dates[i] = r.sampleDate;
    keys[i] = keyIdOf(r);
  }
  return { sorted, dates, keys, keyCount, inputSorted };
}

/** `base` extended by the results appended after it, or null when `results` is not such an extension. */
function extension(base: BuiltIndex, results: readonly Result[]): BuiltIndex | null {
  const old = base.sorted;
  if (!base.inputSorted || results.length < old.length) return null;
  for (let i = 0; i < old.length; i++) if (results[i] !== old[i]) return null;
  if (!isSorted(results, Math.max(0, old.length - 1))) return null;
  const sorted = results.slice();
  const dates = base.dates.concat(new Array<IsoDate>(results.length - old.length));
  const keys = new Int32Array(results.length);
  keys.set(base.keys);
  for (let i = old.length; i < results.length; i++) {
    const r = results[i]!;
    dates[i] = r.sampleDate;
    keys[i] = keyIdOf(r);
  }
  return { sorted, dates, keys, keyCount, inputSorted: true };
}

function isSorted(results: readonly Result[], from: number): boolean {
  for (let i = from + 1; i < results.length; i++) if (compareResults(results[i - 1]!, results[i]!) > 0) return false;
  return true;
}

/** Positions [lo, hi) of index.sorted sampled in (from, to]; null = open. */
export function windowRange(index: ResultIndex, from: IsoDate | null, to: IsoDate | null): [number, number] {
  const lo = from === null ? 0 : upperBound(index.dates, from);
  const hi = to === null ? index.dates.length : upperBound(index.dates, to);
  return [lo, Math.max(lo, hi)];
}

/** First position whose date is > `date`. */
function upperBound(dates: readonly IsoDate[], date: IsoDate): number {
  let lo = 0;
  let hi = dates.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (dates[mid]! <= date) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Positions in index.sorted of the first isolates sampled in (from, to] among
 * those `keep(position)` accepts (all when omitted), in time order. Same rule
 * as firstIsolates().
 */
export function firstPositions(
  index: ResultIndex,
  from: IsoDate | null,
  to: IsoDate | null,
  keep?: (position: number) => boolean,
): number[] {
  const [lo, hi] = windowRange(index, from, to);
  const seen = new Uint8Array(index.keyCount);
  const out: number[] = [];
  const { keys } = index;
  for (let i = lo; i < hi; i++) {
    const key = keys[i]!;
    if (seen[key] === 1) continue;
    if (keep && !keep(i)) continue;
    seen[key] = 1;
    out.push(i);
  }
  return out;
}
