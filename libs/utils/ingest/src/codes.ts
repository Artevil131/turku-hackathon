import {
  ANTIBIOTICS,
  type AntibioticCode,
  ORGANISMS,
  type Organism,
  type Phenotype,
  SPECIMENS,
  type Specimen,
  type SR,
  WARDS,
  type Ward,
  type WardCode,
} from "@aei/domain";
import THL_CODES from "./thl-codes.json" with { type: "json" };

// Mapping incoming codes to the dataset's vocabulary (D-035). Every lab has
// its own local codes, so the maps are configuration: built-in defaults cover
// international code systems and plain names in English, Finnish and Latin; a
// site adds its own codes with `extendCodeMaps`. A code that maps to nothing
// is reported by the parsers, never dropped silently.

/** A coded value as the formats carry it: system (URI or HL7 v2 coding system), code and display text. */
export interface Coding {
  system?: string | undefined;
  code?: string | undefined;
  display?: string | undefined;
}

export interface CodeMaps {
  organisms: Record<string, Organism>;
  antibiotics: Record<string, AntibioticCode>;
  specimens: Record<string, Specimen>;
  /** Locations (ward codes, names, a site's location identifiers) to units. */
  wards: Record<string, WardCode>;
  phenotypes: Record<string, Phenotype>;
  /**
   * Keep a location that maps to no unit as the code it was sent with, instead
   * of skipping the culture. A connected site's maps set it (D-051): its rows are
   * kept as sent and the unregistered unit is reported by @aei/sites.
   */
  keepUnknownWards?: boolean;
}

const norm = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** The keys a map is looked up by: "system|code", the code alone, and the normalised display text. */
function keys(c: Coding): string[] {
  const out: string[] = [];
  if (c.code) {
    if (c.system) out.push(`${c.system}|${c.code}`);
    out.push(c.code, norm(c.code));
  }
  if (c.display) out.push(norm(c.display));
  return out;
}

function lookup<T>(map: Record<string, T>, codings: readonly Coding[]): T | undefined {
  for (const c of codings) for (const k of keys(c)) if (k in map) return map[k];
  return undefined;
}

const SNOMED = "http://snomed.info/sct";

/**
 * Finnish national code systems on the Kanta code server (koodistopalvelu.kanta.fi),
 * as FHIR system URIs. THL's microbe and antimicrobial codes for the dataset's
 * organisms and antibiotics are built in (thl-codes.json, D-036); a site maps
 * others with `extendCodeMaps`, e.g. `{ organisms: { "urn:oid:1.2.246.537.6.241|<code>": "Escherichia coli" } }`.
 */
export const FINNISH_SYSTEMS = {
  labTests: "urn:oid:1.2.246.537.6.3", // Kuntaliitto, Laboratoriotutkimusnimikkeistö
  microbes: "urn:oid:1.2.246.537.6.241", // THL, Mikrobinimikkeistö
  antimicrobials: "urn:oid:1.2.246.537.6.249", // THL, Mikrobilääkkeet
  susceptibility: "urn:oid:1.2.246.537.6.253", // THL, Mikrobin herkkyys (S / I / R)
} as const;

/** "system|code" keys for a THL code list, under both the bare OID (HL7 v2) and the urn:oid: URI (FHIR), by code and by THL abbreviation. */
function thlKeys<T>(list: { system: string; codes: Record<string, { abbreviation: string; aei: string }> }): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [code, c] of Object.entries(list.codes))
    for (const system of [list.system, `urn:oid:${list.system}`]) {
      out[`${system}|${code}`] = c.aei as T;
      out[`${system}|${c.abbreviation}`] = c.aei as T;
    }
  return out;
}

function defaults(): CodeMaps {
  const organisms: Record<string, Organism> = {};
  for (const o of ORGANISMS) organisms[norm(o)] = o;
  // SNOMED CT organism concepts (international edition).
  const snomedOrganisms: Record<string, Organism> = {
    "112283007": "Escherichia coli",
    "56415008": "Klebsiella pneumoniae",
    "40886007": "Klebsiella oxytoca",
    "73457008": "Proteus mirabilis",
    "6265002": "Citrobacter freundii",
    "52499004": "Pseudomonas aeruginosa",
    "78065002": "Enterococcus faecalis",
    "3092008": "Staphylococcus aureus",
  };
  for (const [code, o] of Object.entries(snomedOrganisms)) organisms[`${SNOMED}|${code}`] = o;
  Object.assign(organisms, thlKeys<Organism>(THL_CODES.microbes));
  // Short forms seen in lab systems.
  Object.assign(organisms, {
    "e coli": "Escherichia coli",
    "k pneumoniae": "Klebsiella pneumoniae",
    "k oxytoca": "Klebsiella oxytoca",
    "p mirabilis": "Proteus mirabilis",
    "c freundii": "Citrobacter freundii",
    "p aeruginosa": "Pseudomonas aeruginosa",
    "e faecalis": "Enterococcus faecalis",
    "s aureus": "Staphylococcus aureus",
    "s saprophyticus": "Staphylococcus saprophyticus",
  });

  const antibiotics: Record<string, AntibioticCode> = {};
  for (const a of ANTIBIOTICS) {
    antibiotics[a.code] = a.code;
    antibiotics[norm(a.code)] = a.code;
    antibiotics[norm(a.en)] = a.code;
    antibiotics[norm(a.fi)] = a.code;
  }
  // EUCAST: amoxicillin and ampicillin results are interchangeable; pivmecillinam is tested as mecillinam.
  Object.assign(antibiotics, {
    amoxicillin: "AMP",
    amoksisilliini: "AMP",
    pivmecillinam: "MEC",
    pivmesillinaami: "MEC",
    "piperacillin tazobactam": "TZP",
    cefoxitin: "FOX",
    "cefoxitin screen": "FOX",
    kefoksitiini: "FOX",
  });
  Object.assign(antibiotics, thlKeys<AntibioticCode>(THL_CODES.antimicrobials));

  const specimens: Record<string, Specimen> = {};
  for (const s of SPECIMENS) {
    specimens[norm(s.code)] = s.code;
    specimens[norm(s.en)] = s.code;
    specimens[norm(s.fi)] = s.code;
  }
  // HL7 v2 table 0487 specimen types and SNOMED CT specimen concepts.
  Object.assign(specimens, {
    ur: "urine",
    urine: "urine",
    urin: "urine",
    bld: "blood",
    bldv: "blood",
    bldc: "blood",
    "blood culture": "blood",
    veriviljely: "blood",
    wnd: "wound",
    wnda: "wound",
    wndd: "wound",
    "wound swab": "wound",
    haavanayte: "wound",
    [`${SNOMED}|122575003`]: "urine",
    [`${SNOMED}|119297000`]: "blood",
    [`${SNOMED}|258530009`]: "wound",
  } satisfies Record<string, Specimen>);

  const wards = wardCodeMap(WARDS);

  const phenotypes: Record<string, Phenotype> = {
    esbl: "esbl",
    mrsa: "mrsa",
    vre: "vre",
    cpe: "cpe",
    "carbapenemase producing": "cpe",
    karbapenemaasi: "cpe",
    "extended spectrum beta lactamase": "esbl",
  };
  return { organisms, antibiotics, specimens, wards, phenotypes };
}

/** A ward map from a list of units: each by its code and its Finnish and English names. */
export function wardCodeMap(wards: readonly Pick<Ward, "code" | "fi" | "en">[]): Record<string, WardCode> {
  const out: Record<string, WardCode> = {};
  for (const w of wards) {
    out[w.code] = w.code;
    out[norm(w.code)] = w.code;
    out[norm(w.en)] = w.code;
    out[norm(w.fi)] = w.code;
  }
  return out;
}

export const DEFAULT_CODE_MAPS: CodeMaps = defaults();

/** Defaults plus a site's own codes (keys as "system|code", a bare code, or display text). */
export function extendCodeMaps(extra: Partial<CodeMaps>, base: CodeMaps = DEFAULT_CODE_MAPS): CodeMaps {
  const normaliseKeys = <T>(m: Record<string, T> | undefined) =>
    Object.fromEntries(
      Object.entries(m ?? {}).flatMap(([k, v]) =>
        k.includes("|")
          ? [[k, v]]
          : [
              [k, v],
              [norm(k), v],
            ],
      ),
    );
  return {
    organisms: { ...base.organisms, ...normaliseKeys(extra.organisms) },
    antibiotics: { ...base.antibiotics, ...normaliseKeys(extra.antibiotics) },
    specimens: { ...base.specimens, ...normaliseKeys(extra.specimens) },
    wards: { ...base.wards, ...normaliseKeys(extra.wards) },
    phenotypes: { ...base.phenotypes, ...normaliseKeys(extra.phenotypes) },
    ...((extra.keepUnknownWards ?? base.keepUnknownWards) ? { keepUnknownWards: true } : {}),
  };
}

export const mapOrganism = (m: CodeMaps, c: readonly Coding[]) => lookup(m.organisms, c);
export const mapAntibiotic = (m: CodeMaps, c: readonly Coding[]) => lookup(m.antibiotics, c);
export const mapSpecimen = (m: CodeMaps, c: readonly Coding[]) => lookup(m.specimens, c);
/** The unit a location maps to; with `keepUnknownWards`, else the first code (or text) it was sent with. */
export const mapWard = (m: CodeMaps, c: readonly Coding[]): WardCode | undefined =>
  lookup(m.wards, c) ?? (m.keepUnknownWards ? (c.map((x) => (x.code ?? x.display ?? "").trim()).find((x) => x) ?? undefined) : undefined);
export const mapPhenotype = (m: CodeMaps, c: readonly Coding[]) => lookup(m.phenotypes, c);

/**
 * An interpretation as S or R. EUCAST "I" (susceptible, increased exposure,
 * since 2019) counts as S, since the antibiotic works at a higher dose (D-035);
 * "SDD" likewise. Anything else is undefined.
 */
export function interpretation(value: string | undefined): SR | undefined {
  const v = norm(value ?? "");
  if (["s", "i", "sdd", "susceptible", "sensitive", "herkka", "susceptible increased exposure"].includes(v)) return "S";
  if (["r", "resistant", "resistentti"].includes(v)) return "R";
  return undefined;
}

/** True for values reporting a finding as present (a phenotype test). */
export function isPositive(value: string | boolean | undefined): boolean {
  if (typeof value === "boolean") return value;
  return ["pos", "positive", "detected", "yes", "true", "y", "loydetty", "positiivinen", "1"].includes(norm(value ?? ""));
}

/** Texts meaning nothing grew. */
export function isNoGrowth(value: string | undefined): boolean {
  const v = norm(value ?? "");
  return ["no growth", "negative", "ei kasvua", "negatiivinen", "steriili"].includes(v);
}
