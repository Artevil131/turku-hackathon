import type { Antibiotic, Unit } from "@aei/feed";

// Shapes both engines share (@aei/empiric and @aei/signals). Everything is
// computed from the feed; nothing is assumed about which units, organisms or
// antibiotics exist.

/** The code lists the engines need from FeedMeta. */
export interface Catalog {
  units: Unit[];
  antibiotics: Antibiotic[];
}

/** Of `n` first isolates, `works` were susceptible. */
export interface Share {
  works: number;
  n: number;
}

export type AgeBand = "under65" | "65plus";

/** hospital = sampled on day 3 of the stay or later (inpatients with an admission date); community = otherwise. */
export type Onset = "community" | "hospital";
