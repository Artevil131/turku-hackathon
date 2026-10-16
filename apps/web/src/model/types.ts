import type { Antibiotic, IsoDate, Unit } from "../feed/types.ts";

// Shapes the screens share. The analysis behind them lives in libs/utils and
// on the server (/api/alerts, /api/coverage); these are only the view models
// the screens render.

/** The code lists the screens need from FeedMeta. */
export interface Catalog {
  units: Unit[];
  antibiotics: Antibiotic[];
}

export type AgeBand = "under65" | "65plus";

/** hospital = sampled on day 3 of the stay or later (inpatients with an admission date); community = otherwise. */
export type Onset = "community" | "hospital";

/** WHO AWaRe group of an antibiotic, when known: access = first choice, watch = use with care, reserve = last resort. */
export type AwareGroup = "access" | "watch" | "reserve";

/** A report or ask query. "all" as ward = every unit. */
export interface PatientQuery {
  ward: string;
  specimen: string;
  sex?: string;
  age?: AgeBand;
  onset?: Onset;
  organism?: string;
}

/** Of `n` first isolates with a known result, `works` were susceptible. */
export interface Share {
  works: number;
  n: number;
}

export interface LikelyOrganism {
  organism: string;
  share: number; // 0-1
  n: number;
}

export interface MonthPoint {
  /** First day of the month. */
  month: IsoDate;
  share: Share;
}

// ---------- Signals: the server's alerts as the screens show them ----------

/**
 * sentinel  a single dangerous result: CPE (D-014), or MRSA/VRE new on an inpatient unit (D-021)
 * surge     more patients with a resistance flag on a unit than its own history predicts (phenotype excess, D-020)
 * cluster   several patients on one unit with the same organism and resistance profile (profile excess, D-020)
 * data-gap  far fewer cultures from a unit than usual, or a run of empty days (sampling drop, empty run, D-031)
 * shift     no server detector raises this (D-032); kept so the copy for it stays typed
 * trend     resistance to an antibiotic rising hospital-wide over months (rising trend, D-020, D-022)
 */
export type SignalKind = "sentinel" | "surge" | "cluster" | "data-gap" | "shift" | "trend";

export type Severity = "high" | "medium" | "low";

/** Which server rule raised the alert (libs/utils/alerts kind, or the detector's name). */
export type SignalSource = "cpe" | "new-in-unit" | "profile-excess" | "phenotype-excess" | "sampling-drop" | "empty-run" | "rising-trend";

export interface Signal {
  /** The server alert's id (for an incident: its first alert's id, which is also the incident id). */
  id: string;
  kind: SignalKind;
  source: SignalSource;
  severity: Severity;
  /** The day the first alert of the incident was raised. */
  firstDate: IsoDate;
  /** The day of the incident's latest alert. */
  lastDate: IsoDate;
  /** null = hospital-wide. */
  ward: string | null;
  organism?: string;
  antibiotic?: string;
  phenotype?: string;
  specimen?: string;
  /** cluster: antibiotics the isolates resist (their shared profile). */
  resists?: string[];
  /** Distinct patients (sentinel, surge, cluster), cultures (data-gap) or the share resistant (trend). */
  observed: number;
  /** What history predicts for the same window. */
  expected?: number;
  /** The test's p-value, when a test was used. */
  p?: number;
  patients?: number;
  /** Days the observed count covers (surge, cluster, data-gap). */
  windowDays?: number;
  /** Isolates behind it, for "see cases" (empty for data-gap and trend). */
  isolateIds: string[];
  /** Later alerts of the same incident (D-034), oldest first. */
  related: Signal[];
  /** shift / trend: the shares compared (the server sends none; kept for the shared copy). */
  recent?: Share;
  baseline?: Share;
  series?: { period: IsoDate; share: Share }[];
}
