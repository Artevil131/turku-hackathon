// "What has worked lately for patients like this one?": the coverage list,
// its monthly series, the report tables built from them, and the two public
// tables they use (WHO AWaRe, EUCAST expected resistant phenotypes). See README.md.

export { awareOf } from "./aware.ts";
export {
  type CoverageTuning,
  coverage,
  DEFAULT_COVERAGE,
  EVERY_UNIT,
  isScreen,
  MIN_KNOWN_SHARE,
  monthly,
  shareValue,
  treatmentsFor,
  WIDENING_ORDER,
} from "./coverage.ts";
export { isIntrinsicallyResistant } from "./eucast.ts";
export {
  cellFromShare,
  cellOf,
  cellValue,
  changeOf,
  REPORT_MIN,
  REPORT_MONTHS,
  REPORT_RECENT_DAYS,
  REPORT_YEAR_DAYS,
  reportMatrix,
  reportTable,
  windowCoverage,
} from "./report.ts";
export type {
  AwareGroup,
  Basis,
  Cell,
  CellState,
  CoverageOptions,
  CoverageResult,
  DrugFigure,
  DrugRow,
  LikelyOrganism,
  MatrixRow,
  MonthPoint,
  PatientQuery,
  Rank,
  ReportMatrix,
  ReportTable,
  TopReason,
  Widening,
} from "./types.ts";
