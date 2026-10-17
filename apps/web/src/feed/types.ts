// The data feed AEI reads. Any laboratory system can drive the app by
// serving this: code lists (units, antibiotics, organisms, specimens), the
// results released so far, and new results as they are released. Nothing in
// the app assumes a particular hospital, unit, organism or antibiotic; all of
// it comes from here.

export type IsoDate = string; // YYYY-MM-DD

export interface Named {
  code: string;
  en: string;
  fi: string;
}

/** A ward or health centre that sends samples. */
export interface Unit extends Named {
  /** "in" = inpatient ward (patients stay; admission dates exist), "out" = outpatient / emergency / primary care. */
  type: "in" | "out";
  /** e.g. "hospital", "primary_care". */
  institution: string;
}

export interface Antibiotic extends Named {
  /** Drug class as the lab names it. */
  class: string;
  /** "all", or the one specimen code it is reported for (e.g. "urine"). */
  reportedFor: string;
}

export interface FeedMeta {
  /** First and last date the feed has data for. */
  start: IsoDate;
  end: IsoDate;
  units: Unit[];
  antibiotics: Antibiotic[];
  /** Organism names as the lab writes them (Latin). */
  organisms: string[];
  specimens: Named[];
  /** True when the feed can answer plain-language questions (optional AI layer). */
  ai: boolean;
}

export type SR = "S" | "R";

/** One isolate (organism found in a sample) with its sample, patient and susceptibility results. */
export interface Result {
  isolateId: string;
  cultureId: string;
  patientId: string;
  sampleDate: IsoDate;
  /** Admission date of the stay, for inpatients; null otherwise. */
  admissionDate: IsoDate | null;
  /** Unit code (see FeedMeta.units). */
  ward: string;
  /** Specimen code (see FeedMeta.specimens). */
  specimen: string;
  organism: string;
  sex: string; // "F" | "M" in practice
  ageYears: number;
  /** Resistance flags the lab set, lower case, e.g. "esbl", "mrsa", "vre", "cpe". */
  phenotypes: string[];
  /** Antibiotic code -> S or R. Antibiotics not tested are absent. */
  results: Record<string, SR>;
}

/** The feed's clock: results up to `asOf` have been released. */
export interface FeedClock {
  asOf: IsoDate;
  /** The range the clock can move in (a demo replay; a live system has start = first data, end = today). */
  start: IsoDate;
  end: IsoDate;
  /** True while a demo replay is advancing on its own. */
  running: boolean;
  tickMs: number;
  daysPerTick: number;
}

export type FeedEvent =
  | { type: "clock"; clock: FeedClock }
  /** Results released when the clock moved from `from` (exclusive) to `to` (inclusive). */
  | { type: "arrivals"; from: IsoDate; to: IsoDate; results: Result[] }
  /** The clock moved backwards: everything shown must be reloaded. */
  | { type: "reset"; clock: FeedClock };

/** Demo controls. A live hospital feed would not offer these. */
export type FeedCommand =
  | { action: "play" }
  | { action: "pause" }
  | { action: "step"; days?: number }
  | { action: "seek"; date: IsoDate }
  | { action: "configure"; tickMs?: number; daysPerTick?: number };

/** Plain-language question -> filters, in the older shape (the AI layer now lives in src/ai; see toAskAnswer). */
export interface AskAnswer {
  filters: { from?: IsoDate; to?: IsoDate; ward?: string; specimen?: string; organism?: string };
  ageGroup?: string;
  /** Words the model could not use. */
  unmatched: string[];
}

export interface Feed {
  meta(): Promise<FeedMeta>;
  clock(): Promise<FeedClock>;
  /** Every result released so far with sampleDate in [from, to] (inclusive; omitted = open). */
  history(range?: { from?: IsoDate; to?: IsoDate }): Promise<Result[]>;
  /** Live events; returns a function that closes the stream. */
  subscribe(onEvent: (event: FeedEvent) => void, onError?: () => void): () => void;
  control(command: FeedCommand): Promise<FeedClock>;
}
