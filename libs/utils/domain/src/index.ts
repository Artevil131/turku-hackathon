// Types and code lists of the synthetic microbiology dataset
// (data/synthetic_microbiology_dataset/README.md). Facts of the data only:
// no counting rules or statistics live here.

export type IsoDate = string; // YYYY-MM-DD

/**
 * A unit. The dataset's nine units keep their bare codes ("URO") and belong to
 * the home site; a connected site's units are stored qualified as
 * `<siteId>/<code>` ("sata/ICU"), so two hospitals may both have an ICU (D-051).
 */
export type WardCode = string;
/** A hospital or organisation connected to the server (D-051). */
export type SiteId = string;
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
  /** The site the unit belongs to (D-051). */
  site: SiteId;
  fi: string;
  en: string;
  type: "in" | "out";
  institution: "hospital" | "primary_care";
}

/** One hospital or organisation that sends results (D-051). */
export interface Site {
  id: SiteId;
  fi: string;
  en: string;
  /** Wellbeing services county as the regional data names it, e.g. "Varsinais-Suomen hyvinvointialue". */
  county: string;
  /** The site whose units have bare codes: the dataset's hospital. */
  home?: boolean;
  /** The id of the treatment guide table the site uses (D-047); `DEFAULT_GUIDE` when not given. */
  guide?: string;
}

/** The treatment guide table a site uses unless its entry names another (D-047). */
export const DEFAULT_GUIDE = "varha";

/** The dataset's hospital (D-051): the only site when no sites file is given. */
export const HOME_SITE: Site = {
  id: "tyks",
  fi: "Tyks",
  en: "Tyks",
  county: "Varsinais-Suomen hyvinvointialue",
  home: true,
  guide: DEFAULT_GUIDE,
};

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
  { code: "ED", site: "tyks", fi: "Päivystys", en: "Emergency department", type: "out", institution: "hospital" },
  { code: "MED-A", site: "tyks", fi: "Sisätaudit A", en: "Internal medicine A", type: "in", institution: "hospital" },
  { code: "MED-B", site: "tyks", fi: "Sisätaudit B", en: "Internal medicine B", type: "in", institution: "hospital" },
  { code: "SURG", site: "tyks", fi: "Kirurgia", en: "Surgery", type: "in", institution: "hospital" },
  { code: "URO", site: "tyks", fi: "Urologia", en: "Urology", type: "in", institution: "hospital" },
  { code: "ICU", site: "tyks", fi: "Teho-osasto", en: "Intensive care unit", type: "in", institution: "hospital" },
  { code: "GER", site: "tyks", fi: "Geriatria", en: "Geriatrics", type: "in", institution: "hospital" },
  { code: "PHC-N", site: "tyks", fi: "Terveysasema Pohjoinen", en: "Health centre North", type: "out", institution: "primary_care" },
  { code: "PHC-S", site: "tyks", fi: "Terveysasema Etelä", en: "Health centre South", type: "out", institution: "primary_care" },
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

/**
 * The site of a unit from its code alone: the part before "/" of a qualified
 * code, else the home site (D-051).
 */
export function siteOfWard(code: WardCode, home: SiteId = HOME_SITE.id): SiteId {
  const i = code.indexOf("/");
  return i > 0 ? code.slice(0, i) : home;
}

/** Rows split by the site of their unit, home site first when present, so statistics never pool sites (D-051). */
export function bySite<T extends { ward: WardCode | null }>(rows: readonly T[], home: SiteId = HOME_SITE.id): Map<SiteId, T[]> {
  const out = new Map<SiteId, T[]>([[home, []]]);
  for (const r of rows) {
    const site = r.ward === null ? home : siteOfWard(r.ward, home);
    const list = out.get(site);
    if (list) list.push(r);
    else out.set(site, [r]);
  }
  if (out.get(home)?.length === 0) out.delete(home);
  return out;
}

/** A unit's code without its site: "sata/ICU" is "ICU". */
export function bareWardCode(code: WardCode): string {
  return code.slice(code.indexOf("/") + 1);
}

/** One of the dataset's own units (the home site's nine); other sites' units come from the ward registry (@aei/sites). */
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
