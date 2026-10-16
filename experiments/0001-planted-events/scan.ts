// 0001: describe the dataset to look for planted events (README.md).
// Run from the repository root: node experiments/0001-planted-events/scan.ts
// Writes Markdown tables to experiments/0001-planted-events/out/.

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { joinIsolates, loadDataset } from "../../libs/utils/dataset/src/index.ts";
import { type AntibioticCode, type IsolateRecord, type Organism, PHENOTYPES, WARDS, type WardCode } from "../../libs/utils/domain/src/index.ts";
import { carrierArrivals, phenotypeTrails, trailLinks } from "../../libs/utils/relations/src/index.ts";
import { addDays, daysBetween } from "../../libs/utils/replay/src/index.ts";

const DATA = "data/synthetic_microbiology_dataset";
const OUT = "experiments/0001-planted-events/out";

const data = await loadDataset(DATA);
const records = joinIsolates(data);
const cultureById = new Map(data.cultures.map((c) => [c.cultureId, c]));
const UNITS = WARDS.map((w) => w.code);

// ---------- helpers ----------

const isoWeek = (date: string): string => {
  const c = data.cultures.find((x) => x.sampleDate === date);
  if (c) return `${c.isoYear}-W${String(c.isoWeek).padStart(2, "0")}`;
  const d = new Date(`${date}T00:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((d.getTime() - firstThursday.getTime()) / 86_400_000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
};
const weekOf = new Map<string, string>();
for (const c of data.cultures) weekOf.set(c.sampleDate, `${c.isoYear}-W${String(c.isoWeek).padStart(2, "0")}`);
const week = (date: string) => weekOf.get(date) ?? isoWeek(date);
const WEEKS = [...new Set(data.cultures.map((c) => week(c.sampleDate)))].sort();
const quarter = (date: string) => `${date.slice(0, 4)}-Q${Math.floor((Number(date.slice(5, 7)) - 1) / 3) + 1}`;

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length ? (s.length % 2 ? (s[m] as number) : ((s[m - 1] as number) + (s[m] as number)) / 2) : 0;
};
const pct = (k: number, n: number) => (n ? `${((100 * k) / n).toFixed(1)} % (${k}/${n})` : "–");
const table = (head: string[], rows: (string | number)[][]) =>
  [`| ${head.join(" | ")} |`, `|${head.map(() => "---").join("|")}|`, ...rows.map((r) => `| ${r.join(" | ")} |`)].join("\n");

function weekly(items: { date: string; unit: WardCode }[]): Map<string, Map<string, number>> {
  // unit (or "ALL") → week → count, every week present
  const out = new Map<string, Map<string, number>>();
  for (const u of [...UNITS, "ALL"]) out.set(u, new Map(WEEKS.map((w) => [w, 0])));
  for (const it of items) {
    const w = week(it.date);
    for (const u of [it.unit, "ALL"]) {
      const m = out.get(u) as Map<string, number>;
      m.set(w, (m.get(w) ?? 0) + 1);
    }
  }
  return out;
}

function seriesSummary(name: string, series: Map<string, Map<string, number>>): string {
  const rows = [...series.entries()].map(([unit, byWeek]) => {
    // Skip the partial first and last weeks of the dataset.
    const values = WEEKS.slice(1, -1).map((w) => [w, byWeek.get(w) ?? 0] as const);
    const counts = values.map(([, n]) => n);
    const med = median(counts);
    const sorted = [...values].sort((a, b) => b[1] - a[1]);
    const low = [...values].sort((a, b) => a[1] - b[1]);
    const zeros = counts.filter((n) => n === 0).length;
    return [
      unit,
      counts.reduce((a, b) => a + b, 0),
      med,
      sorted
        .slice(0, 3)
        .map(([w, n]) => `${w}: ${n}`)
        .join(", "),
      low
        .slice(0, 2)
        .map(([w, n]) => `${w}: ${n}`)
        .join(", "),
      zeros,
    ];
  });
  return `### ${name}\n\n${table(["unit", "total", "median / week", "highest weeks", "lowest weeks", "weeks with 0"], rows)}\n`;
}

// ---------- 1. weekly volumes and phenotype counts ----------

const positive = data.cultures.filter((c) => c.result !== "negative");
let s1 = "# 1. Weekly counts per unit\n\nAll weeks except the partial first and last. Counts are measured.\n\n";
s1 += seriesSummary(
  "Cultures",
  weekly(data.cultures.map((c) => ({ date: c.sampleDate, unit: c.ward }))),
);
s1 += seriesSummary(
  "Positive or mixed-growth cultures",
  weekly(positive.map((c) => ({ date: c.sampleDate, unit: c.ward }))),
);
s1 += seriesSummary(
  "Isolates",
  weekly(records.map((r) => ({ date: r.sampleDate, unit: r.ward }))),
);
for (const p of PHENOTYPES) {
  s1 += seriesSummary(
    `Isolates flagged ${p.toUpperCase()}`,
    weekly(records.filter((r) => r.phenotypes.includes(p)).map((r) => ({ date: r.sampleDate, unit: r.ward }))),
  );
}
// Positivity per quarter, a cheap check for a change in how samples were taken.
const posRows = [...new Set(data.cultures.map((c) => quarter(c.sampleDate)))].sort().map((q) => {
  const inQ = data.cultures.filter((c) => quarter(c.sampleDate) === q);
  return [q, inQ.length, pct(inQ.filter((c) => c.result !== "negative").length, inQ.length)];
});
s1 += `### Positivity per quarter, all units\n\n${table(["quarter", "cultures", "positive or mixed"], posRows)}\n`;

// ---------- 2. every CPE and VRE isolate ----------

let s2 = "# 2. Every CPE and VRE isolate\n\n";
for (const p of ["cpe", "vre"] as const) {
  const list = records.filter((r) => r.phenotypes.includes(p)).sort((a, b) => a.sampleDate.localeCompare(b.sampleDate));
  s2 += `### ${p.toUpperCase()}: ${list.length} isolates, ${new Set(list.map((r) => r.patientId)).size} patients (measured)\n\n`;
  s2 += table(
    ["date", "unit", "organism", "specimen", "patient", "stay day", "other flags"],
    list.map((r) => [
      r.sampleDate,
      r.ward,
      r.organism,
      r.specimen,
      r.patientId,
      r.admissionDate ? daysBetween(r.admissionDate, r.sampleDate) + 1 : "out",
      r.phenotypes.filter((x) => x !== p).join(", ") || "–",
    ]),
  );
  // Gaps between consecutive finds, per unit, to see bursts.
  const byUnit = new Map<WardCode, string[]>();
  for (const r of list) byUnit.set(r.ward, [...(byUnit.get(r.ward) ?? []), r.sampleDate]);
  s2 += `\n\nPer unit: ${[...byUnit.entries()]
    .map(([u, ds]) => {
      let maxIn28 = 0;
      for (let i = 0; i < ds.length; i++) maxIn28 = Math.max(maxIn28, ds.filter((d) => d >= (ds[i] as string) && d <= addDays(ds[i] as string, 27)).length);
      return `${u} ${ds.length} (most within 28 days: ${maxIn28})`;
    })
    .join("; ")}\n\n`;
}

// ---------- 3. resistance per year, quarter and around 1 January ----------

const PAIRS: [Organism, AntibioticCode, string | null][] = [
  ["Escherichia coli", "AMP", null],
  ["Escherichia coli", "MEC", "urine"],
  ["Escherichia coli", "TMP", "urine"],
  ["Escherichia coli", "NIT", "urine"],
  ["Escherichia coli", "CIP", null],
  ["Escherichia coli", "CXM", null],
  ["Escherichia coli", "CRO", null],
  ["Escherichia coli", "TZP", null],
  ["Escherichia coli", "MEM", null],
  ["Klebsiella pneumoniae", "CRO", null],
  ["Klebsiella pneumoniae", "CIP", null],
  ["Klebsiella pneumoniae", "TZP", null],
  ["Klebsiella pneumoniae", "MEM", null],
  ["Pseudomonas aeruginosa", "CAZ", null],
  ["Pseudomonas aeruginosa", "TZP", null],
  ["Pseudomonas aeruginosa", "MEM", null],
  ["Pseudomonas aeruginosa", "CIP", null],
  ["Staphylococcus aureus", "FOX", null],
  ["Staphylococcus aureus", "CLI", null],
  ["Enterococcus faecalis", "AMP", null],
  ["Enterococcus faecalis", "VAN", null],
  ["Proteus mirabilis", "CIP", null],
];

const tested = (o: Organism, a: AntibioticCode, specimen: string | null) =>
  records.filter((r) => r.organism === o && (!specimen || r.specimen === specimen) && r.results[a] !== undefined);
const rOf = (list: IsolateRecord[], a: AntibioticCode) => list.filter((r) => r.results[a] === "R").length;

const YEARS = ["2023", "2024", "2025", "2026"];
let s3 = "# 3. Resistance over time\n\nAll isolates, no first-isolate rule. Percentages are computed, counts measured.\n\n";
s3 += "### Per calendar year (2023 is Oct–Dec only, 2026 Jan–Sep)\n\n";
s3 += table(
  ["organism", "antibiotic", "specimen", ...YEARS],
  PAIRS.map(([o, a, sp]) => {
    const list = tested(o, a, sp);
    return [o, a, sp ?? "all", ...YEARS.map((y) => pct(rOf(list.filter((r) => r.sampleDate.startsWith(y)), a), list.filter((r) => r.sampleDate.startsWith(y)).length))];
  }),
);
s3 += "\n\n### Eight weeks before and after each 1 January (guideline version change)\n\n";
const BOUNDARIES = ["2024-01-01", "2025-01-01", "2026-01-01"];
s3 += table(
  ["organism", "antibiotic", "specimen", ...BOUNDARIES.flatMap((b) => [`before ${b.slice(0, 4)}`, `after ${b.slice(0, 4)}`])],
  PAIRS.map(([o, a, sp]) => {
    const list = tested(o, a, sp);
    return [
      o,
      a,
      sp ?? "all",
      ...BOUNDARIES.flatMap((b) => {
        const before = list.filter((r) => r.sampleDate >= addDays(b, -56) && r.sampleDate < b);
        const after = list.filter((r) => r.sampleDate >= b && r.sampleDate < addDays(b, 56));
        return [pct(rOf(before, a), before.length), pct(rOf(after, a), after.length)];
      }),
    ];
  }),
);

const QUARTERS = [...new Set(records.map((r) => quarter(r.sampleDate)))].sort();
s3 += "\n\n### Per quarter and unit, for the pairs most used empirically\n\n";
const UNIT_PAIRS: [Organism, AntibioticCode, string | null][] = [
  ["Escherichia coli", "CIP", null],
  ["Escherichia coli", "CRO", null],
  ["Escherichia coli", "TMP", "urine"],
  ["Klebsiella pneumoniae", "CRO", null],
  ["Staphylococcus aureus", "FOX", null],
];
for (const [o, a, sp] of UNIT_PAIRS) {
  const list = tested(o, a, sp);
  s3 += `\n#### ${o} · ${a}${sp ? ` · ${sp}` : ""} (% R, n)\n\n`;
  s3 += table(
    ["unit", ...QUARTERS],
    [...UNITS, "ALL"].map((u) => {
      const inU = u === "ALL" ? list : list.filter((r) => r.ward === u);
      return [
        u,
        ...QUARTERS.map((q) => {
          const inQ = inU.filter((r) => quarter(r.sampleDate) === q);
          return inQ.length ? `${Math.round((100 * rOf(inQ, a)) / inQ.length)} (${inQ.length})` : "–";
        }),
      ];
    }),
  );
  s3 += "\n";
}

// ---------- 4. identical profiles concentrated in a unit ----------

const ABX: AntibioticCode[] = ["AMP", "MEC", "TZP", "FOX", "CXM", "CRO", "CAZ", "MEM", "CIP", "TMP", "NIT", "VAN", "CLI"];
const profile = (r: IsolateRecord) => ABX.map((a) => r.results[a] ?? ".").join("");
const profileCount = new Map<string, number>();
for (const r of records) profileCount.set(`${r.organism}|${profile(r)}`, (profileCount.get(`${r.organism}|${profile(r)}`) ?? 0) + 1);

const groups = new Map<string, IsolateRecord[]>();
for (const r of records) {
  const key = `${r.ward}|${r.organism}|${profile(r)}`;
  groups.set(key, [...(groups.get(key) ?? []), r]);
}
const clusterRows: { unit: string; organism: string; profile: string; patients: number; start: string; overall: number; share: number; ha: number }[] = [];
for (const [key, list] of groups) {
  const [unit, organism, prof] = key.split("|") as [string, string, string];
  const sorted = list.sort((a, b) => a.sampleDate.localeCompare(b.sampleDate));
  let best = { patients: 0, start: "", ha: 0 };
  for (const first of sorted) {
    const inWin = sorted.filter((r) => r.sampleDate >= first.sampleDate && r.sampleDate <= addDays(first.sampleDate, 27));
    const patients = new Set(inWin.map((r) => r.patientId));
    if (patients.size > best.patients) {
      const ha = new Set(inWin.filter((r) => r.admissionDate && daysBetween(r.admissionDate, r.sampleDate) >= 2).map((r) => r.patientId)).size;
      best = { patients: patients.size, start: first.sampleDate, ha };
    }
  }
  const overall = profileCount.get(`${organism}|${prof}`) ?? 0;
  const ofOrganism = records.filter((r) => r.organism === organism).length;
  clusterRows.push({ unit, organism, profile: prof, patients: best.patients, start: best.start, overall, share: overall / ofOrganism, ha: best.ha });
}
let s4 = `# 4. Identical S/R profiles concentrated in one unit within 28 days\n\nProfile letters follow ${ABX.join(" ")}; "." is not tested. "share" is how common the profile is among all isolates of the organism (computed). Rows ranked by distinct patients among profiles held by under 5 % of the organism's isolates.\n\n`;
s4 += table(
  ["unit", "organism", "profile", "patients in 28 days", "from", "of them day 3+ of stay", "profile overall", "share"],
  clusterRows
    .filter((r) => r.share < 0.05 && r.patients >= 3)
    .sort((a, b) => b.patients - a.patients || a.share - b.share)
    .slice(0, 40)
    .map((r) => [r.unit, r.organism, `\`${r.profile}\``, r.patients, r.start, r.ha, r.overall, `${(100 * r.share).toFixed(2)} %`]),
);

// ---------- 5. carrier links ----------

const trails = phenotypeTrails(data.cultures, records);
const links = trailLinks(trails);
const arrivals = carrierArrivals(trails);
let s5 = `# 5. Carrier trails (D-012)\n\n${trails.length} trails, ${links.length} links, ${arrivals.length} carrier moves, ${arrivals.filter((a) => a.confirmed).length} confirmed in the new unit (computed).\n\n`;
s5 += table(
  ["from", "to", "phenotype", "patients", "confirmed"],
  links.slice(0, 15).map((l) => [l.from, l.to, l.phenotype, l.patients, l.confirmed]),
);
const perQuarter = QUARTERS.map((q) => [q, ...PHENOTYPES.map((p) => arrivals.filter((a) => a.phenotype === p && quarter(a.date) === q).length)]);
s5 += `\n\n### Carrier moves per quarter\n\n${table(["quarter", ...PHENOTYPES], perQuarter)}\n`;
// Do carriers stay carriers? Of patients with a phenotype found, how often is the same organism found again with it?
const again = PHENOTYPES.map((p) => {
  let later = 0;
  let still = 0;
  const byPatient = new Map<string, IsolateRecord[]>();
  for (const r of records) byPatient.set(r.patientId, [...(byPatient.get(r.patientId) ?? []), r]);
  for (const list of byPatient.values()) {
    const sorted = list.sort((a, b) => a.sampleDate.localeCompare(b.sampleDate));
    const firstFind = sorted.find((r) => r.phenotypes.includes(p));
    if (!firstFind) continue;
    const next = sorted.find((r) => r.sampleDate > firstFind.sampleDate && r.organism === firstFind.organism && daysBetween(firstFind.sampleDate, r.sampleDate) <= 90);
    if (!next) continue;
    later++;
    if (next.phenotypes.includes(p)) still++;
  }
  const base = records.filter((r) => r.phenotypes.includes(p)).length;
  const sameOrganisms = new Set(records.filter((r) => r.phenotypes.includes(p)).map((r) => r.organism));
  const baseDen = records.filter((r) => sameOrganisms.has(r.organism)).length;
  return [p, later, pct(still, later), pct(base, baseDen)];
});
s5 += `\n### Does a carrier's next isolate of the same organism (within 90 days) carry the phenotype again?\n\n${table(
  ["phenotype", "patients with a later isolate of the same organism", "carried again", "share among all isolates of those organisms"],
  again,
)}\n`;

await mkdir(OUT, { recursive: true });
await Promise.all([
  writeFile(join(OUT, "1-weekly.md"), s1),
  writeFile(join(OUT, "2-cpe-vre.md"), s2),
  writeFile(join(OUT, "3-resistance.md"), s3),
  writeFile(join(OUT, "4-profiles.md"), s4),
  writeFile(join(OUT, "5-carriers.md"), s5),
]);
console.log(`wrote ${OUT}: ${records.length} isolates, ${data.cultures.length} cultures, ${cultureById.size} culture ids`);
