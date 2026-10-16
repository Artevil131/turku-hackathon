import { INCIDENT_DAYS, NEW_IN_UNIT_DAYS } from "@aei/alerts";
import { LIVE_SETTINGS } from "@aei/detect";

// The server's alert rules in the words the screens use. Every number comes
// from the gears the server runs (libs/utils/detect LIVE_SETTINGS, D-020,
// D-031; libs/utils/alerts, D-014, D-021, D-034), so the copy cannot drift
// from what was tested.

/** Profile excess (a cluster): window, minimum patients, significance level. */
export const CLUSTER_WINDOW_DAYS = LIVE_SETTINGS.profileExcess.windowDays;
export const CLUSTER_MIN_PATIENTS = LIVE_SETTINGS.profileExcess.minObserved;
export const CLUSTER_ALPHA = LIVE_SETTINGS.profileExcess.alpha;
export const CLUSTER_BASELINE_DAYS = LIVE_SETTINGS.profileExcess.baselineDays;

/** Phenotype excess (a surge). */
export const SURGE_WINDOW_DAYS = LIVE_SETTINGS.phenotypeExcess.windowDays;
export const SURGE_MIN_PATIENTS = LIVE_SETTINGS.phenotypeExcess.minObserved;
export const SURGE_ALPHA = LIVE_SETTINGS.phenotypeExcess.alpha;
export const SURGE_BASELINE_DAYS = LIVE_SETTINGS.phenotypeExcess.baselineDays;

/** Sampling drop and empty run (a data gap). */
export const GAP_WINDOW_DAYS = LIVE_SETTINGS.samplingDrop.windowDays;
export const GAP_BASELINE_DAYS = LIVE_SETTINGS.samplingDrop.baselineDays;
export const GAP_ALPHA = LIVE_SETTINGS.samplingDrop.alpha;
export const EMPTY_RUN_BASELINE_DAYS = LIVE_SETTINGS.emptyRun.baselineDays;
export const EMPTY_RUN_ALPHA = LIVE_SETTINGS.emptyRun.alpha;

/** Rising trend, hospital-wide. */
export const TREND_BIN_DAYS = LIVE_SETTINGS.risingTrend.binDays;
export const TREND_MIN_BINS = LIVE_SETTINGS.risingTrend.minBins;
export const TREND_ALPHA = LIVE_SETTINGS.risingTrend.alpha;

/** MRSA or VRE on an inpatient unit after this many days without one. */
export const NEW_FLAG_QUIET_DAYS = NEW_IN_UNIT_DAYS;
/** Alerts about the same unit and organism or flag within this many days are one incident. */
export const INCIDENT_GAP_DAYS = INCIDENT_DAYS;

/** The organiser's floor: no percentage from fewer first isolates. */
export const MIN_ISOLATES = 30;
