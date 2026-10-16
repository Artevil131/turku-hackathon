import { coverage, DEFAULT_COVERAGE, EVERY_UNIT, MIN_KNOWN_SHARE, monthly, shareValue, treatmentsFor } from "../../engine/coverage.ts";
import { addDays } from "../../engine/dates.ts";
import type { AwareGroup, Catalog, CoverageResult, LikelyOrganism, MonthPoint, PatientQuery, Share } from "../../engine/types.ts";
import type { IsoDate, Result } from "../../feed/types.ts";

/*
  The report's numbers. Pure functions over the released results; every
  figure comes from engine/coverage.ts, so the report and the Treat screen
  count the same way (first isolate per patient, organism and specimen in the
  window; missing results handled by the engine's EUCAST rule).

  A report shows the filters exactly as chosen. coverage() widens a thin
  query on its own (drops age, sex, then the unit) for the doctor's screen;
  here minIsolates 0 turns that off, and the organiser's floor is applied
  when a figure is shown: no percentage from fewer than MIN first isolates.
*/

export const MIN = DEFAULT_COVERAGE.minIsolates;
export const RECENT_DAYS = DEFAULT_COVERAGE.recentDays;
export const YEAR_DAYS = DEFAULT_COVERAGE.yearDays;
export const MONTHS = 12;

/** How one figure can be shown. */
export type CellState =
  | "ok" // a percentage: at least MIN first isolates with a known answer
  | "few" // fewer than MIN (share given when the engine returned one; else fewer than MIN for sure)
  | "rare" // enough isolates, but the antibiotic was tested in fewer than half of them (engine rule)
  | "none"; // no isolates in the window, or none with a result for this antibiotic

export interface Cell {
  state: CellState;
  /** The engine's figure, when it returned one for this antibiotic in this window. */
  share: Share | null;
}

/** The window's first day as shown (the engine's window is from < date <= asOf). */
export function windowStart(asOf: IsoDate, days: number): IsoDate {
  return addDays(asOf, -days + 1);
}

/** coverage() over one window of `days`, for exactly this query (no widening). */
export function windowCoverage(
  results: readonly Result[],
  asOf: IsoDate,
  query: PatientQuery,
  catalog: Catalog,
  days: number,
): CoverageResult {
  return coverage(results, asOf, query, catalog, { minIsolates: 0, recentDays: days, yearDays: days });
}

export function cellFromShare(share: Share): Cell {
  if (share.n >= MIN && share.n > 0) return { state: "ok", share };
  if (share.n > 0) return { state: "few", share };
  return { state: "none", share };
}

/**
 * The figure for one antibiotic in a window. The engine leaves an antibiotic
 * out when it has no result in the window or (organism not known) when fewer
 * than half of the window's isolates have a known answer for it; below 2 x MIN
 * isolates that also means fewer than MIN answers, so it reads "too few".
 */
export function cellOf(cov: CoverageResult, antibiotic: string, organismKnown: boolean): Cell {
  const d = cov.drugs.find((x) => x.antibiotic === antibiotic);
  if (d) return cellFromShare(d.main);
  const isolates = cov.basis.n;
  if (isolates === 0 || organismKnown) return { state: "none", share: null };
  if (isolates * MIN_KNOWN_SHARE < MIN) return { state: "few", share: null };
  return { state: "rare", share: null };
}

/** 0-1 when the cell shows a percentage, else null. */
export function cellValue(cell: Cell): number | null {
  return cell.state === "ok" && cell.share ? shareValue(cell.share) : null;
}

/** Percentage points, last 4 weeks minus 12 months, only when both show a percentage. */
export function changeOf(recent: Cell, year: Cell): number | null {
  const r = cellValue(recent);
  const y = cellValue(year);
  // `|| 0` turns a rounded -0 into 0.
  return r === null || y === null ? null : Math.round(100 * (r - y)) || 0;
}

// ---------- Antibiotics view ----------

export interface DrugRow {
  code: string;
  aware: AwareGroup | null;
  /** Position in the lab's list (catalog order). */
  order: number;
  recent: Cell;
  year: Cell;
  /** Every unit, 12 months; null when the report already covers every unit. */
  hospital: Cell | null;
  change: number | null;
  months: MonthPoint[];
}

export interface TableModel {
  asOf: IsoDate;
  query: PatientQuery;
  recentN: number;
  yearN: number;
  /** First isolates on every unit in 12 months (null when the report covers every unit). */
  hospitalN: number | null;
  rows: DrugRow[];
  /** Treatment antibiotics for this specimen that have no row (too rarely tested here). */
  hidden: string[];
  /** Organisms behind this infection in 12 months (query without the organism), most common first. */
  organisms: LikelyOrganism[];
}

export function buildTable(results: readonly Result[], asOf: IsoDate, query: PatientQuery, catalog: Catalog): TableModel {
  const organismKnown = !!query.organism;
  const year = windowCoverage(results, asOf, query, catalog, YEAR_DAYS);
  const recent = windowCoverage(results, asOf, query, catalog, RECENT_DAYS);
  const everyUnit = query.ward === EVERY_UNIT;
  const hospital = everyUnit ? null : windowCoverage(results, asOf, { ...query, ward: EVERY_UNIT }, catalog, YEAR_DAYS);
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
      months: monthly(results, asOf, query, d.antibiotic, MONTHS, catalog),
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

export type SortKey = "list" | "works" | "drop";
export const SORT_KEYS: readonly SortKey[] = ["list", "works", "drop"];

/** list = the lab's order; works = 12-month figure, highest first; drop = change, largest fall first. Figures without a percentage go last. */
export function sortRows(rows: readonly DrugRow[], key: SortKey): DrugRow[] {
  const out = rows.slice();
  if (key === "works") {
    out.sort((a, b) => (cellValue(b.year) ?? -1) - (cellValue(a.year) ?? -1) || a.order - b.order);
  } else if (key === "drop") {
    out.sort((a, b) => (a.change ?? Infinity) - (b.change ?? Infinity) || a.order - b.order);
  } else {
    out.sort((a, b) => a.order - b.order);
  }
  return out;
}

/** The row whose 4-week figure fell furthest below its 12-month figure (only figures of MIN or more), or null. */
export function largestDrop(rows: readonly DrugRow[]): DrugRow | null {
  let best: DrugRow | null = null;
  for (const r of rows) {
    if (r.change === null || r.change >= 0) continue;
    if (!best || r.change < (best.change ?? 0) || (r.change === best.change && r.order < best.order)) best = r;
  }
  return best;
}

// ---------- Compare units view ----------

export interface MatrixRow {
  /** Unit code; EVERY_UNIT for the all-units row. */
  ward: string;
  /** First isolates in the window. */
  n: number;
  cells: Map<string, Cell>;
}

export interface MatrixModel {
  asOf: IsoDate;
  days: number;
  /** Antibiotic codes in the lab's order: every one shown on at least one row. */
  columns: { code: string; aware: AwareGroup | null }[];
  rows: MatrixRow[];
  all: MatrixRow;
  /** Organisms behind this infection on every unit in 12 months. */
  organisms: LikelyOrganism[];
}

export function buildMatrix(
  results: readonly Result[],
  asOf: IsoDate,
  query: PatientQuery,
  catalog: Catalog,
  days: number,
): MatrixModel {
  const organismKnown = !!query.organism;
  const base: PatientQuery = { ...query, ward: EVERY_UNIT };
  const allCov = windowCoverage(results, asOf, base, catalog, days);
  const unitCovs = catalog.units.map((u) => ({ ward: u.code, cov: windowCoverage(results, asOf, { ...base, ward: u.code }, catalog, days) }));
  const organisms = days === YEAR_DAYS ? allCov.organisms : windowCoverage(results, asOf, base, catalog, YEAR_DAYS).organisms;

  const used = new Map<string, AwareGroup | null>();
  for (const cov of [allCov, ...unitCovs.map((u) => u.cov)]) for (const d of cov.drugs) used.set(d.antibiotic, d.aware);
  const columns = treatmentsFor(catalog, query.specimen)
    .filter((a) => used.has(a.code))
    .map((a) => ({ code: a.code, aware: used.get(a.code) ?? null }));

  const rowOf = (ward: string, cov: CoverageResult): MatrixRow => ({
    ward,
    n: cov.basis.n,
    cells: new Map(columns.map((c) => [c.code, cellOf(cov, c.code, organismKnown)])),
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

/** Background strength (0-50 %) for a matrix cell: works less often = stronger. Square root spreads the clinically busy 80-100 % range. */
export function tintOf(value: number): number {
  const v = Math.min(1, Math.max(0, value));
  return Math.round(50 * Math.sqrt(1 - v));
}

// ---------- CSV ----------

export type CsvValue = string | number | null | undefined;

/** One field, RFC 4180 quoting; text that a spreadsheet would run as a formula is prefixed with '. */
export function csvField(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  let s = value;
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) || s !== s.trim() ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: readonly (readonly CsvValue[])[]): string {
  return rows.map((r) => r.map(csvField).join(",")).join("\r\n") + "\r\n";
}

/** Percentage with one decimal, only from MIN or more. */
export function csvPercent(cell: Cell): number | null {
  const v = cellValue(cell);
  return v === null ? null : Math.round(1000 * v) / 10;
}

const STATUS: Record<CellState, string> = { ok: "ok", few: "too_few", rare: "rarely_tested", none: "no_results" };

/** Names resolved by the screen in the reader's language; codes stay as the feed sends them. */
export interface CsvLabels {
  unitName: (code: string) => string;
  allUnits: string;
  antibioticName: (code: string) => string;
  specimen: string;
  organism: string | null;
  sex: string | null;
  age: string | null;
}

// Column names are machine-readable identifiers (the same in every language), so scripts can rely on them.
export function tableCsv(model: TableModel, labels: CsvLabels): string {
  const recentFrom = windowStart(model.asOf, RECENT_DAYS);
  const yearFrom = windowStart(model.asOf, YEAR_DAYS);
  const ward = model.query.ward;
  const head = [
    "as_of",
    "unit_code",
    "unit",
    "specimen",
    "organism",
    "sex",
    "age_group",
    "antibiotic_code",
    "antibiotic",
    "aware_group",
    "recent_from",
    "recent_to",
    "recent_first_isolates",
    "recent_works",
    "recent_n",
    "recent_percent_works",
    "recent_status",
    "year_from",
    "year_to",
    "year_first_isolates",
    "year_works",
    "year_n",
    "year_percent_works",
    "year_status",
    "all_units_year_first_isolates",
    "all_units_year_works",
    "all_units_year_n",
    "all_units_year_percent_works",
    "all_units_year_status",
    "change_points",
  ];
  const lines: CsvValue[][] = [head];
  for (const r of model.rows) {
    const h = r.hospital ?? r.year;
    lines.push([
      model.asOf,
      ward,
      ward === EVERY_UNIT ? labels.allUnits : labels.unitName(ward),
      labels.specimen,
      labels.organism,
      labels.sex,
      labels.age,
      r.code,
      labels.antibioticName(r.code),
      r.aware,
      recentFrom,
      model.asOf,
      model.recentN,
      r.recent.share?.works,
      r.recent.share?.n,
      csvPercent(r.recent),
      STATUS[r.recent.state],
      yearFrom,
      model.asOf,
      model.yearN,
      r.year.share?.works,
      r.year.share?.n,
      csvPercent(r.year),
      STATUS[r.year.state],
      model.hospitalN ?? model.yearN,
      h.share?.works,
      h.share?.n,
      csvPercent(h),
      STATUS[h.state],
      r.change,
    ]);
  }
  return toCsv(lines);
}

export function matrixCsv(model: MatrixModel, labels: CsvLabels): string {
  const from = windowStart(model.asOf, model.days);
  const head = [
    "as_of",
    "period_from",
    "period_to",
    "specimen",
    "organism",
    "sex",
    "age_group",
    "unit_code",
    "unit",
    "unit_first_isolates",
    "antibiotic_code",
    "antibiotic",
    "aware_group",
    "works",
    "n",
    "percent_works",
    "status",
  ];
  const lines: CsvValue[][] = [head];
  for (const row of [...model.rows, model.all]) {
    for (const c of model.columns) {
      const cell = row.cells.get(c.code) ?? { state: "none" as const, share: null };
      lines.push([
        model.asOf,
        from,
        model.asOf,
        labels.specimen,
        labels.organism,
        labels.sex,
        labels.age,
        row.ward,
        row.ward === EVERY_UNIT ? labels.allUnits : labels.unitName(row.ward),
        row.n,
        c.code,
        labels.antibioticName(c.code),
        c.aware,
        cell.share?.works,
        cell.share?.n,
        csvPercent(cell),
        STATUS[cell.state],
      ]);
    }
  }
  return toCsv(lines);
}

/** A file-name-safe piece: letters, digits and dashes. */
export function slug(text: string): string {
  return (
    text
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "x"
  );
}

/**
 * aei_<parts>_<date>.csv, empty parts skipped, e.g.
 * aei_med-a_urine_2025-05-12.csv or aei_units_blood_escherichia-coli_12-months_2025-05-12.csv
 */
export function csvFilename(parts: readonly (string | null | undefined)[], asOf: IsoDate): string {
  const named = parts.filter((p): p is string => !!p).map(slug);
  return `${["aei", ...named, asOf].join("_")}.csv`;
}
