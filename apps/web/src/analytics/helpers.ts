// The gears' rule constants and small helpers the screens use on answers an
// AnalyticsSource returned: wording ("in the last 14 days"), the floor, and
// grouping or cutting an already computed signal list. None of them runs an
// engine, so they behave the same whichever source is active. Screens take
// these from here and only types from @aei/empiric and @aei/signals; the
// computations go through the hooks in ./index.ts.
//
// Plain module (no hooks, no Worker, no import.meta.env), so Node scripts and
// tests can import it too.

export {
  cellValue,
  DEFAULT_COVERAGE,
  EVERY_UNIT,
  isScreen,
  REPORT_MIN,
  REPORT_MONTHS,
  REPORT_RECENT_DAYS,
  REPORT_YEAR_DAYS,
  shareValue,
} from "@aei/empiric";
export {
  CLUSTER_ALPHA,
  CLUSTER_MIN_PATIENTS,
  CLUSTER_WINDOW_DAYS,
  episodeOf,
  GAP_ALPHA,
  GAP_BASELINE_DAYS,
  GAP_WINDOW_DAYS,
  GAP_ZERO_RUN_DAYS,
  groupEpisodes,
  NEW_FLAG_QUIET_DAYS,
  SENTINEL_GAP_DAYS,
  SHIFT_ALPHA,
  SHIFT_BASELINE_DAYS,
  SHIFT_MIN_BASELINE,
  SHIFT_WINDOW_DAYS,
  SURGE_ALPHA,
  SURGE_MIN_PATIENTS,
  SURGE_WINDOW_DAYS,
  TREND_ALPHA,
  TREND_BIN_DAYS,
  TREND_MIN_RISE,
  TREND_RECENT_BINS,
  visibleSignals,
} from "@aei/signals";
