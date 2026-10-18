import { barFor, type CoverageQuery, type CoverageResponse, type Level, type Severity, THRESHOLDS } from "@aei/contract";
import { type AgeGroup as AgeBand, ANTIBIOTICS, isAgeGroup, ORGANISMS, type Sex, type Specimen, type WardCode } from "@aei/domain";
import { guide, type Syndrome, type SyndromeId, syndromeDefaults } from "@aei/guideline";
import { type Locale, type MessageKey, t } from "@aei/i18n";
import { inSite, knownWard, siteWards } from "../../sites.ts";

// The doctor's one-click filters, their defaults, and how they travel in the URL
// (`#doctor?unit=URO&site=urine&sex=F&age=older&onset=hospital&sev=severe&period=28`) and in localStorage (`aei.unit`).

/** "any" and D-019's groups (`AGE_GROUPS` in @aei/domain), in the order the strip shows them. */
export const AGE_GROUPS: readonly AgeGroup[] = ["any", "child", "adult", "older", "veryOld"];
export type AgeGroup = "any" | AgeBand;
/** The window the list describes, in days: the last four weeks, 90 days or the year (D-082). */
export type Period = 365 | 90 | 28;
export const PERIOD_VALUES: readonly Period[] = [28, 90, 365];

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
  /** The guide's syndrome the doctor chose (D-047), or null. Marks the guide's first choice; never filters or reorders. */
  syn: SyndromeId | null;
}

export const DEFAULT_UNIT: WardCode = "MED-A";
export const DEFAULTS: Omit<DoctorFilters, "unit"> = {
  site: "urine",
  sex: "any",
  age: "any",
  onset: false,
  sev: "mild",
  period: 365,
  syn: null,
};
export const SITES: readonly Specimen[] = ["urine", "blood", "wound"];
/** The bar a severity is judged against, in percent (D-026, D-027), from the contract. */
export const BAR: Record<Severity, number> = { mild: THRESHOLDS.mild * 100, severe: THRESHOLDS.severe * 100 };

/**
 * The bar the list is judged against, in percent: the response's own `bar` when it gives one (D-049: 90 for
 * hospital onset whatever the severity), else what `barFor` gives for the response's query, else for the filters.
 */
export function barOf(data: CoverageResponse | null, filters: Pick<DoctorFilters, "sev" | "onset">): number {
  const fraction = data
    ? (data.bar ?? barFor(data.coverage.query, data.severity))
    : barFor({ onset: filters.onset ? "hospital" : "any" }, filters.sev);
  return Math.round(fraction * 100);
}
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

/** The guide's syndrome by id, from the site's guide (only Varha's for now; a sites registry will name it). */
export function syndromeOf(id: string | null | undefined): Syndrome | undefined {
  return id ? guide().syndromes.find((s) => s.id === id) : undefined;
}

/**
 * Choosing a syndrome sets the filters it implies (specimen, severity, onset, and sex when the syndrome has one).
 * Community or any onset leaves the onset toggle off: only hospital onset is sent (D-049). Choosing the chosen one
 * again, or null, clears it and leaves the filters as they are.
 */
export function chooseSyndrome(f: DoctorFilters, syndrome: Syndrome | null): DoctorFilters {
  if (!syndrome || syndrome.id === f.syn) return { ...f, syn: null };
  const d = syndromeDefaults(syndrome);
  return { ...f, syn: syndrome.id, site: d.specimen, sev: d.severity, onset: d.onset === "hospital", sex: d.sex ?? f.sex };
}

/** A filter change; changing the specimen clears the chosen syndrome, other changes keep it. */
export function patchFilters(f: DoctorFilters, patch: Partial<DoctorFilters>): DoctorFilters {
  const next = { ...f, ...patch };
  if (!("syn" in patch) && patch.site !== undefined && patch.site !== f.site) next.syn = null;
  return next;
}

/** What the coverage API is asked for these filters: sex and onset only when set (D-049: hospital onset or nothing). */
export function coverageQuery(f: DoctorFilters): CoverageQuery {
  return {
    ward: f.unit,
    specimen: f.site,
    severity: f.sev,
    windowDays: f.period,
    ...(f.sex === "any" ? {} : { sex: f.sex }),
    ...(f.age === "any" ? {} : { ageGroup: f.age }),
    ...(f.onset ? { onset: "hospital" as const } : {}),
  };
}

/** A drug code a link asks the list to select; anything but a dataset code is ignored. */
export const focusAb = (v: string | null): string | null => ANTIBIOTICS.find((a) => a.code === v)?.code ?? null;

/** An organism a link asks the unit context to highlight; anything but a dataset organism is ignored. */
export const focusOrg = (v: string | null): string | null => ORGANISMS.find((o) => o === v) ?? null;

/** Carries legacy doctor deep links into a workspace without borrowing its filter names. */
export function doctorParamsToWindow(params: URLSearchParams): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key of ["unit", "site", "sex", "age", "onset", "sev", "period", "syn"]) {
    const value = params.get(key);
    if (value !== null) result[`cov.${key}`] = value;
  }
  const ab = focusAb(params.get("ab"));
  if (ab) result["cov.ab"] = ab;
  const org = focusOrg(params.get("org"));
  if (org) result["cov.org"] = org;
  return result;
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
    period: PERIOD_VALUES.find((p) => String(p) === params.get("period")) ?? 365,
    syn: syndromeOf(params.get("syn"))?.id ?? null,
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
    syn: f.syn,
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
