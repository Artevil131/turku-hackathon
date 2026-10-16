import type { Result } from "@aei/feed";
import { toDayNumber } from "./dates.ts";
import type { AgeBand, Onset } from "./types.ts";

// Patient attributes derived from a result, the same way everywhere.

/** Provisional (not yet in DECISIONS.md): the age band boundary is 65. */
export function ageBandOf(age: number): AgeBand {
  return age >= 65 ? "65plus" : "under65";
}

/** Provisional (not yet in DECISIONS.md): hospital = sampled on day 3 of the stay or later (sampleDate >= admissionDate + 2 days); community otherwise. */
export function onsetOf(r: Result): Onset {
  if (!r.admissionDate) return "community";
  return toDayNumber(r.sampleDate) - toDayNumber(r.admissionDate) >= 2 ? "hospital" : "community";
}
