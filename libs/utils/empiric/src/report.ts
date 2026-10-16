import type { IsoDate, Result } from "@aei/feed";
import type { Catalog, Share } from "@aei/isolates";
import { coverage, DEFAULT_COVERAGE, EVERY_UNIT, MIN_KNOWN_SHARE, monthly, shareValue, treatmentsFor } from "./coverage.ts";
import type { AwareGroup, Cell, CoverageResult, DrugRow, MatrixRow, PatientQuery, ReportMatrix, ReportTable } from "./types.ts";

/*
  The report tables. Pure functions over the released results; every figure
  comes from coverage() and monthly(), so a report and the doctor's list count
  the same way (first isolate per patient, organism and specimen in the
  window; missing results handled by the EUCAST rule).

  A report shows the filters exactly as chosen. coverage() widens a thin query
  on its own (drops age, sex, then the unit) for the doctor's list; here
  minIsolates 0 turns that off, and the organiser's floor is applied when a
  figure is shown: no percentage from fewer than REPORT_MIN first isolates.
*/

/** The floor a report cell needs for a percentage. */
export const REPORT_MIN = DEFAULT_COVERAGE.minIsolates;
/** The report's short window (days, ending on asOf). */
export const REPORT_RECENT_DAYS = DEFAULT_COVERAGE.recentDays;
/** The report's long window (days, ending on asOf). */
export const REPORT_YEAR_DAYS = DEFAULT_COVERAGE.yearDays;
/** Calendar months in each antibiotics-table row's monthly series. */
export const REPORT_MONTHS = 12;

/** coverage() over one window of `days`, for exactly this query (no widening). */
export function windowCoverage(
  results: readonly Result[],
  asOf: IsoDate,
  query: PatientQuery,
  catalog: Catalog,
  days: number,
): CoverageResult {
  // One window (counted once), no widening, and no every-unit figure: the report computes that itself where it shows it.
  return coverage(results, asOf, query, catalog, { minIsolates: 0, recentDays: days, yearDays: days, withHospital: false });
}

export function cellFromShare(share: Share): Cell {
  if (share.n >= REPORT_MIN && share.n > 0) return { state: "ok", share };
  if (share.n > 0) return { state: "few", share };
  return { state: "none", share };
}

/**
 * The figure for one antibiotic in a window. coverage() leaves an antibiotic
 * out when it has no result in the window or (organism not known) when fewer
 * than half of the window's isolates have a known answer for it; below
 * 2 x REPORT_MIN isolates that also means fewer than REPORT_MIN answers, so it
 * reads "too few".
 */
export function cellOf(cov: CoverageResult, antibiotic: string, organismKnown: boolean): Cell {
  const d = cov.drugs.find((x) => x.antibiotic === antibiotic);
  if (d) return cellFromShare(d.main);
  const isolates = cov.basis.n;
  if (isolates === 0 || organismKnown) return { state: "none", share: null };
  if (isolates * MIN_KNOWN_SHARE < REPORT_MIN) return { state: "few", share: null };
  return { state: "rare", share: null };
}

/** 0-1 when the cell shows a percentage, else null. */
export function cellValue(cell: Cell): number | null {
  return cell.state === "ok" && cell.share ? shareValue(cell.share) : null;
}

/** Percentage points, short window minus long window, only when both show a percentage. */
export function changeOf(recent: Cell, year: Cell): number | null {
  const r = cellValue(recent);
  const y = cellValue(year);
  // `|| 0` turns a rounded -0 into 0.
  return r === null || y === null ? null : Math.round(100 * (r - y)) || 0;
}

/** The antibiotics table: the last 4 weeks next to the past 12 months (and every unit), per antibiotic, in the lab's order. */
export function reportTable(results: readonly Result[], asOf: IsoDate, query: PatientQuery, catalog: Catalog): ReportTable {
  const organismKnown = !!query.organism;
  const year = windowCoverage(results, asOf, query, catalog, REPORT_YEAR_DAYS);
  const recent = windowCoverage(results, asOf, query, catalog, REPORT_RECENT_DAYS);
  const everyUnit = query.ward === EVERY_UNIT;
  const hospital = everyUnit ? null : windowCoverage(results, asOf, { ...query, ward: EVERY_UNIT }, catalog, REPORT_YEAR_DAYS);
  const treatments = treatmentsFor(catalog, query.specimen);
  const order = new Map(treatments.map((a, i) => [a.code, i]));

  const rows: DrugRow[] = year.drugs.map((d) => {
    const r = cellOf(recent, d.antibiotic, organismKnown);
    const y = cellFromShare(d.main);
    return {
      code: d.antibiotic,
      aware: d.aware,
      order: order.get(d.antibiotic) ?? treatments.length,
      recent: r,
      year: y,
      hospital: hospital ? cellOf(hospital, d.antibiotic, organismKnown) : null,
      change: changeOf(r, y),
      months: monthly(results, asOf, query, d.antibiotic, REPORT_MONTHS, catalog),
    };
  });
  rows.sort((a, b) => a.order - b.order);
  const shown = new Set(rows.map((r) => r.code));

  return {
    asOf,
    query,
    recentN: recent.basis.n,
    yearN: year.basis.n,
    hospitalN: hospital ? hospital.basis.n : null,
    rows,
    hidden: treatments.filter((a) => !shown.has(a.code)).map((a) => a.code),
    organisms: year.organisms,
  };
}

/** Every unit side by side over one window of `days` (query.ward is ignored), plus the all-units row. */
export function reportMatrix(results: readonly Result[], asOf: IsoDate, query: PatientQuery, catalog: Catalog, days: number): ReportMatrix {
  const organismKnown = !!query.organism;
  const base: PatientQuery = { ...query, ward: EVERY_UNIT };
  const allCov = windowCoverage(results, asOf, base, catalog, days);
  const unitCovs = catalog.units.map((u) => ({
    ward: u.code,
    cov: windowCoverage(results, asOf, { ...base, ward: u.code }, catalog, days),
  }));
  const organisms = days === REPORT_YEAR_DAYS ? allCov.organisms : windowCoverage(results, asOf, base, catalog, REPORT_YEAR_DAYS).organisms;

  const used = new Map<string, AwareGroup | null>();
  for (const cov of [allCov, ...unitCovs.map((u) => u.cov)]) for (const d of cov.drugs) used.set(d.antibiotic, d.aware);
  const columns = treatmentsFor(catalog, query.specimen)
    .filter((a) => used.has(a.code))
    .map((a) => ({ code: a.code, aware: used.get(a.code) ?? null }));

  const rowOf = (ward: string, cov: CoverageResult): MatrixRow => ({
    ward,
    n: cov.basis.n,
    cells: Object.fromEntries(columns.map((c) => [c.code, cellOf(cov, c.code, organismKnown)])),
  });

  return {
    asOf,
    days,
    columns,
    rows: unitCovs.map((u) => rowOf(u.ward, u.cov)),
    all: rowOf(EVERY_UNIT, allCov),
    organisms,
  };
}
