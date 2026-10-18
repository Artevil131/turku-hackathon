import { proportionDifference } from "@aei/compare";
import type { AeiClient, CoverageQuery, CoverageResponse, Level } from "@aei/contract";

// Two timeframes against each other, per antibiotic (D-082). The default is the last 28 days against the 337 days
// before them; any pair of dates is allowed, and a pair that overlaps is shown but never marked.

export interface Frame {
  from: string;
  to: string;
}
/** A preset's length in days: the last four weeks, 90 days or the whole year (which has nothing before it to compare with). */
export const YEAR_DAYS = 365;

const DAY_MS = 86_400_000;
const parse = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
export const addDays = (iso: string, days: number): string => new Date(parse(iso) + days * DAY_MS).toISOString().slice(0, 10);
export const daysIn = (f: Frame): number => Math.round((parse(f.to) - parse(f.from)) / DAY_MS) + 1;
export const validFrame = (f: Frame): boolean => /^\d{4}-\d{2}-\d{2}$/.test(f.from) && /^\d{4}-\d{2}-\d{2}$/.test(f.to) && f.from <= f.to;
export const overlaps = (a: Frame, b: Frame): boolean => a.from <= b.to && b.from <= a.to;

/** The last `days` days up to `asOf` (A) and the rest of the year before them (B); B is null for the whole year. */
export function presetFrames(asOf: string, days: number): { a: Frame; b: Frame | null } {
  const a = { from: addDays(asOf, 1 - days), to: asOf };
  if (days >= YEAR_DAYS) return { a, b: null };
  return { a, b: { from: addDays(a.from, days - YEAR_DAYS), to: addDays(a.from, -1) } };
}

export interface Compared {
  a: CoverageResponse;
  b: CoverageResponse;
  /** The one level both frames were read at: what the shorter frame needed to reach 30 known results. */
  level: Level;
}

/**
 * Two coverage calls with the same filters. The shorter frame is asked first and picks the level; the longer one is
 * then forced to it, so both numbers are about the same patients.
 */
export async function fetchCompare(client: Pick<AeiClient, "coverage">, query: CoverageQuery, a: Frame, b: Frame): Promise<Compared> {
  const ask = (f: Frame, level?: Level) => client.coverage({ ...query, asOf: f.to, windowDays: daysIn(f), ...(level ? { level } : {}) });
  if (daysIn(a) <= daysIn(b)) {
    const first = await ask(a);
    const level = first.coverage.level;
    return { a: first, b: await ask(b, level), level };
  }
  const first = await ask(b);
  const level = first.coverage.level;
  return { a: await ask(a, level), b: first, level };
}

export interface CompareRow {
  antibiotic: string;
  a: { covered: number; known: number };
  b: { covered: number; known: number };
  /** A minus B, in share points (0 to 1); null when either frame has no known result. */
  diff: number | null;
  interval: [number, number] | null;
  /** The interval excludes zero and the frames do not overlap. */
  marked: boolean;
}

/** Per antibiotic of A's list, both frames' covered counts and the difference of their shares (Newcombe interval, D-074). */
export function compareRows(a: CoverageResponse, b: CoverageResponse, independent: boolean): CompareRow[] {
  const rows: CompareRow[] = [];
  for (const s of a.suggestions) {
    const other = b.suggestions.find((x) => x.antibiotic === s.antibiotic);
    if (!other) continue;
    const ca = s.coverage.counts;
    const cb = other.coverage.counts;
    // proportionDifference(B, A) gives A minus B.
    const d = proportionDifference(cb.covered, cb.known, ca.covered, ca.known);
    const ok = Number.isFinite(d.diff);
    rows.push({
      antibiotic: s.antibiotic,
      a: { covered: ca.covered, known: ca.known },
      b: { covered: cb.covered, known: cb.known },
      diff: ok ? d.diff : null,
      interval: ok ? [d.interval.lo, d.interval.hi] : null,
      marked: ok && independent && (d.interval.lo > 0 || d.interval.hi < 0),
    });
  }
  // Marked rows first, the biggest change on top; the rest keep the list's order.
  return rows
    .map((r, i) => ({ r, i }))
    .sort((x, y) => Number(y.r.marked) - Number(x.r.marked) || (x.r.marked ? Math.abs(y.r.diff ?? 0) - Math.abs(x.r.diff ?? 0) : x.i - y.i))
    .map((x) => x.r);
}
