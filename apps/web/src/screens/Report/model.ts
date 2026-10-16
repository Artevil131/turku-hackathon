import type { Cell, CellState, DrugRow, ReportMatrix, ReportTable } from "@aei/empiric";
import type { IsoDate } from "@aei/feed";
import { addDays } from "@aei/isolates";
import { cellValue, EVERY_UNIT, REPORT_MIN, REPORT_MONTHS, REPORT_RECENT_DAYS, REPORT_YEAR_DAYS } from "../../analytics/helpers.ts";

/*
  How the report presents its tables. The tables themselves (ReportTable,
  ReportMatrix) come from the analysis (useReportTable, useReportMatrix in
  src/analytics; computed by @aei/empiric reportTable and reportMatrix), so the
  report and the Treat screen count the same way. Here: the windows' dates,
  sorting, cell shading, and the CSV files.
*/

export const MIN = REPORT_MIN;
export const RECENT_DAYS = REPORT_RECENT_DAYS;
export const YEAR_DAYS = REPORT_YEAR_DAYS;
export const MONTHS = REPORT_MONTHS;

/** The window's first day as shown (the analysis's window is from < date <= asOf). */
export function windowStart(asOf: IsoDate, days: number): IsoDate {
  return addDays(asOf, -days + 1);
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

/** Background strength (0-50 %) for a matrix cell: works less often = stronger. Square root spreads the clinically busy 80-100 % range. */
export function tintOf(value: number): number {
  const v = Math.min(1, Math.max(0, value));
  return Math.round(50 * Math.sqrt(1 - v));
}

// ---------- CSV ----------

export type CsvValue = string | number | null | undefined;

/**
 * How a spreadsheet in the reader's language opens a CSV: comma-separated
 * with a decimal point (English), or semicolon-separated with a decimal comma
 * (Finnish Excel reads "," as a decimal mark and puts a comma file in one column).
 */
export interface CsvDialect {
  sep: "," | ";";
  decimal: "." | ",";
}
export const CSV_EN: CsvDialect = { sep: ",", decimal: "." };
export const CSV_FI: CsvDialect = { sep: ";", decimal: "," };

/** One field, RFC 4180 quoting; text that a spreadsheet would run as a formula is prefixed with '. */
export function csvField(value: CsvValue, dialect: CsvDialect = CSV_EN): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value).replace(".", dialect.decimal) : "";
  let s = value;
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  const special = dialect.sep === ";" ? /[";\r\n]/ : /[",\r\n]/;
  return special.test(s) || s !== s.trim() ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: readonly (readonly CsvValue[])[], dialect: CsvDialect = CSV_EN): string {
  return rows.map((r) => r.map((v) => csvField(v, dialect)).join(dialect.sep)).join("\r\n") + "\r\n";
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
export function tableCsv(model: ReportTable, labels: CsvLabels, dialect: CsvDialect = CSV_EN): string {
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
  return toCsv(lines, dialect);
}

export function matrixCsv(model: ReportMatrix, labels: CsvLabels, dialect: CsvDialect = CSV_EN): string {
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
      const cell = row.cells[c.code] ?? { state: "none" as const, share: null };
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
  return toCsv(lines, dialect);
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
