import type { IsoDate, Result } from "../feed/types.ts";
import { cochranArmitageUp, fisherMidPGreater, poissonLower, poissonUpper } from "./stats.ts";
import type { Catalog, Severity, Share, Signal, SignalKind, SignalOptions } from "./types.ts";

// Deviation detection. Pure and strictly causal: a call for `asOf` only ever
// looks at results sampled on or before `asOf`. Nothing here knows which units,
// organisms, antibiotics or specimens exist; every key comes from the results.
//
// How it works: each day d is tested on its own (data up to d only) and gives a
// set of daily hits; hits of the same kind+key at most EPISODE_GAP_DAYS apart are
// merged into one episode. Daily hits are cached per results fingerprint, so the
// app's once-a-day call only computes the new day.

// ---------- Thresholds: provisional — the team confirms ----------
// Alphas come from the team's experiment notes (experiments/0002): profile excess
// 0.0001, phenotype excess 0.001, sampling drop 0.0001, rising trend 0.001.

/** provisional — the team confirms: daily hits this many days apart or closer form one episode. */
export const EPISODE_GAP_DAYS = 28;

/** provisional — the team confirms: a non-sentinel flag is "new" on a unit after this many quiet days. */
export const NEW_FLAG_QUIET_DAYS = 90;
/** provisional — the team confirms: sentinel isolates this close together form one episode. */
export const SENTINEL_GAP_DAYS = 28;

/** provisional — the team confirms: surge = patients with a flag on a unit, last 14 days vs the unit's year before. */
export const SURGE_WINDOW_DAYS = 14;
export const SURGE_BASELINE_DAYS = 365;
export const SURGE_ALPHA = 0.001;
export const SURGE_MIN_PATIENTS = 3;

/** provisional — the team confirms: cluster = same organism, specimen and resistance profile on a unit, last 28 days. */
export const CLUSTER_WINDOW_DAYS = 28;
export const CLUSTER_BASELINE_DAYS = 365;
export const CLUSTER_ALPHA = 0.0001;
export const CLUSTER_MIN_PATIENTS = 3;
/** Added to the profile's hospital count (and twice to the total) so an unseen profile is not "impossible". */
export const CLUSTER_SMOOTHING = 0.5;

/** provisional — the team confirms: data gap = results from a unit, last 7 days vs its previous 84 days. */
export const GAP_WINDOW_DAYS = 7;
export const GAP_BASELINE_DAYS = 84;
export const GAP_ALPHA = 0.0001;
export const GAP_ZERO_RUN_DAYS = 5;
export const GAP_ZERO_RUN_MIN_PER_DAY = 2;

/** provisional — the team confirms: shift = % resistant on a unit, last 28 days vs the 336 days before. */
export const SHIFT_WINDOW_DAYS = 28;
export const SHIFT_BASELINE_DAYS = 336;
export const SHIFT_ALPHA = 0.001;
export const SHIFT_MIN_RESISTANT = 3;
/** provisional — the team confirms: the baseline share must rest on the organiser's 30 isolates. */
export const SHIFT_MIN_BASELINE = 30;

/** provisional — the team confirms: trend = hospital-wide Cochran-Armitage over 28-day bins. */
export const TREND_BIN_DAYS = 28;
export const TREND_MIN_BINS = 26;
export const TREND_MAX_BINS = 39;
export const TREND_ALPHA = 0.001;
/** Rise in percentage points: last 13 bins vs the bins before them. */
export const TREND_MIN_RISE = 2;
export const TREND_RECENT_BINS = 13;
export const TREND_MIN_ISOLATES = 30;

/** First-isolate rule for baselines: one isolate per patient, organism and specimen per this many days. */
export const FIRST_ISOLATE_DAYS = 365;

export const DEFAULT_SIGNALS: SignalOptions = { minHistoryDays: 182, sentinelPhenotypes: ["cpe", "vre"] };

// ---------- Dates ----------

const DAY_MS = 86_400_000;
const dayCache = new Map<string, number>();
function dayNum(date: IsoDate): number {
  let d = dayCache.get(date);
  if (d === undefined) {
    d = Math.floor(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10)) / DAY_MS);
    dayCache.set(date, d);
  }
  return d;
}
function isoOf(day: number): IsoDate {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}


// ---------- Index over the results (append-only, so a new day costs little) ----------

function lowerBound(a: readonly number[], x: number): number {
  let lo = 0;
  let hi = a.length;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (a[m]! < x) lo = m + 1;
    else hi = m;
  }
  return lo;
}
/** How many entries of a sorted day list fall in [from, to]. */
function countIn(a: readonly number[], from: number, to: number): number {
  if (to < from) return 0;
  return lowerBound(a, to + 1) - lowerBound(a, from);
}

/** Counts per day with a prefix sum rebuilt lazily from the first changed day. */
class DayCounts {
  daily: number[] = [];
  prefix: number[] = [0];
  add(day: number): void {
    const d = this.daily;
    while (d.length <= day) d.push(0); // dense, never a sparse (slow) array
    d[day]!++;
    if (this.prefix.length > day + 1) this.prefix.length = day + 1;
  }
  /** Sum over days [from, to]; days outside the data count as zero. */
  sum(from: number, to: number): number {
    if (from < 0) from = 0;
    if (to < from) return 0;
    const p = this.prefix;
    while (p.length <= to + 1) {
      const k = p.length - 1;
      p.push(p[k]! + (this.daily[k] ?? 0));
    }
    return p[to + 1]! - p[from]!;
  }
}

interface Iso {
  r: Result;
  /** Day offset from index day 0. */
  day: number;
  unit: number;
  patient: number;
  /** organism + specimen id. */
  os: number;
  profile: number;
  /** Counted under the first-isolate rule (FIRST_ISOLATE_DAYS lookback, causal). */
  first: boolean;
  /** Day of the same patient's previous isolate of this organism+specimen on this unit (-Infinity if none). */
  prevOnUnit: number;
  /** Antibiotic ids tested, and whether each was resisted. */
  tested: number[];
  resistant: boolean[];
}

interface FlagEvents {
  unit: number;
  flag: string;
  days: number[];
  isos: Iso[];
}

interface Index {
  day0: number;
  /** Day offset of the last result indexed (-1 when empty). */
  lastDay: number;
  size: number;
  units: string[];
  unitIds: Map<string, number>;
  unitFirst: number[];
  unitCounts: DayCounts[];
  /** Per unit, per day, the isos of that unit. */
  unitDays: Iso[][][];
  patientIds: Map<string, number>;
  osIds: Map<string, number>;
  osNames: { organism: string; specimen: string }[];
  abxIds: Map<string, number>;
  abxCodes: string[];
  profileIds: Map<string, number>;
  /** Resisted antibiotic ids of each profile. */
  profiles: number[][];
  lastCounted: Map<number, number>;
  /** Per unit: patient+organism+specimen key -> day of the last isolate. */
  lastOnUnit: Map<number, number>[];
  /** Per day, a fingerprint (count and hash) of the results on that day. */
  dayCount: number[];
  dayHash: number[];
  flagMap: Map<string, FlagEvents>;
  flagEvents: FlagEvents[];
  /** Hospital-wide first isolates: [os] profile -> days. */
  profileDays: Map<number, number[]>[];
  /** Hospital-wide first isolates per os: days. */
  osDays: number[][];
  /** Hospital-wide first isolates per [os][abx]: daily resistant and tested counts. */
  osAbx: { r: DayCounts; n: DayCounts }[][];
  /** Unit first isolates per [unit][os][abx]: day lists of resistant and tested. */
  unitAbx: { r: number[]; n: number[] }[][][];
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h | 0;
}

function byDate(a: Result, b: Result): number {
  return a.sampleDate < b.sampleDate ? -1 : a.sampleDate > b.sampleDate ? 1 : 0;
}

function emptyIndex(day0: number): Index {
  return {
    day0,
    lastDay: -1,
    size: 0,
    units: [],
    unitIds: new Map(),
    unitFirst: [],
    unitCounts: [],
    unitDays: [],
    patientIds: new Map(),
    osIds: new Map(),
    osNames: [],
    abxIds: new Map(),
    abxCodes: [],
    profileIds: new Map(),
    profiles: [],
    lastCounted: new Map(),
    lastOnUnit: [],
    dayCount: [],
    dayHash: [],
    flagMap: new Map(),
    flagEvents: [],
    profileDays: [],
    osDays: [],
    osAbx: [],
    unitAbx: [],
  };
}

function idOf(map: Map<string, number>, key: string, onNew: () => void): number {
  let id = map.get(key);
  if (id === undefined) {
    id = map.size;
    map.set(key, id);
    onNew();
  }
  return id;
}

/** Add results sampled on or after ix.lastDay (sorted here). */
function appendToIndex(ix: Index, added: readonly Result[]): void {
  const sorted = isSorted(added) ? added : [...added].sort(byDate);
  for (const r of sorted) {
    const day = dayNum(r.sampleDate) - ix.day0;
    const unit = idOf(ix.unitIds, r.ward, () => {
      ix.units.push(r.ward);
      ix.unitFirst.push(day);
      ix.unitCounts.push(new DayCounts());
      ix.unitDays.push([]);
      ix.unitAbx.push([]);
      ix.lastOnUnit.push(new Map());
    });
    const patient = idOf(ix.patientIds, r.patientId, () => {});
    const os = idOf(ix.osIds, r.organism + "\u0000" + r.specimen, () => {
      ix.osNames.push({ organism: r.organism, specimen: r.specimen });
      ix.profileDays.push(new Map());
      ix.osDays.push([]);
      ix.osAbx.push([]);
    });
    const tested: number[] = [];
    const resistant: boolean[] = [];
    const codes = Object.keys(r.results).sort();
    const resisted: number[] = [];
    for (const code of codes) {
      const a = idOf(ix.abxIds, code, () => ix.abxCodes.push(code));
      const isR = r.results[code] === "R";
      tested.push(a);
      resistant.push(isR);
      if (isR) resisted.push(a);
    }
    const profile = idOf(ix.profileIds, resisted.join(","), () => ix.profiles.push(resisted));
    const fKey = patient * 65536 + os;
    const last = ix.lastCounted.get(fKey);
    const first = last === undefined || day - last >= FIRST_ISOLATE_DAYS;
    if (first) ix.lastCounted.set(fKey, day);
    while (ix.dayCount.length <= day) {
      ix.dayCount.push(0);
      ix.dayHash.push(0);
    }
    ix.dayCount[day]!++;
    ix.dayHash[day] = (ix.dayHash[day]! + hashStr(r.isolateId)) | 0;
    const onUnit = ix.lastOnUnit[unit]!;
    const prevOnUnit = onUnit.get(fKey) ?? -Infinity;
    onUnit.set(fKey, day);
    const iso: Iso = { r, day, unit, patient, os, profile, first, prevOnUnit, tested, resistant };
    ix.size++;
    if (day > ix.lastDay) ix.lastDay = day;

    ix.unitCounts[unit]!.add(day);
    const ud = ix.unitDays[unit]!;
    while (ud.length <= day) ud.push([]);
    ud[day]!.push(iso);
    for (const f of r.phenotypes) {
      const flag = f.toLowerCase();
      const k = unit + "|" + flag;
      let fe = ix.flagMap.get(k);
      if (!fe) {
        fe = { unit, flag, days: [], isos: [] };
        ix.flagMap.set(k, fe);
        ix.flagEvents.push(fe);
      }
      fe.days.push(day);
      fe.isos.push(iso);
    }
    if (!first) continue;
    const pd = ix.profileDays[os]!;
    let list = pd.get(profile);
    if (!list) pd.set(profile, (list = []));
    list.push(day);
    ix.osDays[os]!.push(day);
    const hosp = ix.osAbx[os]!;
    const unitOs = (ix.unitAbx[unit]![os] ??= []);
    for (let i = 0; i < tested.length; i++) {
      const a = tested[i]!;
      const h = (hosp[a] ??= { r: new DayCounts(), n: new DayCounts() });
      const ua = (unitOs[a] ??= { r: [], n: [] });
      h.n.add(day);
      ua.n.push(day);
      if (resistant[i]) {
        h.r.add(day);
        ua.r.push(day);
      }
    }
  }
}

function isSorted(rs: readonly Result[]): boolean {
  for (let i = 1; i < rs.length; i++) if (rs[i - 1]!.sampleDate > rs[i]!.sampleDate) return false;
  return true;
}

function buildIndex(results: readonly Result[]): Index {
  let min = results[0]!.sampleDate;
  for (const r of results) if (r.sampleDate < min) min = r.sampleDate;
  const ix = emptyIndex(dayNum(min));
  appendToIndex(ix, results);
  return ix;
}

// ---------- Daily hits ----------

/** One day's evidence for one kind+key; episodes are built from these. */
interface Hit {
  kind: SignalKind;
  key: string;
  day: number;
  severity: Severity;
  signal: Omit<Signal, "id" | "firstDate" | "lastDate" | "kind" | "severity">;
}

function distinctPatients(isos: readonly Iso[]): number {
  return new Set(isos.map((i) => i.patient)).size;
}

function round(x: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(x * f) / f;
}

function hitsForDay(ix: Index, d: number, opts: SignalOptions): Hit[] {
  const hits: Hit[] = [];
  const minHist = opts.minHistoryDays;
  const unitReady = (u: number) => ix.unitFirst[u]! <= d - minHist;

  // data-gap: far fewer results than the unit's own recent normal (a data problem, not epidemiology).
  for (let u = 0; u < ix.units.length; u++) {
    if (!unitReady(u) || ix.unitFirst[u]! > d - GAP_WINDOW_DAYS - GAP_BASELINE_DAYS + 1) continue;
    const c = ix.unitCounts[u]!;
    const obs = c.sum(d - GAP_WINDOW_DAYS + 1, d);
    const base = c.sum(d - GAP_WINDOW_DAYS - GAP_BASELINE_DAYS + 1, d - GAP_WINDOW_DAYS);
    const perDay = base / GAP_BASELINE_DAYS;
    const expected = perDay * GAP_WINDOW_DAYS;
    let zeroRun = 0;
    while (zeroRun < GAP_BASELINE_DAYS && c.sum(d - zeroRun, d - zeroRun) === 0) zeroRun++;
    const pv = poissonLower(obs, expected);
    if (pv < GAP_ALPHA || (zeroRun >= GAP_ZERO_RUN_DAYS && perDay >= GAP_ZERO_RUN_MIN_PER_DAY)) {
      hits.push({
        kind: "data-gap",
        key: ix.units[u]!,
        day: d,
        severity: "medium",
        signal: { ward: ix.units[u]!, observed: obs, expected: round(expected, 1), p: pv, isolateIds: [] },
      });
    }
  }

  // surge: more patients with a flag on a unit than its own year predicts.
  for (const fe of ix.flagEvents) {
    if (!unitReady(fe.unit)) continue;
    const wFrom = d - SURGE_WINDOW_DAYS + 1;
    const lo = lowerBound(fe.days, wFrom);
    const hi = lowerBound(fe.days, d + 1);
    if (hi - lo < SURGE_MIN_PATIENTS) continue;
    const win = fe.isos.slice(lo, hi);
    const obs = distinctPatients(win);
    if (obs < SURGE_MIN_PATIENTS) continue;
    const bFrom = Math.max(ix.unitFirst[fe.unit]!, wFrom - SURGE_BASELINE_DAYS);
    const bLen = wFrom - bFrom;
    const base = distinctPatients(fe.isos.slice(lowerBound(fe.days, bFrom), lo));
    const expected = ((base + 0.5) / bLen) * SURGE_WINDOW_DAYS;
    const pv = poissonUpper(obs, expected);
    if (pv >= SURGE_ALPHA) continue;
    const orgs = new Set(win.map((i) => i.r.organism));
    hits.push({
      kind: "surge",
      key: ix.units[fe.unit] + "|" + fe.flag,
      day: d,
      severity: "high",
      signal: {
        ward: ix.units[fe.unit]!,
        phenotype: fe.flag,
        organism: orgs.size === 1 ? [...orgs][0] : undefined,
        observed: obs,
        expected: round(expected, 2),
        p: pv,
        patients: obs,
        isolateIds: win.map((i) => i.r.isolateId),
      },
    });
  }

  // cluster + shift share one pass over each unit's last 28 days.
  const hospitalReady = d >= minHist;
  for (let u = 0; u < ix.units.length; u++) {
    if (!unitReady(u)) continue;
    const days = ix.unitDays[u]!;
    const wFrom = Math.max(0, d - CLUSTER_WINDOW_DAYS + 1);
    // First isolate per patient per organism+specimen in the window (none earlier in it on this unit).
    const byOs = new Map<number, Iso[]>();
    for (let dd = wFrom; dd <= d; dd++) {
      const list = days[dd];
      if (!list) continue;
      for (const iso of list) {
        if (iso.prevOnUnit >= wFrom) continue;
        let l = byOs.get(iso.os);
        if (!l) byOs.set(iso.os, (l = []));
        l.push(iso);
      }
    }
    for (const [os, list] of byOs) {
      if (hospitalReady && list.length >= CLUSTER_MIN_PATIENTS) clusterTest(ix, d, u, os, list, hits);
      if (list.length >= SHIFT_MIN_RESISTANT) shiftTest(ix, d, u, os, list, hits);
    }
  }

  // trend: hospital-wide, rising % resistant over many 28-day bins.
  const bins = Math.min(TREND_MAX_BINS, Math.floor((d + 1) / TREND_BIN_DAYS));
  if (bins >= TREND_MIN_BINS && hospitalReady) {
    const ev: number[] = new Array(bins);
    const tot: number[] = new Array(bins);
    for (let os = 0; os < ix.osAbx.length; os++) {
      const row = ix.osAbx[os]!;
      for (let a = 0; a < row.length; a++) {
        const h = row[a];
        if (!h) continue;
        const start = d - bins * TREND_BIN_DAYS + 1;
        const mid = d - TREND_RECENT_BINS * TREND_BIN_DAYS;
        const rN = h.n.sum(mid + 1, d);
        const bN = h.n.sum(start, mid);
        if (rN < TREND_MIN_ISOLATES || bN < TREND_MIN_ISOLATES) continue;
        const rR = h.r.sum(mid + 1, d);
        const bR = h.r.sum(start, mid);
        if ((100 * rR) / rN - (100 * bR) / bN < TREND_MIN_RISE) continue;
        for (let b = 0; b < bins; b++) {
          const to = d - (bins - 1 - b) * TREND_BIN_DAYS;
          ev[b] = h.r.sum(to - TREND_BIN_DAYS + 1, to);
          tot[b] = h.n.sum(to - TREND_BIN_DAYS + 1, to);
        }
        const { p } = cochranArmitageUp(ev, tot);
        if (p >= TREND_ALPHA) continue;
        const { organism, specimen } = ix.osNames[os]!;
        const abx = ix.abxCodes[a]!;
        hits.push({
          kind: "trend",
          key: organism + "|" + specimen + "|" + abx,
          day: d,
          severity: "medium",
          signal: {
            ward: null,
            organism,
            specimen,
            antibiotic: abx,
            observed: round((100 * rR) / rN, 1),
            expected: round((100 * bR) / bN, 1),
            p,
            isolateIds: [],
            recent: { works: rN - rR, n: rN },
            baseline: { works: bN - bR, n: bN },
          },
        });
      }
    }
  }
  return hits;
}

function clusterTest(ix: Index, d: number, u: number, os: number, list: Iso[], hits: Hit[]) {
  const byProfile = new Map<number, Iso[]>();
  for (const iso of list) {
    if (ix.profiles[iso.profile]!.length === 0) continue;
    let l = byProfile.get(iso.profile);
    if (!l) byProfile.set(iso.profile, (l = []));
    l.push(iso);
  }
  const wFrom = d - CLUSTER_WINDOW_DAYS + 1;
  const bFrom = wFrom - CLUSTER_BASELINE_DAYS;
  const bTo = wFrom - 1;
  const hosp = ix.osAbx[os]!;
  for (const [profile, isos] of byProfile) {
    if (isos.length < CLUSTER_MIN_PATIENTS) continue;
    const resisted = ix.profiles[profile]!;
    // Not a wild-type profile: at least one antibiotic that most of this organism does not resist.
    const unusual = resisted.some((a) => {
      const h = hosp[a];
      if (!h) return true;
      const n = h.n.sum(bFrom, bTo);
      return n === 0 || h.r.sum(bFrom, bTo) / n < 0.5;
    });
    if (!unusual) continue;
    const pCount = countIn(ix.profileDays[os]!.get(profile) ?? [], bFrom, bTo);
    const total = countIn(ix.osDays[os]!, bFrom, bTo);
    const shareP = (pCount + CLUSTER_SMOOTHING) / (total + 2 * CLUSTER_SMOOTHING);
    const expected = list.length * shareP;
    const obs = isos.length;
    const pv = poissonUpper(obs, expected);
    if (pv >= CLUSTER_ALPHA) continue;
    const { organism, specimen } = ix.osNames[os]!;
    const codes = resisted.map((a) => ix.abxCodes[a]!);
    const phen = new Set(isos.flatMap((i) => i.r.phenotypes.map((f) => f.toLowerCase())));
    hits.push({
      kind: "cluster",
      key: ix.units[u] + "|" + organism + "|" + specimen + "|" + codes.join("+"),
      day: d,
      severity: "high",
      signal: {
        ward: ix.units[u]!,
        organism,
        specimen,
        phenotype: phen.size === 1 ? [...phen][0] : undefined,
        resists: codes,
        observed: obs,
        expected: round(expected, 2),
        p: pv,
        patients: obs,
        isolateIds: isos.map((i) => i.r.isolateId),
      },
    });
  }
}

function shiftTest(ix: Index, d: number, u: number, os: number, list: Iso[], hits: Hit[]) {
  const nAbx = ix.abxCodes.length;
  const cr = new Int32Array(nAbx);
  const cn = new Int32Array(nAbx);
  for (const iso of list) {
    for (let i = 0; i < iso.tested.length; i++) {
      const a = iso.tested[i]!;
      cn[a]!++;
      if (iso.resistant[i]) cr[a]!++;
    }
  }
  const wFrom = d - SHIFT_WINDOW_DAYS + 1;
  const bFrom = Math.max(ix.unitFirst[u]!, wFrom - SHIFT_BASELINE_DAYS);
  const bTo = wFrom - 1;
  const unitOs = ix.unitAbx[u]![os];
  if (!unitOs) return;
  for (let a = 0; a < nAbx; a++) {
    const c = { r: cr[a]!, n: cn[a]! };
    if (c.r < SHIFT_MIN_RESISTANT) continue;
    const ua = unitOs[a];
    if (!ua) continue;
    const bn = countIn(ua.n, bFrom, bTo);
    if (bn < SHIFT_MIN_BASELINE) continue;
    const br = countIn(ua.r, bFrom, bTo);
    if (c.r / c.n <= br / bn) continue;
    const pv = fisherMidPGreater(c.r, c.n, br, bn);
    if (pv >= SHIFT_ALPHA) continue;
    const { organism, specimen } = ix.osNames[os]!;
    const abx = ix.abxCodes[a]!;
    hits.push({
      kind: "shift",
      key: ix.units[u] + "|" + organism + "|" + specimen + "|" + abx,
      day: d,
      severity: "medium",
      signal: {
        ward: ix.units[u]!,
        organism,
        specimen,
        antibiotic: abx,
        observed: round((100 * c.r) / c.n, 1),
        expected: round((100 * br) / bn, 1),
        p: pv,
        isolateIds: list.filter((iso) => iso.resistant[iso.tested.indexOf(a)]).map((iso) => iso.r.isolateId),
        recent: { works: c.n - c.r, n: c.n },
        baseline: { works: bn - br, n: bn },
      },
    });
  }
}

// ---------- Sentinels (event-driven, cheap: computed on every call) ----------

function sentinelEpisodes(ix: Index, last: number, opts: SignalOptions): Signal[] {
  const sentinel = new Set(opts.sentinelPhenotypes.map((f) => f.toLowerCase()));
  const out: Signal[] = [];
  const emit = (key: string, severity: Severity, ward: string, flag: string, isos: Iso[]) => {
    const orgs = new Set(isos.map((i) => i.r.organism));
    const specs = new Set(isos.map((i) => i.r.specimen));
    const patients = distinctPatients(isos);
    const firstDate = isoOf(ix.day0 + isos[0]!.day);
    out.push({
      id: "sentinel|" + key + "|" + firstDate,
      kind: "sentinel",
      severity,
      firstDate,
      lastDate: isoOf(ix.day0 + isos[isos.length - 1]!.day),
      ward,
      phenotype: flag,
      organism: orgs.size === 1 ? [...orgs][0] : undefined,
      specimen: specs.size === 1 ? [...specs][0] : undefined,
      observed: patients,
      patients,
      isolateIds: isos.map((i) => i.r.isolateId),
    });
  };
  for (const fe of ix.flagEvents) {
    const ward = ix.units[fe.unit]!;
    const n = lowerBound(fe.days, last + 1);
    if (sentinel.has(fe.flag)) {
      // Always alarming. One episode per unit + flag + organism; isolates within SENTINEL_GAP_DAYS join it.
      const open = new Map<string, Iso[]>();
      for (let i = 0; i < n; i++) {
        const iso = fe.isos[i]!;
        const org = iso.r.organism;
        const ep = open.get(org);
        if (ep && iso.day - ep[ep.length - 1]!.day <= SENTINEL_GAP_DAYS) ep.push(iso);
        else {
          if (ep) emit(ward + "|" + fe.flag + "|" + org, "high", ward, fe.flag, ep);
          open.set(org, [iso]);
        }
      }
      for (const [org, ep] of open) emit(ward + "|" + fe.flag + "|" + org, "high", ward, fe.flag, ep);
    } else {
      // Any other flag back on a unit after NEW_FLAG_QUIET_DAYS without it (or its first, once the unit has history).
      let ep: Iso[] | null = null;
      for (let i = 0; i < n; i++) {
        const iso = fe.isos[i]!;
        if (ep && iso.day - ep[ep.length - 1]!.day <= SENTINEL_GAP_DAYS) {
          ep.push(iso);
          continue;
        }
        if (ep) emit(ward + "|" + fe.flag, "medium", ward, fe.flag, ep);
        ep = null;
        const novel =
          i === 0
            ? iso.day - ix.unitFirst[fe.unit]! >= Math.max(NEW_FLAG_QUIET_DAYS, opts.minHistoryDays)
            : iso.day - fe.days[i - 1]! >= NEW_FLAG_QUIET_DAYS;
        if (novel) ep = [iso];
      }
      if (ep) emit(ward + "|" + fe.flag, "medium", ward, fe.flag, ep);
    }
  }
  return out;
}

// ---------- Episodes, cache and entry point ----------

interface Cache {
  results: readonly Result[];
  /** results.length when indexed (the app may append in place). */
  n: number;
  optsKey: string;
  ix: Index;
  /** Days [0, computed) have their hits in dayHits. */
  computed: number;
  dayHits: Hit[][];
}

let cache: Cache | null = null;

function samePrefix(a: readonly Result[], b: readonly Result[], n: number): boolean {
  if (a === b) return true;
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return false;
  return true;
}

function prepare(results: readonly Result[], opts: SignalOptions): Cache {
  const optsKey = JSON.stringify(opts);
  const c = cache;
  if (c && c.optsKey === optsKey && results.length >= c.n && samePrefix(c.results, results, c.n)) {
    if (results.length === c.n) {
      c.results = results;
      return c;
    }
    // Only new results appended: index them; days from the earliest new one are recomputed.
    const added = results.slice(c.n);
    let minDay = Infinity;
    for (const r of added) minDay = Math.min(minDay, dayNum(r.sampleDate) - c.ix.day0);
    if (minDay >= c.ix.lastDay) {
      appendToIndex(c.ix, added);
      c.results = results;
      c.n = results.length;
      if (c.computed > minDay) {
        c.computed = minDay;
        c.dayHits.length = minDay;
      }
      return c;
    }
  }
  const ix = buildIndex(results);
  let keep = 0;
  if (c && c.optsKey === optsKey && c.ix.day0 === ix.day0) {
    // Reuse every day whose results (and all days before it) are unchanged.
    const old = c.ix;
    while (
      keep < c.computed &&
      (old.dayCount[keep] ?? 0) === (ix.dayCount[keep] ?? 0) &&
      (old.dayHash[keep] ?? 0) === (ix.dayHash[keep] ?? 0)
    )
      keep++;
  }
  cache = { results, n: results.length, optsKey, ix, computed: keep, dayHits: c && keep > 0 ? c.dayHits.slice(0, keep) : [] };
  return cache;
}

function episodesFromHits(c: Cache, last: number): Signal[] {
  const byKey = new Map<string, Hit[][]>();
  for (let d = 0; d <= last; d++) {
    for (const h of c.dayHits[d] ?? []) {
      const k = h.kind + "|" + h.key;
      let eps = byKey.get(k);
      if (!eps) byKey.set(k, (eps = []));
      const cur = eps[eps.length - 1];
      if (cur && h.day - cur[cur.length - 1]!.day <= EPISODE_GAP_DAYS) cur.push(h);
      else eps.push([h]);
    }
  }
  const out: Signal[] = [];
  for (const [k, eps] of byKey) {
    for (const ep of eps) {
      const latest = ep[ep.length - 1]!;
      const firstDate = isoOf(c.ix.day0 + ep[0]!.day);
      out.push({
        ...latest.signal,
        id: k + "|" + firstDate,
        kind: latest.kind,
        severity: ep.some((h) => h.severity === "high") ? "high" : latest.severity,
        firstDate,
        lastDate: isoOf(c.ix.day0 + latest.day),
      });
    }
  }
  return out;
}

/** Calendar-quarter shares (first isolates, hospital-wide) behind a trend, up to `last`. */
function trendSeries(ix: Index, s: Signal, last: number): { period: IsoDate; share: Share }[] {
  const os = ix.osIds.get(s.organism + "\u0000" + s.specimen);
  const a = ix.abxIds.get(s.antibiotic ?? "");
  const h = os === undefined || a === undefined ? undefined : ix.osAbx[os]![a];
  if (!h) return [];
  const series: { period: IsoDate; share: Share }[] = [];
  const start = new Date(ix.day0 * DAY_MS);
  let y = start.getUTCFullYear();
  let q = Math.floor(start.getUTCMonth() / 3);
  for (;;) {
    const from = Math.floor(Date.UTC(y, q * 3, 1) / DAY_MS) - ix.day0;
    if (from > last) break;
    const to = Math.min(last, Math.floor(Date.UTC(y, q * 3 + 3, 1) / DAY_MS) - ix.day0 - 1);
    const n = h.n.sum(from, to);
    const r = h.r.sum(from, to);
    series.push({ period: isoOf(ix.day0 + from), share: { works: n - r, n } });
    if (++q === 4) {
      q = 0;
      y++;
    }
  }
  return series;
}

const SEVERITY_RANK: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

/** Every signal episode known on `asOf`, from results sampled on or before it; most severe first, then newest. */
export function detectSignals(
  results: readonly Result[],
  asOf: IsoDate,
  _catalog: Catalog,
  options: Partial<SignalOptions> = {},
): Signal[] {
  const opts: SignalOptions = { ...DEFAULT_SIGNALS, ...options };
  if (results.length === 0) return [];
  const c = prepare(results, opts);
  const ix = c.ix;
  // Days after the last result are evaluated too (a unit that went quiet is news).
  const last = dayNum(asOf) - ix.day0;
  if (last < 0) return [];
  for (let d = c.computed; d <= last; d++) c.dayHits[d] = hitsForDay(ix, d, opts);
  c.computed = Math.max(c.computed, last + 1);

  const all = [...episodesFromHits(c, last), ...sentinelEpisodes(ix, last, opts)];
  for (const s of all) if (s.kind === "trend") s.series = trendSeries(ix, s, last);
  return all.sort(
    (a, b) =>
      SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
      (a.lastDate < b.lastDate ? 1 : a.lastDate > b.lastDate ? -1 : 0) ||
      (a.firstDate < b.firstDate ? 1 : a.firstDate > b.firstDate ? -1 : 0) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}

/** Forget cached work (tests and benchmarks; the app never needs it). */
export function resetSignalCache(): void {
  cache = null;
}
