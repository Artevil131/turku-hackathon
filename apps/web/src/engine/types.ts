import type { Antibiotic, IsoDate, Unit } from "../feed/types.ts";

// Shapes shared by the engine (pure functions over released results) and the
// screens. Everything is computed from the feed; nothing is assumed about which
// units, organisms or antibiotics exist.

/** The code lists the engine needs from FeedMeta. */
export interface Catalog {
  units: Unit[];
  antibiotics: Antibiotic[];
}

// ---------- Coverage: "what has worked lately for patients like this one?" ----------

export type AgeBand = "under65" | "65plus";

/** hospital = sampled on day 3 of the stay or later (inpatients with an admission date); community = otherwise. */
export type Onset = "community" | "hospital";

/** WHO AWaRe group of an antibiotic, when known: access = first choice, watch = use with care, reserve = last resort. */
export type AwareGroup = "access" | "watch" | "reserve";

export interface PatientQuery {
  ward: string;
  specimen: string;
  sex?: string;
  age?: AgeBand;
  onset?: Onset;
  /** Set only once the lab has named the organism. */
  organism?: string;
}

/** Of `n` first isolates, `works` were susceptible. */
export interface Share {
  works: number;
  n: number;
}

export interface DrugFigure {
  antibiotic: string;
  aware: AwareGroup | null;
  /** The figure the screen leads with (from basis.window). */
  main: Share;
  recent: Share;
  year: Share;
  /** Same query, every unit, year window. */
  hospitalYear: Share;
  /** Percentage points, recent minus year, when both reach minIsolates; else null. */
  change: number | null;
}

export type Widening = "age" | "sex" | "onset" | "ward";

export interface Basis {
  /** The query actually used, after widening. */
  query: PatientQuery;
  /** Filters dropped, in order, to reach minIsolates. */
  widened: Widening[];
  window: "recent" | "year";
  n: number;
  recentN: number;
  yearN: number;
  enough: boolean;
}

export interface TopReason {
  /** access-preferred: a first-choice antibiotic was put first although a stronger one exists. */
  kind: "highest" | "access-preferred";
  /** The antibiotic with the highest share, when it is not the top match. */
  strongest?: string;
  strongestShare?: Share;
}

export interface LikelyOrganism {
  organism: string;
  share: number; // 0-1
  n: number;
}

export interface CoverageResult {
  asOf: IsoDate;
  basis: Basis;
  /** Ranked; drugs[0] is the top match. Treatments for this specimen only. */
  drugs: DrugFigure[];
  topReason: TopReason | null;
  /** Organisms behind this infection here, most common first. */
  organisms: LikelyOrganism[];
}

export interface CoverageOptions {
  /** The organiser's floor: no percentage from fewer first isolates. */
  minIsolates: number;
  recentDays: number;
  yearDays: number;
  /** access-first: an Access antibiotic within accessMargin points of the best goes first. */
  rank: "access-first" | "coverage";
  accessMargin: number;
}

export interface MonthPoint {
  /** First day of the month. */
  month: IsoDate;
  share: Share;
}

// ---------- Signals: deviations that come to the user ----------

/**
 * sentinel  a rare, dangerous resistance (e.g. CPE, VRE) or the first of a flag on a unit in a long time
 * surge     more isolates with a resistance flag on a unit than its own history predicts
 * cluster   several patients on one unit with the same organism and the same resistance profile, more than expected
 * data-gap  far fewer results from a unit than usual (a feed or sampling problem, not epidemiology)
 * shift     an antibiotic works clearly less often on a unit in the last weeks than in its past year
 * trend     resistance to an antibiotic rising hospital-wide over months
 */
export type SignalKind = "sentinel" | "surge" | "cluster" | "data-gap" | "shift" | "trend";

export type Severity = "high" | "medium" | "low";

export interface Signal {
  /** Stable for one episode as days pass. */
  id: string;
  kind: SignalKind;
  severity: Severity;
  /** First day the data showed it. */
  firstDate: IsoDate;
  /** Last day it signalled (never after the as-of date it was computed for). */
  lastDate: IsoDate;
  /** null = hospital-wide. */
  ward: string | null;
  organism?: string;
  antibiotic?: string;
  phenotype?: string;
  specimen?: string;
  /** cluster: antibiotics the isolates resist (their shared profile). */
  resists?: string[];
  /** Distinct patients (sentinel, surge, cluster), results (data-gap), or percent resistant (shift, trend). */
  observed: number;
  /** What history predicts for the same window. */
  expected?: number;
  /** The test's p-value, when a test was used. */
  p?: number;
  patients?: number;
  /** Isolates behind it, for "see cases" (empty for data-gap and trend). */
  isolateIds: string[];
  /** shift / trend: the shares compared. */
  recent?: Share;
  baseline?: Share;
  /** trend: the series behind it (e.g. 12 rolling months or calendar years). */
  series?: { period: IsoDate; share: Share }[];
}

export interface SignalOptions {
  /** Days a unit's history must cover before its own baseline is trusted. */
  minHistoryDays: number;
  /** Flags that are alarming whenever they appear (lower case). */
  sentinelPhenotypes: string[];
}
