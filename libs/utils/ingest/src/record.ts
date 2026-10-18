import {
  type AntibioticCode,
  type Culture,
  type CultureResult,
  type IsoDate,
  type Isolate,
  type Organism,
  type Patient,
  type Phenotype,
  type Sex,
  type Specimen,
  type SR,
  type Susceptibility,
  WARDS,
  type WardCode,
} from "@aei/domain";

// The internal record every format becomes (D-035): one culture with its
// patient, isolates and S/R results, exactly the rows the dataset loader
// gives, so detectors, alerts and coverage need no change.

export interface IsolateInput {
  organism: Organism;
  phenotypes: Phenotype[];
  quantity?: string | null;
  results: Partial<Record<AntibioticCode, SR>>;
}

export interface CultureInput {
  cultureId: string;
  patientId: string;
  sex: Sex;
  birthYear: number;
  homeArea?: string;
  sampleDate: IsoDate;
  ward: WardCode;
  admissionDate: IsoDate | null;
  specimen: Specimen;
  /** Mixed growth is reported as such; otherwise positive when isolates exist. */
  mixedGrowth?: boolean;
  isolates: IsolateInput[];
  guideline?: string;
}

/** Rows in the dataset's shape, plus anything the parser could not map. */
export interface IngestResult {
  patients: Patient[];
  cultures: Culture[];
  isolates: Isolate[];
  susceptibility: Susceptibility[];
  warnings: string[];
}

export const emptyResult = (): IngestResult => ({ patients: [], cultures: [], isolates: [], susceptibility: [], warnings: [] });

/** A real calendar day as YYYY-MM-DD; "2025-13-01", "2025-02-30" and non-strings are not. */
export function isIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** ISO 8601 year and week of a date. */
export function isoWeek(date: IsoDate): { year: number; week: number } {
  const d = new Date(`${date}T00:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7; // Monday 0
  d.setUTCDate(d.getUTCDate() - day + 3); // Thursday of this week
  const year = d.getUTCFullYear();
  const week = Math.ceil(((d.getTime() - Date.UTC(year, 0, 1)) / 86_400_000 + 1) / 7);
  return { year, week };
}

const WARD_TYPE = new Map(WARDS.map((w) => [w.code, w.type]));

/** Adds one culture (with its patient, isolates and results) to a result in the dataset's row shape. */
export function addCulture(out: IngestResult, c: CultureInput): void {
  const { year, week } = isoWeek(c.sampleDate);
  const result: CultureResult = c.mixedGrowth ? "mixed_growth" : c.isolates.length ? "positive" : "negative";
  if (!out.patients.some((p) => p.patientId === c.patientId)) {
    out.patients.push({ patientId: c.patientId, sex: c.sex, birthYear: c.birthYear, homeArea: c.homeArea ?? "" });
  }
  out.cultures.push({
    cultureId: c.cultureId,
    patientId: c.patientId,
    ageYears: Number(c.sampleDate.slice(0, 4)) - c.birthYear,
    sampleDate: c.sampleDate,
    isoYear: year,
    isoWeek: week,
    ward: c.ward,
    wardType: WARD_TYPE.get(c.ward) ?? "in",
    admissionDate: c.admissionDate,
    specimen: c.specimen,
    result,
    nIsolates: c.isolates.length,
  });
  c.isolates.forEach((iso, i) => {
    const isolateId = `${c.cultureId}-${i + 1}`;
    out.isolates.push({
      isolateId,
      cultureId: c.cultureId,
      isolateNo: i + 1,
      organism: iso.organism,
      quantity: iso.quantity ?? null,
      phenotypes: iso.phenotypes,
    });
    for (const [antibiotic, sr] of Object.entries(iso.results) as [AntibioticCode, SR][]) {
      out.susceptibility.push({ isolateId, antibiotic, result: sr, guideline: c.guideline ?? "" });
    }
  });
}

/** Two results as one; a later culture with the same id replaces the earlier (a corrected or final report). */
export function mergeResults(a: IngestResult, b: IngestResult): IngestResult {
  const replaced = new Set(b.cultures.map((c) => c.cultureId));
  const keep = <T extends { cultureId: string }>(rows: T[]) => rows.filter((r) => !replaced.has(r.cultureId));
  const keptIsolates = keep(a.isolates);
  const keptIds = new Set(keptIsolates.map((i) => i.isolateId));
  const patients = [...a.patients];
  for (const p of b.patients) if (!patients.some((q) => q.patientId === p.patientId)) patients.push(p);
  return {
    patients,
    cultures: [...keep(a.cultures), ...b.cultures],
    isolates: [...keptIsolates, ...b.isolates],
    susceptibility: [...a.susceptibility.filter((s) => keptIds.has(s.isolateId)), ...b.susceptibility],
    warnings: [...a.warnings, ...b.warnings],
  };
}

/** The rows of a dataset as an ingest result, so `mergeResults` can add to a loaded dataset. */
export function asResult(rows: Omit<IngestResult, "warnings">): IngestResult {
  return { ...rows, warnings: [] };
}
