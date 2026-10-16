// Writes the smoke-test fixture: a tiny dataset in the organisers' CSV format, enough for every screen
// to render without the real data (CI). Deterministic; rerun with `node apps/web/scripts/smoke-fixture/gen.mjs`.
// Rows obey the data checks of @aei/quality (D-038): ages from birth years, isolate counts, ward types,
// no susceptible results to intrinsic resistance, urine-only drugs on urine only.
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = dirname(fileURLToPath(import.meta.url));
const WARD_TYPE = { ED: "out", "MED-A": "in", URO: "in", ICU: "in", "PHC-N": "out" };
const WARDS = Object.keys(WARD_TYPE);

let seed = 7;
const rand = () => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
};
const pick = (xs) => xs[Math.floor(rand() * xs.length)];

function isoWeek(date) {
  const d = new Date(`${date}T00:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const year = d.getUTCFullYear();
  const first = new Date(Date.UTC(year, 0, 4));
  return [year, 1 + Math.round(((d - first) / 86400000 - 3 + ((first.getUTCDay() + 6) % 7)) / 7)];
}
const addDays = (date, n) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

// Susceptibility profiles per organism and specimen; R/S chosen per isolate, intrinsic pairs always R.
function results(organism, specimen, phen) {
  const urine = specimen === "urine";
  const r = (p) => (rand() < p ? "R" : "S");
  if (organism === "Escherichia coli") {
    const esbl = phen.esbl;
    return {
      AMP: r(0.5),
      TZP: r(0.05),
      CXM: esbl ? "R" : r(0.08),
      CRO: esbl ? "R" : r(0.05),
      CAZ: esbl ? "R" : r(0.04),
      MEM: "S",
      CIP: r(0.15),
      ...(urine ? { MEC: r(0.05), TMP: r(0.25), NIT: r(0.03) } : {}),
    };
  }
  if (organism === "Klebsiella pneumoniae") {
    const cpe = phen.cpe;
    return {
      AMP: "R",
      TZP: cpe ? "R" : r(0.1),
      CXM: cpe ? "R" : r(0.1),
      CRO: cpe ? "R" : r(0.08),
      CAZ: cpe ? "R" : r(0.08),
      MEM: cpe ? "R" : "S",
      CIP: r(0.1),
      ...(urine ? { TMP: r(0.2), NIT: r(0.3) } : {}),
    };
  }
  if (organism === "Enterococcus faecalis") {
    const amp = r(0.02);
    return { AMP: amp, TZP: amp, VAN: phen.vre ? "R" : "S", ...(urine ? { NIT: "S" } : {}) };
  }
  // Staphylococcus aureus
  return { FOX: phen.mrsa ? "R" : "S", CLI: r(0.1), VAN: "S", CIP: r(0.1) };
}

const patients = [];
const cultures = [];
const isolates = [];
const susceptibility = [];
let n = 0;
function culture({ date, ward, specimen, organism, phen = {}, negative = false }) {
  n += 1;
  const pid = `P${String(n).padStart(4, "0")}`;
  const birthYear = 1930 + Math.floor(rand() * 70);
  patients.push([pid, pick(["F", "M"]), birthYear, pick(["North", "South", "Centre"])]);
  const cid = `C${String(n).padStart(6, "0")}`;
  const [year, week] = isoWeek(date);
  const inpatient = WARD_TYPE[ward] === "in";
  const admission = inpatient ? addDays(date, -Math.floor(rand() * 6)) : "";
  const age = Number(date.slice(0, 4)) - birthYear;
  cultures.push([
    cid,
    pid,
    age,
    date,
    year,
    week,
    ward,
    WARD_TYPE[ward],
    admission,
    specimen,
    negative ? "negative" : "positive",
    negative ? 0 : 1,
  ]);
  if (negative) return;
  const iid = `${cid}-1`;
  isolates.push([
    iid,
    cid,
    1,
    organism,
    specimen === "urine" ? ">=10^5" : "",
    phen.esbl ? 1 : 0,
    phen.mrsa ? 1 : 0,
    phen.vre ? 1 : 0,
    phen.cpe ? 1 : 0,
  ]);
  for (const [code, res] of Object.entries(results(organism, specimen, phen))) susceptibility.push([iid, code, res, "EUCAST 2025"]);
}

// Twelve weeks of ordinary results, about four a day spread over five units.
const start = "2025-03-03";
for (let day = 0; day < 84; day++) {
  const date = addDays(start, day);
  for (let k = 0; k < 4; k++) {
    const ward = pick(WARDS);
    const specimen = ward === "ICU" ? pick(["blood", "urine", "wound"]) : rand() < 0.75 ? "urine" : pick(["blood", "wound"]);
    if (rand() < 0.35) {
      culture({ date, ward, specimen, negative: true });
      continue;
    }
    const organism =
      specimen === "urine"
        ? pick(["Escherichia coli", "Escherichia coli", "Escherichia coli", "Klebsiella pneumoniae", "Enterococcus faecalis"])
        : pick(["Escherichia coli", "Staphylococcus aureus", "Staphylococcus aureus", "Klebsiella pneumoniae"]);
    const phen = { esbl: organism === "Escherichia coli" && rand() < 0.06 };
    culture({ date, ward, specimen, organism, phen });
  }
}
// Events every screen can show: a CPE Klebsiella and an MRSA in the ICU, and an ESBL E. coli run in Urology.
culture({ date: "2025-05-12", ward: "ICU", specimen: "blood", organism: "Klebsiella pneumoniae", phen: { cpe: true, esbl: true } });
culture({ date: "2025-05-14", ward: "ICU", specimen: "wound", organism: "Staphylococcus aureus", phen: { mrsa: true } });
for (const d of ["2025-05-15", "2025-05-17", "2025-05-18", "2025-05-20", "2025-05-21"])
  culture({ date: d, ward: "URO", specimen: "urine", organism: "Escherichia coli", phen: { esbl: true } });

const csv = (header, rows) => `${[header, ...rows].map((r) => r.join(",")).join("\n")}\n`;
const order = (rows) => rows.sort((a, b) => (a[3] < b[3] ? -1 : a[3] > b[3] ? 1 : 0));
writeFileSync(join(DIR, "patients.csv"), csv(["patient_id", "sex", "birth_year", "home_area"], patients));
writeFileSync(
  join(DIR, "cultures.csv"),
  csv(
    [
      "culture_id",
      "patient_id",
      "age_years",
      "sample_date",
      "iso_year",
      "iso_week",
      "ward_code",
      "ward_type",
      "admission_date",
      "specimen",
      "result",
      "n_isolates",
    ],
    order(cultures),
  ),
);
writeFileSync(
  join(DIR, "isolates.csv"),
  csv(["isolate_id", "culture_id", "isolate_no", "organism", "quantity", "esbl", "mrsa", "vre", "cpe"], isolates),
);
writeFileSync(join(DIR, "susceptibility.csv"), csv(["isolate_id", "antibiotic_code", "result", "guideline"], susceptibility));
console.log(`${patients.length} patients, ${cultures.length} cultures, ${isolates.length} isolates, ${susceptibility.length} results`);
