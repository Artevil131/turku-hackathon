import { parseCsv } from "@aei/dataset";
import type { AntibioticCode, Phenotype, Sex } from "@aei/domain";
import {
  type CodeMaps,
  DEFAULT_CODE_MAPS,
  interpretation,
  isPositive,
  mapAntibiotic,
  mapOrganism,
  mapPhenotype,
  mapSpecimen,
  mapWard,
} from "./codes.ts";
import { addCulture, type CultureInput, emptyResult, type IngestResult } from "./record.ts";

// A flat isolate export (D-035), the WHONET-style file labs already produce
// for surveillance: one row per isolate, culture and patient columns, an
// organism, phenotype flags, and one column per antibiotic holding S, I or R.
// Column names are matched loosely (English, Finnish, WHONET):
//   patient_id, sex, birth_year or birth_date, culture_id (or specimen_number),
//   sample_date (or spec_date), ward (or location), admission_date, specimen (or spec_type),
//   organism (or org), esbl / mrsa / vre / cpe, and antibiotic columns named by
//   WHONET code or name, with any WHONET method suffix ("AMP_ND10") ignored.
// Rows sharing a culture id form one culture with several isolates; a row with
// no organism is a culture where nothing grew.

const ALIASES: Record<string, string[]> = {
  patient: ["patient_id", "patient", "potilas", "patient_no"],
  sex: ["sex", "gender", "sukupuoli"],
  birthYear: ["birth_year", "syntymavuosi"],
  birthDate: ["birth_date", "date_birth", "syntymaaika"],
  culture: ["culture_id", "specimen_number", "spec_num", "sample_id", "nayte"],
  date: ["sample_date", "spec_date", "collection_date", "naytepvm"],
  ward: ["ward", "ward_code", "location", "osasto"],
  admission: ["admission_date", "date_admis", "tulopvm"],
  specimen: ["specimen", "spec_type", "naytetyyppi"],
  organism: ["organism", "org", "mikrobi"],
  quantity: ["quantity", "maara"],
};

export interface CsvOptions {
  maps?: CodeMaps;
  guideline?: string;
}

export function parseIsolateCsv(text: string, options: CsvOptions = {}): IngestResult {
  const maps = options.maps ?? DEFAULT_CODE_MAPS;
  const out = emptyResult();
  const rows = parseCsv(text);
  if (!rows.length) return out;
  const headers = Object.keys(rows[0] ?? {});
  const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9_]/g, "");
  const column = (role: string) => headers.find((h) => ALIASES[role]?.includes(norm(h)));
  const cols = Object.fromEntries(Object.keys(ALIASES).map((r) => [r, column(r)])) as Record<string, string | undefined>;
  const used = new Set(Object.values(cols).filter(Boolean));
  const antibioticCols = new Map<string, AntibioticCode>();
  const phenotypeCols = new Map<string, Phenotype>();
  for (const h of headers) {
    if (used.has(h)) continue;
    const ph = mapPhenotype(maps, [{ code: h }]);
    if (ph) {
      phenotypeCols.set(h, ph);
      continue;
    }
    const ab = mapAntibiotic(maps, [{ code: h.split("_")[0] }, { display: h }]);
    if (ab) antibioticCols.set(h, ab);
  }
  for (const role of ["patient", "sex", "culture", "date", "ward", "specimen"]) {
    if (!cols[role]) out.warnings.push(`no column for ${role} (accepted names: ${ALIASES[role]?.join(", ")})`);
  }
  if (!cols.birthYear && !cols.birthDate) out.warnings.push("no birth_year or birth_date column");

  const cultures = new Map<string, CultureInput>();
  rows.forEach((row, i) => {
    const get = (role: string) => (cols[role] ? (row[cols[role] as string] ?? "").trim() : "");
    const line = i + 2;
    const cultureId = get("culture");
    const sexRaw = get("sex").toUpperCase();
    const sex: Sex | undefined = sexRaw.startsWith("F") || sexRaw === "N" ? "F" : sexRaw.startsWith("M") ? "M" : undefined;
    const birthYear = Number(get("birthYear") || get("birthDate").slice(0, 4));
    const ward = mapWard(maps, [{ code: get("ward") }]);
    const specimen = mapSpecimen(maps, [{ code: get("specimen") }]);
    const sampleDate = get("date").slice(0, 10);
    const problems = [
      !cultureId && "culture id",
      !sex && `sex "${get("sex")}"`,
      !birthYear && "birth year",
      !ward && `ward "${get("ward")}"`,
      !specimen && `specimen "${get("specimen")}"`,
      !/^\d{4}-\d{2}-\d{2}$/.test(sampleDate) && `date "${get("date")}"`,
    ].filter(Boolean);
    if (problems.length || !sex || !ward || !specimen) {
      out.warnings.push(`row ${line}: skipped, no usable ${problems.join(", ")}`);
      return;
    }
    const culture =
      cultures.get(cultureId) ??
      ({
        cultureId,
        patientId: get("patient"),
        sex,
        birthYear,
        sampleDate,
        ward,
        admissionDate: get("admission").slice(0, 10) || null,
        specimen,
        isolates: [],
        ...(options.guideline ? { guideline: options.guideline } : {}),
      } satisfies CultureInput);
    cultures.set(cultureId, culture);
    const orgText = get("organism");
    if (!orgText) return;
    const organism = mapOrganism(maps, [{ code: orgText }]);
    if (!organism) {
      out.warnings.push(`row ${line}: organism "${orgText}" maps to nothing`);
      return;
    }
    const results: Partial<Record<AntibioticCode, "S" | "R">> = {};
    for (const [h, ab] of antibioticCols) {
      const sr = interpretation(row[h]);
      if (sr) results[ab] = sr;
    }
    const phenotypes = [...phenotypeCols].filter(([h]) => isPositive(row[h])).map(([, ph]) => ph);
    culture.isolates.push({ organism, phenotypes, results, quantity: get("quantity") || null });
  });
  for (const c of cultures.values()) addCulture(out, c);
  return out;
}
