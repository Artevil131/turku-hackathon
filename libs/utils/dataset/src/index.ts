import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  type AntibioticCode,
  type Culture,
  type CultureResult,
  type Isolate,
  type IsolateRecord,
  type Organism,
  type Patient,
  PHENOTYPES,
  type Phenotype,
  type Sex,
  type Specimen,
  type SR,
  type Susceptibility,
  type WardCode,
} from "@aei/domain";
import { parseCsv } from "./csv.ts";

export { parseCsv } from "./csv.ts";

export interface Dataset {
  patients: Patient[];
  cultures: Culture[];
  isolates: Isolate[];
  susceptibility: Susceptibility[];
}

/** Reads the four data files from `dir` (the unzipped organiser dataset). */
export async function loadDataset(dir: string): Promise<Dataset> {
  const read = async (name: string) => parseCsv(await readFile(join(dir, name), "utf8"));
  const [patients, cultures, isolates, susceptibility] = await Promise.all([
    read("patients.csv"),
    read("cultures.csv"),
    read("isolates.csv"),
    read("susceptibility.csv"),
  ]);
  return {
    patients: patients.map(toPatient),
    cultures: cultures.map(toCulture),
    isolates: isolates.map(toIsolate),
    susceptibility: susceptibility.map(toSusceptibility),
  };
}

/** One record per isolate, with its culture, patient and results joined. */
export function joinIsolates(data: Dataset): IsolateRecord[] {
  const patients = new Map(data.patients.map((p) => [p.patientId, p]));
  const cultures = new Map(data.cultures.map((c) => [c.cultureId, c]));
  const results = new Map<string, Partial<Record<AntibioticCode, SR>>>();
  for (const s of data.susceptibility) {
    const r = results.get(s.isolateId) ?? {};
    r[s.antibiotic] = s.result;
    results.set(s.isolateId, r);
  }
  return data.isolates.map((iso) => {
    const culture = cultures.get(iso.cultureId);
    if (!culture) throw new Error(`isolate ${iso.isolateId}: unknown culture ${iso.cultureId}`);
    const patient = patients.get(culture.patientId);
    if (!patient) throw new Error(`culture ${culture.cultureId}: unknown patient ${culture.patientId}`);
    return {
      isolateId: iso.isolateId,
      cultureId: iso.cultureId,
      patientId: culture.patientId,
      sampleDate: culture.sampleDate,
      admissionDate: culture.admissionDate,
      ward: culture.ward,
      specimen: culture.specimen,
      organism: iso.organism,
      sex: patient.sex,
      ageYears: culture.ageYears,
      homeArea: patient.homeArea,
      phenotypes: iso.phenotypes,
      results: results.get(iso.isolateId) ?? {},
    };
  });
}

const toPatient = (r: Record<string, string>): Patient => ({
  patientId: r.patient_id ?? "",
  sex: r.sex as Sex,
  birthYear: Number(r.birth_year),
  homeArea: r.home_area ?? "",
});

const toCulture = (r: Record<string, string>): Culture => ({
  cultureId: r.culture_id ?? "",
  patientId: r.patient_id ?? "",
  ageYears: Number(r.age_years),
  sampleDate: r.sample_date ?? "",
  isoYear: Number(r.iso_year),
  isoWeek: Number(r.iso_week),
  ward: r.ward_code as WardCode,
  wardType: r.ward_type as "in" | "out",
  admissionDate: r.admission_date || null,
  specimen: r.specimen as Specimen,
  result: r.result as CultureResult,
  nIsolates: Number(r.n_isolates),
});

const toIsolate = (r: Record<string, string>): Isolate => ({
  isolateId: r.isolate_id ?? "",
  cultureId: r.culture_id ?? "",
  isolateNo: Number(r.isolate_no),
  organism: r.organism as Organism,
  quantity: r.quantity || null,
  phenotypes: PHENOTYPES.filter((p: Phenotype) => r[p] === "1"),
});

const toSusceptibility = (r: Record<string, string>): Susceptibility => ({
  isolateId: r.isolate_id ?? "",
  antibiotic: r.antibiotic_code as AntibioticCode,
  result: r.result as SR,
  guideline: r.guideline ?? "",
});
