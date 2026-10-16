import type { CoverageResult, MonthPoint, PatientQuery, Rank, ReportMatrix, ReportTable } from "@aei/empiric";
import type { IsoDate, Result } from "@aei/feed";
import type { Catalog } from "@aei/isolates";
import type { Signal } from "@aei/signals";

/*
  The one door between the screens and the engines (@aei/empiric,
  @aei/signals). An AnalyticsSource answers every question a screen asks of
  them; local.ts answers in this browser, remote.ts asks the server. Every
  answer is exactly a gear type, so a server answers by running the same
  gears over its own copy of the same feed.
*/

/** "local" runs the gears in this browser (default); "remote" asks the server (/api/analytics/...). */
export type AnalyticsMode = "local" | "remote";

/** Where the analysis runs, as the Settings screen says it. */
export type AnalyticsWhere = "browser" | "server";

/** The doctor's ranking preference (Settings): the gear's own type. */
export type { Rank };

/**
 * The data an answer is computed from: the results released up to `asOf`.
 * `results` is the browser's copy (useFeed); a remote source ignores it and
 * the server uses its own copy of the same feed up to `asOf`.
 */
export interface Released {
  results: readonly Result[];
  asOf: IsoDate;
  catalog: Catalog;
}

/** Answers computed at once, in this browser (only a local source has them). */
export interface SyncAnalytics {
  coverage(at: Released, query: PatientQuery, rank: Rank): CoverageResult;
  monthly(at: Released, query: PatientQuery, antibiotic: string, months: number): MonthPoint[];
  reportTable(at: Released, query: PatientQuery): ReportTable;
  reportMatrix(at: Released, query: PatientQuery, days: number): ReportMatrix;
}

export interface AnalyticsSource {
  readonly where: AnalyticsWhere;
  /** The coverage list for patients like this one (@aei/empiric coverage(), default options with this ranking). */
  coverage(at: Released, query: PatientQuery, rank: Rank): Promise<CoverageResult>;
  /** One antibiotic's share in each of the last `months` calendar months, oldest first (@aei/empiric monthly()). */
  monthly(at: Released, query: PatientQuery, antibiotic: string, months: number): Promise<MonthPoint[]>;
  /**
   * Every signal detected up to `asOf` (@aei/signals detectSignals()), not yet
   * cut to `asOf` (the hook applies visibleSignals). `generation` is the feed
   * generation (useFeed): it changes when the results were reloaded.
   */
  signals(at: Released, generation: number): Promise<Signal[]>;
  /** The report's antibiotics table for exactly this query (@aei/empiric reportTable()). */
  reportTable(at: Released, query: PatientQuery): Promise<ReportTable>;
  /** The report's unit comparison over `days` (@aei/empiric reportMatrix(); query.ward is ignored). */
  reportMatrix(at: Released, query: PatientQuery, days: number): Promise<ReportMatrix>;
  /**
   * Present when answers can be computed at once in this browser: the hooks
   * then compute during render (as the screens always did), so no screen
   * shows an empty frame. Absent for a server.
   */
  readonly sync?: SyncAnalytics;
}

/** A request a newer one replaced before it ran; the hooks ignore it. */
export class Superseded extends Error {
  constructor() {
    super("superseded by a newer request");
    this.name = "Superseded";
  }
}
