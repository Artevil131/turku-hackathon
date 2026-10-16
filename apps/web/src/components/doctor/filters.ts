import { type CoverageResponse, type Level, type Severity, THRESHOLDS } from "@aei/contract";
import { isWardCode, type Sex, type Specimen, WARDS, type WardCode } from "@aei/domain";
import { type Locale, type MessageKey, t } from "@aei/i18n";

// The doctor's one-click filters, their defaults, and how they travel in the URL
// (`#doctor?unit=URO&site=urine&sex=F&age=older&onset=1&sev=severe&period=28`) and in localStorage (`aei.unit`).

export const AGE_GROUPS = ["any", "child", "adult", "older", "veryold"] as const;
export type AgeGroup = (typeof AGE_GROUPS)[number];
export type Period = 365 | 28;

export interface DoctorFilters {
  unit: WardCode;
  site: Specimen;
  sex: Sex | "any";
  /** Shown, not applied: the coverage API has no age filter. */
  age: AgeGroup;
  /** Shown, not applied: the API has no onset filter and the bar it implies is undecided (ENGINE 2.6). */
  onset: boolean;
  sev: Severity;
  period: Period;
}

export const DEFAULT_UNIT: WardCode = "MED-A";
export const DEFAULTS: Omit<DoctorFilters, "unit"> = { site: "urine", sex: "any", age: "any", onset: false, sev: "mild", period: 365 };
export const SITES: readonly Specimen[] = ["urine", "blood", "wound"];
/** The bar a severity is judged against, in percent (D-026, D-027), from the contract. */
export const BAR: Record<Severity, number> = { mild: THRESHOLDS.mild * 100, severe: THRESHOLDS.severe * 100 };

export const AGE_KEYS: Record<AgeGroup, MessageKey> = {
  any: "drAgeAny",
  child: "drAgeChild",
  adult: "drAgeAdult",
  older: "drAgeOlder",
  veryold: "drAgeVeryOld",
};

const UNIT_KEY = "aei.unit";

export function readStoredUnit(): WardCode | null {
  try {
    const v = localStorage.getItem(UNIT_KEY);
    return v && isWardCode(v) ? v : null;
  } catch {
    return null;
  }
}

export function storeUnit(unit: WardCode): void {
  try {
    localStorage.setItem(UNIT_KEY, unit);
  } catch {
    // storage blocked: the URL still carries the unit
  }
}

/** URL first, then the remembered unit, then the default. */
export function filtersFromUrl(params: URLSearchParams): DoctorFilters {
  const unit = params.get("unit");
  const site = params.get("site");
  const sex = params.get("sex");
  const age = params.get("age");
  const sev = params.get("sev");
  return {
    unit: unit && isWardCode(unit) ? unit : (readStoredUnit() ?? DEFAULT_UNIT),
    site: SITES.find((s) => s === site) ?? DEFAULTS.site,
    sex: sex === "F" || sex === "M" ? sex : DEFAULTS.sex,
    age: AGE_GROUPS.find((a) => a === age) ?? DEFAULTS.age,
    onset: params.get("onset") === "1",
    sev: sev === "severe" ? "severe" : "mild",
    period: params.get("period") === "28" ? 28 : 365,
  };
}

/** Defaults are left out so the common case is a short link; the unit is always written. */
export function filtersToParams(f: DoctorFilters): Record<string, string | null> {
  return {
    unit: f.unit,
    site: f.site === DEFAULTS.site ? null : f.site,
    sex: f.sex === "any" ? null : f.sex,
    age: f.age === "any" ? null : f.age,
    onset: f.onset ? "1" : null,
    sev: f.sev === "mild" ? null : f.sev,
    period: f.period === 365 ? null : String(f.period),
  };
}

export const unitGroups = {
  hospital: WARDS.filter((w) => w.institution === "hospital"),
  primary: WARDS.filter((w) => w.institution === "primary_care"),
};

// ---- certainty: what the figures rest on, a lookup on the level D-023/D-033 reached ----

export interface Certainty {
  glyph: string;
  label: MessageKey;
  short: MessageKey;
}

const CERTAINTY: Record<Level, Certainty> = {
  unit: { glyph: "●", label: "drLevelUnit", short: "drLevelUnitShort" },
  "ward type": { glyph: "◐", label: "drLevelWardType", short: "drLevelWardTypeShort" },
  hospital: { glyph: "○", label: "drLevelHospital", short: "drLevelHospitalShort" },
};

export function certaintyOf(level: Level): Certainty {
  return CERTAINTY[level];
}

/** Half-width of a 95 % interval in whole percentage points, or null when there is none. */
export function halfWidth(interval: [number, number] | null): number | null {
  return interval ? Math.round(((interval[1] - interval[0]) / 2) * 100) : null;
}

export const pct = (x: number): number => Math.round(x * 100);

/** A count in the locale's digits and grouping (Finnish groups with a no-break space). */
export const num = (locale: string, n: number): string => new Intl.NumberFormat(locale).format(n);

export type Row = CoverageResponse["suggestions"][number];

/** n behind a row's headline share: within-spectrum (mild) or all-organism (severe) known results. */
export function rowN(row: Row): number {
  return row.basis === "spectrum" ? row.coverage.spectrum.counts.known : row.coverage.counts.known;
}

/** The sex chip's label: Finnish N/M, English F/M, "any" spelled out. */
export function sexLabel(locale: Locale, sex: Sex | "any"): string {
  return t(locale, sex === "any" ? "drSexAny" : sex === "F" ? "drSexF" : "drSexM");
}

/** The sex spelled out for sentences and print: "female" / "male", Finnish "nainen" / "mies". */
export function sexWord(locale: Locale, sex: Sex | "any"): string {
  return t(locale, sex === "any" ? "drSexAny" : sex === "F" ? "drSexFWord" : "drSexMWord");
}
