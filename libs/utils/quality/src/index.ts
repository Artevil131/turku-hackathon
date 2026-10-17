import {
  ANTIBIOTICS,
  type AntibioticCode,
  type Culture,
  type IsoDate,
  type Isolate,
  type Organism,
  type Patient,
  type Phenotype,
  type SR,
  type Susceptibility,
  WARDS,
} from "@aei/domain";
import { hasNoBreakpoint, inferredResult, isIntrinsic } from "@aei/eucast";

// Plausibility checks on lab data, in the dataset's own row shape (D-038):
// links between rows, dates and ages, culture counts, and microbiology
// facts from @aei/eucast. Every check is a fact, not a threshold: an
// "error" cannot be true (an isolate of a culture that does not exist, a
// sample taken before the patient was born); a "suspect" row is possible
// but usually a lab or data error that EUCAST asks to verify (a
// susceptible result to an antibiotic the organism resists by nature).
// The checks report; they never change or drop a row.

export interface Rows {
  patients: Patient[];
  cultures: Culture[];
  isolates: Isolate[];
  susceptibility: Susceptibility[];
}

export type Severity = "error" | "suspect";

export type CheckName =
  | "duplicate-id"
  | "duplicate-result"
  | "missing-link"
  | "isolate-count"
  | "sample-before-birth"
  | "admission-after-sample"
  | "future-sample"
  | "age-mismatch"
  | "ward-type"
  | "intrinsic-susceptible"
  | "no-breakpoint-reported"
  | "specimen-antibiotic"
  | "inferred-contradiction"
  | "phenotype-organism"
  | "phenotype-result";

export interface Finding {
  check: CheckName;
  severity: Severity;
  /** The row the finding is about: a patient, culture or isolate id. */
  id: string;
  message: string;
}

export const SEVERITY: Record<CheckName, Severity> = {
  "duplicate-id": "error",
  "duplicate-result": "error",
  "missing-link": "error",
  "isolate-count": "error",
  "sample-before-birth": "error",
  "admission-after-sample": "error",
  "future-sample": "error",
  "age-mismatch": "suspect",
  "ward-type": "suspect",
  "intrinsic-susceptible": "suspect",
  "no-breakpoint-reported": "suspect",
  "specimen-antibiotic": "suspect",
  "inferred-contradiction": "suspect",
  "phenotype-organism": "suspect",
  "phenotype-result": "suspect",
};

const ENTEROBACTERALES: Organism[] = [
  "Escherichia coli",
  "Klebsiella pneumoniae",
  "Klebsiella oxytoca",
  "Citrobacter freundii",
  "Proteus mirabilis",
];

/** Organisms each phenotype can belong to. */
export const PHENOTYPE_ORGANISMS: Record<Phenotype, readonly Organism[]> = {
  esbl: ENTEROBACTERALES,
  cpe: ENTEROBACTERALES,
  mrsa: ["Staphylococcus aureus"],
  vre: ["Enterococcus faecalis"],
};

/** A phenotype that fixes one tested result: MRSA is cefoxitin-resistant, VRE vancomycin-resistant. */
const PHENOTYPE_MARKER: Partial<Record<Phenotype, AntibioticCode>> = { mrsa: "FOX", vre: "VAN" };

export interface CheckOptions {
  /** Samples dated after this are errors ("future-sample"). */
  asOf?: IsoDate;
}

/** Every finding in `rows`, in table order. */
export function checkRows(rows: Rows, options: CheckOptions = {}): Finding[] {
  const out: Finding[] = [];
  const add = (check: CheckName, id: string, message: string) => out.push({ check, severity: SEVERITY[check], id, message });

  const duplicates = <T>(items: readonly T[], idOf: (x: T) => string, what: string) => {
    const seen = new Set<string>();
    for (const x of items) {
      const id = idOf(x);
      if (seen.has(id)) add("duplicate-id", id, `${what} ${id} appears more than once`);
      seen.add(id);
    }
  };
  duplicates(rows.patients, (p) => p.patientId, "patient");
  duplicates(rows.cultures, (c) => c.cultureId, "culture");
  duplicates(rows.isolates, (i) => i.isolateId, "isolate");

  const patients = new Map(rows.patients.map((p) => [p.patientId, p]));
  const cultures = new Map(rows.cultures.map((c) => [c.cultureId, c]));
  const isolates = new Map(rows.isolates.map((i) => [i.isolateId, i]));
  const wardTypes = new Map(WARDS.map((w) => [w.code, w.type]));

  const isolatesPerCulture = new Map<string, number>();
  for (const i of rows.isolates) isolatesPerCulture.set(i.cultureId, (isolatesPerCulture.get(i.cultureId) ?? 0) + 1);

  for (const c of rows.cultures) {
    const p = patients.get(c.patientId);
    if (!p) add("missing-link", c.cultureId, `culture ${c.cultureId}: patient ${c.patientId} not found`);
    else {
      const sampleYear = Number(c.sampleDate.slice(0, 4));
      if (sampleYear < p.birthYear)
        add("sample-before-birth", c.cultureId, `culture ${c.cultureId}: sampled ${c.sampleDate}, patient born ${p.birthYear}`);
      else if (c.ageYears !== sampleYear - p.birthYear && c.ageYears !== sampleYear - p.birthYear - 1)
        add("age-mismatch", c.cultureId, `culture ${c.cultureId}: age ${c.ageYears} at ${c.sampleDate}, patient born ${p.birthYear}`);
    }
    if (c.admissionDate && c.admissionDate > c.sampleDate)
      add("admission-after-sample", c.cultureId, `culture ${c.cultureId}: admitted ${c.admissionDate}, sampled ${c.sampleDate}`);
    if (options.asOf && c.sampleDate > options.asOf)
      add("future-sample", c.cultureId, `culture ${c.cultureId}: sampled ${c.sampleDate}, after ${options.asOf}`);
    const type = wardTypes.get(c.ward);
    if (type && type !== c.wardType)
      add("ward-type", c.cultureId, `culture ${c.cultureId}: ${c.ward} is ${type}patient, the row says ${c.wardType}`);
    const n = isolatesPerCulture.get(c.cultureId) ?? 0;
    if (n !== c.nIsolates || (c.result === "positive" && n === 0) || (c.result !== "positive" && n > 0))
      add("isolate-count", c.cultureId, `culture ${c.cultureId}: ${c.result} with n_isolates ${c.nIsolates}, ${n} isolate rows`);
  }

  const results = new Map<string, Partial<Record<AntibioticCode, SR>>>();
  for (const s of rows.susceptibility) {
    const r = results.get(s.isolateId) ?? {};
    if (s.antibiotic in r) add("duplicate-result", s.isolateId, `isolate ${s.isolateId}: ${s.antibiotic} reported more than once`);
    r[s.antibiotic] = s.result;
    results.set(s.isolateId, r);
    if (!isolates.has(s.isolateId)) add("missing-link", s.isolateId, `susceptibility for isolate ${s.isolateId}, which is not found`);
  }

  for (const i of rows.isolates) {
    const c = cultures.get(i.cultureId);
    if (!c) add("missing-link", i.isolateId, `isolate ${i.isolateId}: culture ${i.cultureId} not found`);
    const r = results.get(i.isolateId) ?? {};
    for (const [code, result] of Object.entries(r) as [AntibioticCode, SR][]) {
      if (result === "S" && isIntrinsic(i.organism, code))
        add(
          "intrinsic-susceptible",
          i.isolateId,
          `isolate ${i.isolateId}: ${i.organism} reported S to ${code}, which it resists by nature (EUCAST: check identification and test)`,
        );
      if (hasNoBreakpoint(i.organism, code))
        add("no-breakpoint-reported", i.isolateId, `isolate ${i.isolateId}: ${code} reported for ${i.organism}, which has no breakpoint`);
      const ab = ANTIBIOTICS.find((a) => a.code === code);
      if (c && ab && ab.reportedFor !== "all" && ab.reportedFor !== c.specimen)
        add(
          "specimen-antibiotic",
          i.isolateId,
          `isolate ${i.isolateId}: ${code} is reported for ${ab.reportedFor} only, specimen is ${c.specimen}`,
        );
      const inferred = inferredResult({ organism: i.organism, results: { ...r, [code]: undefined } }, code);
      if (inferred && inferred !== result)
        add(
          "inferred-contradiction",
          i.isolateId,
          `isolate ${i.isolateId}: ${code} ${result}, but EUCAST infers ${inferred} from its other results`,
        );
    }
    for (const ph of i.phenotypes) {
      if (!PHENOTYPE_ORGANISMS[ph].includes(i.organism))
        add("phenotype-organism", i.isolateId, `isolate ${i.isolateId}: ${ph.toUpperCase()} flagged on ${i.organism}`);
    }
    for (const [ph, code] of Object.entries(PHENOTYPE_MARKER) as [Phenotype, AntibioticCode][]) {
      if (!PHENOTYPE_ORGANISMS[ph].includes(i.organism) || r[code] === undefined) continue;
      const flagged = i.phenotypes.includes(ph);
      if (flagged !== (r[code] === "R"))
        add(
          "phenotype-result",
          i.isolateId,
          `isolate ${i.isolateId}: ${flagged ? "" : "not "}flagged ${ph.toUpperCase()}, but ${code} is ${r[code]}`,
        );
    }
  }
  return out;
}

export interface CheckSummary {
  check: CheckName;
  severity: Severity;
  count: number;
  /** Up to three findings, in table order. */
  examples: Finding[];
}

/** Findings grouped by check: errors first, then by count. */
export function summarize(findings: readonly Finding[]): CheckSummary[] {
  const by = new Map<CheckName, Finding[]>();
  for (const f of findings) by.set(f.check, [...(by.get(f.check) ?? []), f]);
  return [...by.entries()]
    .map(([check, list]) => ({ check, severity: SEVERITY[check], count: list.length, examples: list.slice(0, 3) }))
    .sort((a, b) => (a.severity === b.severity ? b.count - a.count : a.severity === "error" ? -1 : 1));
}
