import type { IsoDate } from "@aei/feed";
import type { AgeBand, Onset, Share } from "@aei/isolates";

// Shapes of "what has worked lately for patients like this one?" and of the
// report tables built from it. Everything is computed from the feed; nothing
// is assumed about which units, organisms or antibiotics exist.

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
  /** First isolates in the main window (main.n can be smaller: isolates the lab did not test for it are left out). */
  isolates: number;
  /** Main window: first isolates with no result for it (and not expected resistant), by organism, most first. */
  untested: { organism: string; n: number }[];
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

/** How the coverage list is ordered: access-first puts a WHO Access antibiotic near the best first; coverage orders by share alone. */
export type Rank = "access-first" | "coverage";

export interface CoverageOptions {
  /** The organiser's floor: no percentage from fewer first isolates. */
  minIsolates: number;
  recentDays: number;
  yearDays: number;
  /** access-first: an Access antibiotic within accessMargin points of the best goes first. */
  rank: Rank;
  accessMargin: number;
}

export interface MonthPoint {
  /** First day of the month. */
  month: IsoDate;
  share: Share;
}

// ---------- Report tables (report.ts) ----------

/** How one figure can be shown. */
export type CellState =
  | "ok" // a percentage: at least the floor of first isolates with a known answer
  | "few" // fewer than the floor (share given when coverage() returned one; else fewer for sure)
  | "rare" // enough isolates, but the antibiotic was tested in fewer than half of them
  | "none"; // no isolates in the window, or none with a result for this antibiotic

export interface Cell {
  state: CellState;
  /** coverage()'s figure, when it returned one for this antibiotic in this window. */
  share: Share | null;
}

/** One antibiotic in the report's antibiotics table. */
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

/** The report's antibiotics table: one row per antibiotic, for exactly the query given. */
export interface ReportTable {
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

export interface MatrixRow {
  /** Unit code; EVERY_UNIT for the all-units row. */
  ward: string;
  /** First isolates in the window. */
  n: number;
  /** Antibiotic code -> cell, for every column. A plain object so it travels as JSON. */
  cells: Record<string, Cell>;
}

/** The report's unit comparison: every unit side by side over one window. */
export interface ReportMatrix {
  asOf: IsoDate;
  days: number;
  /** Antibiotic codes in the lab's order: every one shown on at least one row. */
  columns: { code: string; aware: AwareGroup | null }[];
  rows: MatrixRow[];
  all: MatrixRow;
  /** Organisms behind this infection on every unit in 12 months. */
  organisms: LikelyOrganism[];
}
