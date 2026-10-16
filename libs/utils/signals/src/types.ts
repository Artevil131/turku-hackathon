import type { IsoDate } from "@aei/feed";
import type { Share } from "@aei/isolates";

// Signals: deviations that come to the user. Every key (unit, organism,
// antibiotic, flag) comes from the results; nothing here names one.

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
