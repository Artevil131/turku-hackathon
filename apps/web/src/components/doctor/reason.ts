import type { CoverageResponse } from "@aei/contract";
import { type Locale, type MessageKey, specimenName, t } from "@aei/i18n";
import { BAR, type DoctorFilters, dmy, num, pct, type Row, rowN } from "./filters.ts";

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
  const bar = BAR[filters.sev];
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
}
