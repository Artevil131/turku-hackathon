// Types and code lists of the synthetic microbiology dataset
// (data/synthetic_microbiology_dataset/README.md). Facts of the data only:
// no counting rules or statistics live here.

export type IsoDate = string; // YYYY-MM-DD

export type WardCode = "ED" | "MED-A" | "MED-B" | "SURG" | "URO" | "ICU" | "GER" | "PHC-N" | "PHC-S";
export type Specimen = "urine" | "blood" | "wound";
export type CultureResult = "positive" | "negative" | "mixed_growth";
export type SR = "S" | "R";
export type Sex = "F" | "M";
export type Phenotype = "esbl" | "mrsa" | "vre" | "cpe";

export type AntibioticCode = "AMP" | "MEC" | "TZP" | "FOX" | "CXM" | "CRO" | "CAZ" | "MEM" | "CIP" | "TMP" | "NIT" | "VAN" | "CLI";

export type Organism =
  | "Escherichia coli"
  | "Klebsiella pneumoniae"
  | "Klebsiella oxytoca"
  | "Proteus mirabilis"
  | "Citrobacter freundii"
  | "Pseudomonas aeruginosa"
  | "Enterococcus faecalis"
  | "Staphylococcus aureus"
  | "Staphylococcus saprophyticus";

export interface Ward {
  code: WardCode;
  fi: string;
  en: string;
  type: "in" | "out";
  institution: "hospital" | "primary_care";
}

export interface Antibiotic {
  code: AntibioticCode;
  en: string;
  fi: string;
  class: string;
  reportedFor: "all" | "urine";
}

// Rows as they appear in the CSV files, with typed columns.

export interface Patient {
  patientId: string;
  sex: Sex;
  birthYear: number;
  homeArea: string;
}

export interface Culture {
  cultureId: string;
  patientId: string;
  ageYears: number;
  sampleDate: IsoDate;
  isoYear: number;
  isoWeek: number;
  ward: WardCode;
  wardType: "in" | "out";
  admissionDate: IsoDate | null;
  specimen: Specimen;
  result: CultureResult;
  nIsolates: number;
}

export interface Isolate {
  isolateId: string;
  cultureId: string;
  isolateNo: number;
  organism: Organism;
  quantity: string | null;
  phenotypes: Phenotype[];
}

export interface Susceptibility {
  isolateId: string;
  antibiotic: AntibioticCode;
  result: SR;
  guideline: string;
}

/** One isolate with its culture, patient and susceptibility results joined. */
export interface IsolateRecord {
  isolateId: string;
  cultureId: string;
  patientId: string;
  sampleDate: IsoDate;
  admissionDate: IsoDate | null;
  ward: WardCode;
  specimen: Specimen;
  organism: Organism;
  sex: Sex;
  ageYears: number;
  /** The patient's home area (patients.csv). */
  homeArea: string;
  phenotypes: Phenotype[];
  results: Partial<Record<AntibioticCode, SR>>;
}

export const WARDS: readonly Ward[] = [
  { code: "ED", fi: "Päivystys", en: "Emergency department", type: "out", institution: "hospital" },
  { code: "MED-A", fi: "Sisätaudit A", en: "Internal medicine A", type: "in", institution: "hospital" },
  { code: "MED-B", fi: "Sisätaudit B", en: "Internal medicine B", type: "in", institution: "hospital" },
  { code: "SURG", fi: "Kirurgia", en: "Surgery", type: "in", institution: "hospital" },
  { code: "URO", fi: "Urologia", en: "Urology", type: "in", institution: "hospital" },
  { code: "ICU", fi: "Teho-osasto", en: "Intensive care unit", type: "in", institution: "hospital" },
  { code: "GER", fi: "Geriatria", en: "Geriatrics", type: "in", institution: "hospital" },
  { code: "PHC-N", fi: "Terveysasema Pohjoinen", en: "Health centre North", type: "out", institution: "primary_care" },
  { code: "PHC-S", fi: "Terveysasema Etelä", en: "Health centre South", type: "out", institution: "primary_care" },
];

export const ANTIBIOTICS: readonly Antibiotic[] = [
  { code: "AMP", en: "ampicillin", fi: "ampisilliini", class: "penicillins", reportedFor: "all" },
  { code: "MEC", en: "mecillinam", fi: "mesillinaami", class: "penicillins", reportedFor: "urine" },
  { code: "TZP", en: "piperacillin-tazobactam", fi: "piperasilliini-tatsobaktaami", class: "penicillins + BLI", reportedFor: "all" },
  { code: "FOX", en: "cefoxitin (screen)", fi: "kefoksitiini (seulonta)", class: "MRSA screen", reportedFor: "all" },
  { code: "CXM", en: "cefuroxime", fi: "kefuroksiimi", class: "cephalosporins 2nd gen", reportedFor: "all" },
  { code: "CRO", en: "ceftriaxone", fi: "keftriaksoni", class: "cephalosporins 3rd gen", reportedFor: "all" },
  { code: "CAZ", en: "ceftazidime", fi: "keftatsidiimi", class: "cephalosporins 3rd gen", reportedFor: "all" },
  { code: "MEM", en: "meropenem", fi: "meropeneemi", class: "carbapenems", reportedFor: "all" },
  { code: "CIP", en: "ciprofloxacin", fi: "siprofloksasiini", class: "fluoroquinolones", reportedFor: "all" },
  { code: "TMP", en: "trimethoprim", fi: "trimetopriimi", class: "trimethoprim", reportedFor: "urine" },
  { code: "NIT", en: "nitrofurantoin", fi: "nitrofurantoiini", class: "nitrofurans", reportedFor: "urine" },
  { code: "VAN", en: "vancomycin", fi: "vankomysiini", class: "glycopeptides", reportedFor: "all" },
  { code: "CLI", en: "clindamycin", fi: "klindamysiini", class: "lincosamides", reportedFor: "all" },
];

export const SPECIMENS: readonly { code: Specimen; en: string; fi: string }[] = [
  { code: "urine", en: "urine", fi: "virtsa" },
  { code: "blood", en: "blood", fi: "veri" },
  { code: "wound", en: "wound", fi: "haava" },
];

export const ORGANISMS: readonly Organism[] = [
  "Escherichia coli",
  "Klebsiella pneumoniae",
  "Klebsiella oxytoca",
  "Proteus mirabilis",
  "Citrobacter freundii",
  "Pseudomonas aeruginosa",
  "Enterococcus faecalis",
  "Staphylococcus aureus",
  "Staphylococcus saprophyticus",
];

export const PHENOTYPES: readonly Phenotype[] = ["esbl", "mrsa", "vre", "cpe"];

/** Home areas of patients (patients.csv). */
export const HOME_AREAS: readonly { code: string; en: string; fi: string }[] = [
  { code: "North", en: "North", fi: "Pohjoinen" },
  { code: "West", en: "West", fi: "Länsi" },
  { code: "Centre", en: "Centre", fi: "Keskusta" },
  { code: "East", en: "East", fi: "Itä" },
  { code: "South", en: "South", fi: "Etelä" },
];

/** Short form used on narrow screens: "E. coli". */
export function shortOrganism(name: Organism): string {
  const [genus, species] = name.split(" ");
  return `${genus?.[0] ?? ""}. ${species ?? ""}`;
}

export function isWardCode(value: string): value is WardCode {
  return WARDS.some((w) => w.code === value);
}

export function isAntibioticCode(value: string): value is AntibioticCode {
  return ANTIBIOTICS.some((a) => a.code === value);
}

// ---------- two fixed definitions several gears share ----------

/** Age words map through one fixed table (D-019): [lowest, highest] age in years, null for no upper bound. */
export const AGE_GROUPS = {
  child: [0, 17],
  adult: [18, 64],
  older: [65, null],
  veryOld: [80, null],
} as const;

export type AgeGroup = keyof typeof AGE_GROUPS;

export function isAgeGroup(value: string): value is AgeGroup {
  return Object.hasOwn(AGE_GROUPS, value);
}

export function inAgeGroup(ageYears: number, group: AgeGroup): boolean {
  const [min, max] = AGE_GROUPS[group];
  return ageYears >= min && (max === null || ageYears <= max);
}

/** Sampled on day 3 or later of the stay: sample date − admission date ≥ 2 days (CONTEXT.md, ENGINE.md A1). */
export function isHospitalOnset(r: Pick<IsolateRecord, "admissionDate" | "sampleDate">): boolean {
  return !!r.admissionDate && Date.parse(`${r.sampleDate}T00:00:00Z`) - Date.parse(`${r.admissionDate}T00:00:00Z`) >= 2 * 86_400_000;
}
