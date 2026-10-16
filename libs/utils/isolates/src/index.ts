// What both engines share: calendar arithmetic on ISO dates, the organiser's
// first-isolate counting rule and its index, patient attributes (onset, age
// band), and the shared rules. See README.md.

export {
  compareResults,
  firstIsolates,
  firstPositions,
  indexResults,
  isolateKey,
  type ResultIndex,
  windowRange,
} from "./counting.ts";
export {
  addDays,
  addMonths,
  daysBetween,
  fromDayNumber,
  isIsoDate,
  maxDate,
  minDate,
  monthEnd,
  monthStart,
  monthsBetween,
  toDayNumber,
  weekStart,
} from "./dates.ts";
export { ageBandOf, onsetOf } from "./patients.ts";
export { MIN_ISOLATES } from "./rules.ts";
export type { AgeBand, Catalog, Onset, Share } from "./types.ts";
