// Deviation detection over the released results: sentinel finds, surges,
// clusters, data gaps, shifts and trends (signals.ts), the statistics behind
// them (stats.ts), and grouping into episodes for the reader (episodes.ts).
// See README.md.

export { EPISODE_LINK_DAYS, type Episode, episodeOf, groupEpisodes } from "./episodes.ts";
export { ALWAYS_ALERT_FLAGS } from "./phenotypes.ts";
export {
  CLUSTER_ALPHA,
  CLUSTER_BASELINE_DAYS,
  CLUSTER_MIN_PATIENTS,
  CLUSTER_SMOOTHING,
  CLUSTER_WINDOW_DAYS,
  DEFAULT_SIGNALS,
  detectSignals,
  EPISODE_GAP_DAYS,
  FIRST_ISOLATE_DAYS,
  GAP_ALPHA,
  GAP_BASELINE_DAYS,
  GAP_WINDOW_DAYS,
  GAP_ZERO_RUN_DAYS,
  GAP_ZERO_RUN_MIN_PER_DAY,
  NEW_FLAG_QUIET_DAYS,
  resetSignalCache,
  SENTINEL_GAP_DAYS,
  SHIFT_ALPHA,
  SHIFT_BASELINE_DAYS,
  SHIFT_MIN_BASELINE,
  SHIFT_MIN_RECENT,
  SHIFT_MIN_RESISTANT,
  SHIFT_WINDOW_DAYS,
  SURGE_ALPHA,
  SURGE_BASELINE_DAYS,
  SURGE_MIN_PATIENTS,
  SURGE_WINDOW_DAYS,
  TREND_ALPHA,
  TREND_BIN_DAYS,
  TREND_MAX_BINS,
  TREND_MIN_BINS,
  TREND_MIN_ISOLATES,
  TREND_MIN_RISE,
  TREND_RECENT_BINS,
} from "./signals.ts";
export { cochranArmitageUp, fisherMidPGreater, logFactorial, normalUpper, poissonLower, poissonUpper } from "./stats.ts";
export type { Severity, Signal, SignalKind, SignalOptions } from "./types.ts";
export { visibleSignals } from "./visible.ts";
