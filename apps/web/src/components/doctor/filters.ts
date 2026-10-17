import { type CoverageResponse, type Level, type Severity, THRESHOLDS } from "@aei/contract";
import { type AgeGroup as AgeBand, isAgeGroup, type Sex, type Specimen, type WardCode } from "@aei/domain";
import { type Locale, type MessageKey, t } from "@aei/i18n";
import { inSite, knownWard, siteWards } from "../../sites.ts";

// The doctor's one-click filters, their defaults, and how they travel in the URL
// (`#doctor?unit=URO&site=urine&sex=F&age=older&onset=hospital&sev=severe&period=28`) and in localStorage (`aei.unit`).

/** "any" and D-019's groups (`AGE_GROUPS` in @aei/domain), in the order the strip shows them. */
export const AGE_GROUPS: readonly AgeGroup[] = ["any", "child", "adult", "older", "veryOld"];
export type AgeGroup = "any" | AgeBand;
export type Period = 365 | 28;

export interface DoctorFilters {
  unit: WardCode;
  site: Specimen;
  sex: Sex | "any";
  /** Sent to the coverage API; the server may drop it to keep the unit's own data (D-047). */
  age: AgeGroup;
  /** Inpatient day 3 or later (hospital onset), sent as `onset=hospital`; may be dropped like age (D-047). */
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
  veryOld: "drAgeVeryOld",
};

const UNIT_KEY = "aei.unit";

export function readStoredUnit(): WardCode | null {
  try {
    const v = localStorage.getItem(UNIT_KEY);
    return v && knownWard(v) && inSite(v) ? v : null;
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

/** The selected hospital's default unit (D-051): MED-A at the home site, else the hospital's first inpatient unit. */
export function defaultUnit(): WardCode {
  if (knownWard(DEFAULT_UNIT) && inSite(DEFAULT_UNIT)) return DEFAULT_UNIT;
  const wards = siteWards();
  return (wards.find((w) => w.type === "in") ?? wards[0])?.code ?? DEFAULT_UNIT;
}

/** URL first, then the remembered unit, then the default; a unit of a hospital other than the selected one is not used. */
export function filtersFromUrl(params: URLSearchParams): DoctorFilters {
  const unit = params.get("unit");
  const site = params.get("site");
  const sex = params.get("sex");
  const sev = params.get("sev");
  const age = params.get("age");
  return {
    unit: unit && knownWard(unit) && inSite(unit) ? unit : (readStoredUnit() ?? defaultUnit()),
    site: SITES.find((s) => s === site) ?? DEFAULTS.site,
    sex: sex === "F" || sex === "M" ? sex : DEFAULTS.sex,
    age: age && isAgeGroup(age) ? age : DEFAULTS.age,
    onset: params.get("onset") === "hospital",
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
    onset: f.onset ? "hospital" : null,
    sev: f.sev === "mild" ? null : f.sev,
    period: f.period === 365 ? null : String(f.period),
  };
}

/** The ward picker's units: the selected hospital's, or every hospital's (D-051). */
export const unitGroups = {
  get hospital() {
    return siteWards().filter((w) => w.institution === "hospital");
  },
  get primary() {
    return siteWards().filter((w) => w.institution === "primary_care");
  },
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

/** Patient filters asked for that the server dropped to keep the unit's own data (D-033, D-047): the sentence and the chip. */
export function droppedFilters(f: DoctorFilters, cov: CoverageResponse["coverage"]): { long: MessageKey; chip: MessageKey }[] {
  return [
    f.sex !== "any" && !cov.sexApplied ? ({ long: "drSexDropped", chip: "drSexDroppedChip" } as const) : null,
    f.age !== "any" && !cov.ageGroupApplied ? ({ long: "drAgeDropped", chip: "drAgeDroppedChip" } as const) : null,
    f.onset && !cov.onsetApplied ? ({ long: "drOnsetDropped", chip: "drOnsetDroppedChip" } as const) : null,
  ].filter((d) => d !== null);
}

/** The sex chip's label: Finnish N/M, English F/M, "any" spelled out. */
export function sexLabel(locale: Locale, sex: Sex | "any"): string {
  return t(locale, sex === "any" ? "drSexAny" : sex === "F" ? "drSexF" : "drSexM");
}

/** The sex spelled out for sentences and print: "female" / "male", Finnish "nainen" / "mies". */
export function sexWord(locale: Locale, sex: Sex | "any"): string {
  return t(locale, sex === "any" ? "drSexAny" : sex === "F" ? "drSexFWord" : "drSexMWord");
}

/** A date as d.m.yyyy (12.5.2025), the compact form of the redesign's text budget. */
export function dmy(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d}.${m}.${y}`;
}
