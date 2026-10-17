import { barFor, type CoverageQuery, type CoverageResponse, type Level, type Severity, THRESHOLDS } from "@aei/contract";
import { isWardCode, type Sex, type Specimen, WARDS, type WardCode } from "@aei/domain";
import { guide, type Syndrome, type SyndromeId, syndromeDefaults } from "@aei/guideline";
import { type Locale, type MessageKey, t } from "@aei/i18n";

// The doctor's one-click filters, their defaults, and how they travel in the URL
// (`#doctor?unit=URO&site=urine&sex=F&sev=severe&onset=hospital&period=28`) and in localStorage (`aei.unit`).

export type Period = 365 | 28;

export interface DoctorFilters {
  unit: WardCode;
  site: Specimen;
  sex: Sex | "any";
  /** Hospital onset, inpatient day 3 or later (D-049): sends `onset: "hospital"`, which also sets the 90 % bar. Off sends nothing. */
  onset: boolean;
  sev: Severity;
  period: Period;
  /** The guide's syndrome the doctor chose (D-047), or null. Marks the guide's first choice; never filters or reorders. */
  syn: SyndromeId | null;
}

export const DEFAULT_UNIT: WardCode = "MED-A";
export const DEFAULTS: Omit<DoctorFilters, "unit"> = { site: "urine", sex: "any", onset: false, sev: "mild", period: 365, syn: null };
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
    ...(f.onset ? { onset: "hospital" as const } : {}),
  };
}

/** URL first, then the remembered unit, then the default. */
export function filtersFromUrl(params: URLSearchParams): DoctorFilters {
  const unit = params.get("unit");
  const site = params.get("site");
  const sex = params.get("sex");
  const sev = params.get("sev");
  return {
    unit: unit && isWardCode(unit) ? unit : (readStoredUnit() ?? DEFAULT_UNIT),
    site: SITES.find((s) => s === site) ?? DEFAULTS.site,
    sex: sex === "F" || sex === "M" ? sex : DEFAULTS.sex,
    onset: params.get("onset") === "hospital",
    sev: sev === "severe" ? "severe" : "mild",
    period: params.get("period") === "28" ? 28 : 365,
    syn: syndromeOf(params.get("syn"))?.id ?? null,
  };
}

/** Defaults are left out so the common case is a short link; the unit is always written. */
export function filtersToParams(f: DoctorFilters): Record<string, string | null> {
  return {
    unit: f.unit,
    site: f.site === DEFAULTS.site ? null : f.site,
    sex: f.sex === "any" ? null : f.sex,
    age: null,
    onset: f.onset ? "hospital" : null,
    sev: f.sev === "mild" ? null : f.sev,
    period: f.period === 365 ? null : String(f.period),
    syn: f.syn,
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

/** A date as d.m.yyyy (12.5.2025), the compact form of the redesign's text budget. */
export function dmy(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d}.${m}.${y}`;
}
