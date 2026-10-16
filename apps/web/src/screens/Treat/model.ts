import type { FeedMeta, IsoDate, Unit } from "../../feed/types.ts";
import type { AgeBand, Onset, PatientQuery, Severity, Share, Signal } from "../../engine/types.ts";
import { daysBetween } from "../../engine/dates.ts";

// Pure helpers for the Treat screen: prefs -> engine query, which signals the
// doctor sees, how units group. Nothing here knows any unit, organism or
// antibiotic by name; everything is read from the feed meta and the results.

/** The doctor's choices (the shape App keeps and remembers). */
export interface TreatChoice {
  ward: string;
  specimen: string;
  sex: string | null;
  age: AgeBand | null;
  onset: Onset | null;
  organism: string | null;
}

/** Signals older than this (days since they last fired) are not shown on the doctor's screen. */
export const SIGNAL_DAYS = 14;
/** Signal lines shown before "+N more". */
export const SIGNAL_LINES = 2;
/** At or above this share an antibiotic reads as "worked often"; below it the row is drawn weaker. */
export const STRONG_SHARE = 0.8;
/** Likely-organism chips shown before "Other". */
export const ORGANISM_CHIPS = 4;

/** "Caught in hospital" only means something on a unit where patients stay (admission dates exist). */
export function onsetApplies(meta: FeedMeta, ward: string): boolean {
  return meta.units.find((u) => u.code === ward)?.type === "in";
}

/** The engine query for the doctor's choices. Onset is ignored on units without admissions. */
export function queryOf(meta: FeedMeta, p: TreatChoice): PatientQuery {
  const q: PatientQuery = { ward: p.ward, specimen: p.specimen };
  if (p.sex) q.sex = p.sex;
  if (p.age) q.age = p.age;
  if (p.onset && onsetApplies(meta, p.ward)) q.onset = p.onset;
  if (p.organism) q.organism = p.organism;
  return q;
}

/** True when any patient detail beyond unit and site is set. */
export function hasDetails(p: TreatChoice): boolean {
  return p.sex !== null || p.age !== null || p.onset !== null || p.organism !== null;
}

const SEVERITY_RANK: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

/**
 * Signals for the doctor: on their unit, plus whole-hospital ones that are
 * high or concern the chosen infection site; last fired within `days` of
 * asOf. Most severe first, then the unit's own, then most recent.
 */
export function signalsFor(
  signals: readonly Signal[],
  ward: string,
  specimen: string,
  asOf: IsoDate,
  days: number = SIGNAL_DAYS,
): Signal[] {
  return signals
    .filter((s) => {
      const age = daysBetween(s.lastDate, asOf);
      if (age < 0 || age > days) return false;
      if (s.ward === ward) return true;
      return s.ward === null && (s.severity === "high" || (s.specimen !== undefined && s.specimen === specimen));
    })
    .sort(
      (a, b) =>
        SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
        Number(b.ward === ward) - Number(a.ward === ward) ||
        (a.lastDate < b.lastDate ? 1 : a.lastDate > b.lastDate ? -1 : 0) ||
        (a.firstDate < b.firstDate ? 1 : a.firstDate > b.firstDate ? -1 : 0) ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );
}

/** Units grouped by institution, in the order the feed lists them. */
export function unitGroups(units: readonly Unit[]): { institution: string; units: Unit[] }[] {
  const groups: { institution: string; units: Unit[] }[] = [];
  for (const u of units) {
    let g = groups.find((x) => x.institution === u.institution);
    if (!g) {
      g = { institution: u.institution, units: [] };
      groups.push(g);
    }
    g.units.push(u);
  }
  return groups;
}

/** "primary_care" -> "Primary care": a readable fallback for an institution code with no copy. */
export function humanize(code: string): string {
  const s = code.replace(/[_-]+/g, " ").trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : code;
}

/** Sex codes present in the results, sorted (the feed decides which exist). */
export function sexesIn(results: readonly { sex: string }[]): string[] {
  const set = new Set<string>();
  for (const r of results) if (r.sex) set.add(r.sex);
  return [...set].sort();
}

/** A share as 0-1 when it rests on at least `min`; otherwise null (no percentage from fewer). */
export function reliable(share: Share, min: number): number | null {
  return share.n >= min && share.n > 0 ? share.works / share.n : null;
}

/** "Urine" at the start of a label; leaves names that are all capitals or start with one alone. */
export function capFirst(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** A feed name inside a sentence: "Urine" -> "urine", but "CSF" or "E. coli" stay as written. */
export function midSentence(s: string): string {
  if (s.length < 2) return s;
  const second = s.charAt(1);
  return second === second.toLowerCase() && second !== second.toUpperCase() ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

/**
 * Antibiotics with an active "working less often" alert for this unit and
 * infection site (and this bacterium, when one is chosen): antibiotic code ->
 * the alert's id. Links the doctor's list to what infection control sees.
 */
export function fallingHere(signals: readonly Signal[], ward: string, specimen: string, organism: string | null): Map<string, string> {
  const out = new Map<string, string>();
  for (const s of signals) {
    if (s.kind !== "shift" || !s.antibiotic || s.ward !== ward || s.specimen !== specimen) continue;
    if (organism !== null && s.organism !== organism) continue;
    if (!out.has(s.antibiotic)) out.set(s.antibiotic, s.id);
  }
  return out;
}

/** At least this share of the window's isolates must have an answer before a figure goes without "rests on X of Y". */
export const COVER_NOTE_BELOW = 0.95;
/** Organisms named in "not tested for ..." before "+N more". */
export const COVER_NAMES = 2;

/** The isolates a figure leaves out, when they are enough to mention (else null). */
export function coverGap(d: { main: Share; isolates: number; untested: { organism: string; n: number }[] }): { known: number; total: number; names: string[]; more: number } | null {
  if (d.isolates <= 0 || d.untested.length === 0 || d.main.n >= COVER_NOTE_BELOW * d.isolates) return null;
  return {
    known: d.main.n,
    total: d.isolates,
    names: d.untested.slice(0, COVER_NAMES).map((u) => u.organism),
    more: Math.max(0, d.untested.length - COVER_NAMES),
  };
}
