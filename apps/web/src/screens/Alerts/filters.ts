import type { IsoDate } from "../../feed/types.ts";
import { addDays } from "../../model/dates.ts";
import type { Severity, Signal, SignalKind } from "../../model/types.ts";

// Which alerts the screen lists, and in what order. Pure, so the shell (e.g.
// the Alerts tab badge) and tests can use the same rules as the screen.

/** An alert is "active" while it signalled within this many days of the as-of date. */
export const ACTIVE_DAYS = 28;

export const SEVERITIES: readonly Severity[] = ["high", "medium", "low"];
/** Every kind the engine can raise, in the order the filter lists them. */
export const KINDS: readonly SignalKind[] = ["sentinel", "surge", "cluster", "data-gap", "shift", "trend"];

export type Period = "active" | "all";

export interface AlertFilters {
  period: Period;
  severities: Severity[];
  kind: SignalKind | null;
  /** Unit code; null = all units (hospital-wide alerts included). */
  unit: string | null;
}

export const DEFAULT_FILTERS: AlertFilters = { period: "active", severities: ["high", "medium"], kind: null, unit: null };

/** Signalled within the last ACTIVE_DAYS days (as-of day included). */
export function isActive(s: Signal, asOf: IsoDate): boolean {
  return s.lastDate > addDays(asOf, -ACTIVE_DAYS);
}

/** Does `s` pass the filters? `ignore` leaves one filter out (for the counts next to each choice). */
export function passes(s: Signal, f: AlertFilters, asOf: IsoDate, ignore?: "period" | "severity" | "kind" | "unit"): boolean {
  if (ignore !== "period" && f.period === "active" && !isActive(s, asOf)) return false;
  if (ignore !== "severity" && !f.severities.includes(s.severity)) return false;
  if (ignore !== "kind" && f.kind !== null && s.kind !== f.kind) return false;
  if (ignore !== "unit" && f.unit !== null && s.ward !== f.unit) return false;
  return true;
}

const RANK: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

/**
 * Active alerts before earlier ones, then most severe first, then the newest
 * episode first. Episode start dates never move, so a list stays in place as
 * days pass, and a new alert lands at the top of its severity.
 */
export function sortAlerts(list: readonly Signal[], asOf: IsoDate): Signal[] {
  return [...list].sort((a, b) => {
    const act = Number(isActive(b, asOf)) - Number(isActive(a, asOf));
    if (act) return act;
    const sev = RANK[a.severity] - RANK[b.severity];
    if (sev) return sev;
    if (a.firstDate !== b.firstDate) return a.firstDate < b.firstDate ? 1 : -1;
    if (a.lastDate !== b.lastDate) return a.lastDate < b.lastDate ? 1 : -1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/** Filters changed as little as possible so that `s` is listed (used when another screen opens an alert). */
export function reveal(f: AlertFilters, s: Signal, asOf: IsoDate): AlertFilters {
  return {
    period: f.period === "active" && !isActive(s, asOf) ? "all" : f.period,
    severities: f.severities.includes(s.severity) ? f.severities : [...f.severities, s.severity],
    kind: f.kind === null || f.kind === s.kind ? f.kind : null,
    unit: f.unit === null || f.unit === s.ward ? f.unit : null,
  };
}

/** Unseen alerts worth a badge: active, high or medium, not yet marked seen. */
export function unseenActive(signals: readonly Signal[], asOf: IsoDate, seen: ReadonlySet<string>): Signal[] {
  return signals.filter((s) => s.severity !== "low" && isActive(s, asOf) && !seen.has(s.id));
}
