import type { FeedMeta, IsoDate, Result } from "../../feed/types.ts";
import { addDays, fromDayNumber, toDayNumber, weekStart } from "../../model/dates.ts";
import type { Signal } from "../../model/types.ts";

/*
  Week-by-week numbers for the Timeline, from released results only.

    DailyStore      results bucketed per day (all units, per unit) and, per week,
                    the first isolate of each patient + organism + specimen.
                    Built once and extended in place when the results array only
                    grows (the app hands over a new array whose start is the old one).
    weekly(store, asOf)
                    the weekly view: nothing after `asOf` is counted. The week that
                    holds `asOf` is partial (`released` < 7) and is flagged as such.
    visibleSignals  signals known on `asOf`, never reaching past it.

  Nothing here knows which units exist: lanes come from FeedMeta, plus any unit
  code that appears in results without being in the meta.
*/

export interface DailyStore {
  meta: FeedMeta;
  /** Monday of the week that holds meta.start: day 0 of every array. */
  day0: number;
  /** Days covered, a whole number of weeks up to the week of meta.end. */
  days: number;
  weeks: number;
  total: Int32Array;
  byWard: Map<string, Int32Array>;
  /** Per week: first isolate per patient + organism + specimen -> (day, carries a resistance flag). */
  firsts: Map<string, { day: number; flagged: boolean }>[];
  /** Resistance flags seen, with how often (lower case, as the lab writes them). */
  phenotypes: Map<string, number>;
  /** Results ingested (a prefix of `source`). */
  n: number;
  source: readonly Result[] | null;
}

export function createStore(meta: FeedMeta): DailyStore {
  const day0 = toDayNumber(weekStart(meta.start));
  const lastDay = toDayNumber(meta.end);
  const weeks = Math.max(1, Math.floor((lastDay - day0) / 7) + 1);
  const days = weeks * 7;
  const byWard = new Map<string, Int32Array>();
  for (const u of meta.units) byWard.set(u.code, new Int32Array(days));
  return {
    meta,
    day0,
    days,
    weeks,
    total: new Int32Array(days),
    byWard,
    firsts: Array.from({ length: weeks }, () => new Map()),
    phenotypes: new Map(),
    n: 0,
    source: null,
  };
}

function ingestOne(s: DailyStore, r: Result): void {
  const d = toDayNumber(r.sampleDate) - s.day0;
  if (d < 0 || d >= s.days) return;
  s.total[d]!++;
  let ward = s.byWard.get(r.ward);
  if (!ward) {
    ward = new Int32Array(s.days);
    s.byWard.set(r.ward, ward);
  }
  ward[d]!++;
  const flagged = r.phenotypes.length > 0;
  for (const f of r.phenotypes) {
    const k = f.toLowerCase();
    s.phenotypes.set(k, (s.phenotypes.get(k) ?? 0) + 1);
  }
  const w = Math.floor(d / 7);
  const firsts = s.firsts[w]!;
  // The first isolate per patient, organism and specimen (the @aei/counting rule), here per week.
  const key = `${r.patientId}\u0000${r.organism}\u0000${r.specimen}`;
  const prev = firsts.get(key);
  if (!prev || d < prev.day) firsts.set(key, { day: d, flagged });
}

/** Extend `store` with `results` when they only add to what it holds; otherwise start again. */
export function updateStore(store: DailyStore | null, meta: FeedMeta, results: readonly Result[]): DailyStore {
  let s = store;
  const reusable =
    s !== null &&
    s.meta === meta &&
    s.source !== null &&
    results.length >= s.n &&
    (s.n === 0 || (results[0] === s.source[0] && results[s.n - 1] === s.source[s.n - 1]));
  if (!reusable || !s) s = createStore(meta);
  for (let i = s.n; i < results.length; i++) ingestOne(s, results[i]!);
  s.n = results.length;
  s.source = results;
  return s;
}

export interface WeekInfo {
  index: number;
  /** Monday. */
  start: IsoDate;
  /** Sunday. */
  end: IsoDate;
  /** Days of this week released so far (0 = all after asOf, 7 = complete). Days before meta.start count as released. */
  released: number;
}

export interface Lane {
  code: string;
  /** Results per week, up to asOf. */
  counts: number[];
  /** 0..1 darkness for the heat strip; the week's daily rate against the unit's own typical week. 0 = no results. */
  heat: number[];
  totalSoFar: number;
  /** Complete weeks with no result at all, from the unit's first result on. */
  emptyWeeks: number;
}

export interface WeeklyView {
  asOf: IsoDate;
  weeks: WeekInfo[];
  /** Index of the week holding asOf (-1 when asOf is before the feed). */
  nowWeek: number;
  /** Days from day0 to asOf, inclusive end: x of NOW is nowDay + 1. */
  nowDay: number;
  total: number[];
  /** Per week: first isolates and how many carry a resistance flag. */
  flag: { flagged: number; n: number }[];
  maxTotal: number;
  lanes: Lane[];
  totalSoFar: number;
  /** Resistance flags seen, most frequent first. */
  phenotypes: string[];
}

/** Lane order: the feed's units grouped by institution in the order they first appear, then unknown unit codes. */
export function laneOrder(meta: FeedMeta, extra: Iterable<string>): { institution: string | null; codes: string[] }[] {
  const groups: { institution: string | null; codes: string[] }[] = [];
  for (const u of meta.units) {
    let g = groups.find((x) => x.institution === u.institution);
    if (!g) {
      g = { institution: u.institution, codes: [] };
      groups.push(g);
    }
    g.codes.push(u.code);
  }
  const known = new Set(meta.units.map((u) => u.code));
  const others = [...new Set(extra)].filter((c) => !known.has(c)).sort();
  if (others.length) groups.push({ institution: null, codes: others });
  return groups;
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))));
  return sorted[i]!;
}

export function weekly(s: DailyStore, asOf: IsoDate, laneCodes: readonly string[]): WeeklyView {
  const nowDay = Math.min(s.days - 1, toDayNumber(asOf) - s.day0);
  const nowWeek = nowDay < 0 ? -1 : Math.floor(nowDay / 7);
  const weeks: WeekInfo[] = [];
  for (let w = 0; w < s.weeks; w++) {
    const start = fromDayNumber(s.day0 + w * 7);
    weeks.push({ index: w, start, end: addDays(start, 6), released: Math.max(0, Math.min(7, nowDay - w * 7 + 1)) });
  }

  const sumWeek = (arr: Int32Array, w: number): number => {
    const from = w * 7;
    const to = Math.min(from + 6, nowDay);
    let n = 0;
    for (let d = from; d <= to; d++) n += arr[d]!;
    return n;
  };

  const total: number[] = [];
  const flag: { flagged: number; n: number }[] = [];
  let maxTotal = 0;
  let totalSoFar = 0;
  for (let w = 0; w < s.weeks; w++) {
    if (w > nowWeek) {
      total.push(0);
      flag.push({ flagged: 0, n: 0 });
      continue;
    }
    const n = sumWeek(s.total, w);
    total.push(n);
    totalSoFar += n;
    if (n > maxTotal) maxTotal = n;
    let k = 0;
    let fl = 0;
    for (const v of s.firsts[w]!.values()) {
      if (v.day > nowDay) continue;
      k++;
      if (v.flagged) fl++;
    }
    flag.push({ flagged: fl, n: k });
  }

  const lanes: Lane[] = laneCodes.map((code) => {
    const arr = s.byWard.get(code);
    const counts: number[] = [];
    const rates: number[] = [];
    let first = -1;
    let laneTotal = 0;
    for (let w = 0; w < s.weeks; w++) {
      const n = w > nowWeek || !arr ? 0 : sumWeek(arr, w);
      counts.push(n);
      laneTotal += n;
      if (n > 0 && first < 0) first = w;
      // Typical week: complete weeks from the unit's first result on.
      if (first >= 0 && w < nowWeek) rates.push(n / 7);
    }
    const ref = quantile(
      rates.filter((r) => r > 0).sort((a, b) => a - b),
      0.9,
    );
    let emptyWeeks = 0;
    const heat = counts.map((n, w) => {
      const released = weeks[w]!.released;
      if (w > nowWeek || released === 0) return 0;
      if (n === 0) {
        if (first >= 0 && w >= first && released === 7) emptyWeeks++;
        return 0;
      }
      if (ref <= 0) return 1;
      return Math.min(1, n / released / ref);
    });
    return { code, counts, heat, totalSoFar: laneTotal, emptyWeeks };
  });

  const phenotypes = [...s.phenotypes.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(([k]) => k);
  return { asOf, weeks, nowWeek, nowDay, total, flag, maxTotal, lanes, totalSoFar, phenotypes };
}

/** Signals known on `asOf`: none that start after it, and none drawn past it. */
export function visibleSignals(signals: readonly Signal[], asOf: IsoDate): Signal[] {
  const out: Signal[] = [];
  for (const sig of signals) {
    if (sig.firstDate > asOf) continue;
    out.push(sig.lastDate > asOf ? { ...sig, lastDate: asOf } : sig);
  }
  return out;
}

export interface Packed {
  signal: Signal;
  x1: number;
  x2: number;
  track: number;
}

/**
 * Lay out signal segments in one lane: x from the first to the last day, at
 * least `minW` wide, never past `xMax` (NOW); overlapping ones go on separate tracks.
 */
export function packSegments(
  list: readonly Signal[],
  xOfDay: (iso: IsoDate, end: boolean) => number,
  minW: number,
  xMax: number,
  gap = 2,
): { items: Packed[]; tracks: number } {
  const sorted = [...list].sort((a, b) => (a.firstDate < b.firstDate ? -1 : a.firstDate > b.firstDate ? 1 : a.id < b.id ? -1 : 1));
  const trackEnds: number[] = [];
  const items: Packed[] = [];
  for (const signal of sorted) {
    let x1 = xOfDay(signal.firstDate, false);
    let x2 = Math.min(xMax, xOfDay(signal.lastDate, true));
    if (x2 - x1 < minW) {
      x2 = x1 + minW;
      if (x2 > xMax) {
        x2 = xMax;
        x1 = Math.max(0, xMax - minW);
      }
    }
    let track = trackEnds.findIndex((end) => end + gap <= x1);
    if (track < 0) {
      track = trackEnds.length;
      trackEnds.push(x2);
    } else trackEnds[track] = x2;
    items.push({ signal, x1, x2, track });
  }
  return { items, tracks: trackEnds.length };
}

/** Month of a date, as its first day. */
export const monthOf = (iso: IsoDate): IsoDate => `${iso.slice(0, 7)}-01`;

/** Signals grouped by the month they first showed, newest month first, newest first within a month. */
export function byMonth(signals: readonly Signal[]): { month: IsoDate; items: Signal[] }[] {
  const map = new Map<IsoDate, Signal[]>();
  for (const s of signals) {
    const m = monthOf(s.firstDate);
    const list = map.get(m);
    if (list) list.push(s);
    else map.set(m, [s]);
  }
  const rank = { high: 0, medium: 1, low: 2 } as const;
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([month, items]) => ({
      month,
      items: items.sort(
        (a, b) =>
          (a.firstDate < b.firstDate ? 1 : a.firstDate > b.firstDate ? -1 : 0) ||
          rank[a.severity] - rank[b.severity] ||
          (a.id < b.id ? -1 : 1),
      ),
    }));
}
