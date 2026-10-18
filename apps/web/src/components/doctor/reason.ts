import type { CoverageResponse } from "@aei/contract";
import { standingOf } from "@aei/coverage";
import type { IsoDate, Phenotype } from "@aei/domain";
import { type Locale, type MessageKey, specimenName, t } from "@aei/i18n";
import { type Basis, barOf, type DoctorFilters, dmy, num, pct, type Row, rowN } from "./filters.ts";

/** What the coverage list shows for each standing: glyph, one word, and the full phrase for `title`. */
export const STANDING: Record<Row["standing"], { glyph: string; short: MessageKey; long: MessageKey }> = {
  clears: { glyph: "✓", short: "drStandingClearsShort", long: "drStandingClears" },
  borderline: { glyph: "≈", short: "drStandingBorderlineShort", long: "drStandingBorderline" },
  below: { glyph: "✕", short: "drStandingBelowShort", long: "drStandingBelow" },
  "not assessable": { glyph: "–", short: "drNAShort", long: "drStandingNA" },
};

const LEVEL_KEYS = {
  unit: "drLevelUnitShort",
  "ward type": "drLevelWardTypeShort",
  hospital: "drLevelHospitalShort",
} as const;

export const levelKey = (level: keyof typeof LEVEL_KEYS): MessageKey => LEVEL_KEYS[level];

/** The sentence that says why a row stands where it does ("clears the 80 % bar on …", "moved down because …"). */
export function reasonOf(locale: Locale, row: Row, data: CoverageResponse, filters: DoctorFilters): string {
  const bar = barOf(data, filters);
  const lo = row.interval ? pct(row.interval[0]) : 0;
  const hi = row.interval ? pct(row.interval[1]) : 0;
  if (row.standing === "clears") {
    return t(locale, "drReasonClears", {
      bar,
      n: num(locale, rowN(row)),
      specimen: specimenName(locale, filters.site).toLowerCase(),
      level: t(locale, LEVEL_KEYS[data.coverage.level]),
      from: dmy(data.coverage.from),
    });
  }
  if (row.standing === "borderline") return t(locale, "drReasonBorderline", { lo, hi, bar });
  if (row.standing === "below") return t(locale, "drReasonBelow", { share: pct(row.share ?? 0), bar });
  const untested = row.coverage.untested.reduce((s, u) => s + u.share, 0);
  return row.share === null ? t(locale, "drNaFew") : t(locale, "drNaUntested", { pct: pct(untested) });
}

/** The muted 28-day text: counts always, the percentage only from 30 known results, an em dash without data. */
export function recentText(locale: Locale, recent: Item["recent"]): string {
  if (!recent) return t(locale, "drRecentNone");
  const base = { covered: num(locale, recent.covered), known: num(locale, recent.known) };
  return recent.known >= 30 ? t(locale, "drRecentPct", { ...base, pct: pct(recent.covered / recent.known) }) : t(locale, "drRecent", base);
}

/** Organisms a row leaves out, only the ones that are a real share of the pool. */
export function flagsOf(row: Row) {
  const notCovering = row.coverage.notCovering.filter((o) => o.share >= 0.05);
  const untested = row.standing === "not assessable" ? [] : row.coverage.untested.filter((o) => o.share >= 0.05);
  const outside = row.coverage.outsideSpectrum.filter((o) => o.share >= 0.05);
  return { notCovering, untested, outside };
}

/** One line of the list, a single antibiotic or a pair, in the shape the forest plot, details and print share. */
export interface Item {
  id: string;
  name: string;
  standing: Row["standing"];
  share: number | null;
  interval: [number, number] | null;
  n: number;
  row: Row | null;
  pair: CoverageResponse["combinationSuggestions"][number] | null;
  /** The patient's finding that makes this antibiotic inferred resistant (D-050); absent without a patient. */
  prior?: Prior | null;
  /** The unit's last 28 days, all organisms, as context (D-023); absent for combinations. */
  recent?: { covered: number; known: number } | null;
}

/** A patient's finding as a row carries it: the phenotype and the date of its newest isolate. */
export interface Prior {
  phenotype: Phenotype;
  date: IsoDate;
}

/**
 * The standing of a row on the basis its figure is shown on. The server judges a single antibiotic on one basis
 * (own spectrum for mild, everything for severe, D-027); when the doctor shows the other basis, the same rule
 * (`@aei/coverage` `standingOf`, D-026) is applied to that basis's share and interval, so the mark never contradicts
 * the figure beside it. A combination has only the all-organism basis and keeps the server's standing.
 */
export function standingOn(item: Item, view: Basis, bar: number): Item["standing"] {
  const row = item.row;
  if (!row) return item.standing;
  const judged: Basis = row.basis === "spectrum" ? "own" : "all";
  if (view === judged) return item.standing;
  const c = view === "own" ? row.coverage.spectrum : row.coverage;
  const untested = row.coverage.untested.reduce((s, u) => s + u.share, 0);
  return standingOf(c.share, c.interval, untested, bar / 100);
}

/**
 * Nothing to judge for this case: no isolates in the pool, no rows, or every row not assessable for want of results
 * (fewer than 30 at every level), which is what the empty-state sentence says.
 */
export function nothingAssessable(items: readonly Item[], isolates?: number): boolean {
  return isolates === 0 || items.length === 0 || items.every((i) => i.standing === "not assessable" && i.share === null);
}
