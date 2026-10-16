// 0002: run candidate detectors over the whole dataset and score them on the
// planted events of 0001 (README.md).
// Run from the repository root: node experiments/0002-detectors-on-planted-events/sweep.ts

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { joinIsolates, loadDataset } from "../../libs/utils/dataset/src/index.ts";
import {
  type Episode,
  episodes,
  type Pair,
  phenotypeExcess,
  profileExcess,
  profileRule,
  resistanceShift,
  risingTrend,
  type Signal,
  samplingDrop,
} from "../../libs/utils/detect/src/index.ts";
import { PHENOTYPES } from "../../libs/utils/domain/src/index.ts";
import { daysBetween } from "../../libs/utils/replay/src/index.ts";

const DATA = "data/synthetic_microbiology_dataset";
const OUT = "experiments/0002-detectors-on-planted-events/out";
const YEARS = 1092 / 365.25;

const data = await loadDataset(DATA);
const records = joinIsolates(data);

const PAIRS: Pair[] = [
  { organism: "Escherichia coli", antibiotic: "AMP" },
  { organism: "Escherichia coli", antibiotic: "MEC", specimen: "urine" },
  { organism: "Escherichia coli", antibiotic: "TMP", specimen: "urine" },
  { organism: "Escherichia coli", antibiotic: "NIT", specimen: "urine" },
  { organism: "Escherichia coli", antibiotic: "CIP" },
  { organism: "Escherichia coli", antibiotic: "CXM" },
  { organism: "Escherichia coli", antibiotic: "CRO" },
  { organism: "Escherichia coli", antibiotic: "TZP" },
  { organism: "Escherichia coli", antibiotic: "MEM" },
  { organism: "Klebsiella pneumoniae", antibiotic: "CRO" },
  { organism: "Klebsiella pneumoniae", antibiotic: "CIP" },
  { organism: "Klebsiella pneumoniae", antibiotic: "TZP" },
  { organism: "Klebsiella pneumoniae", antibiotic: "MEM" },
  { organism: "Pseudomonas aeruginosa", antibiotic: "CAZ" },
  { organism: "Pseudomonas aeruginosa", antibiotic: "TZP" },
  { organism: "Pseudomonas aeruginosa", antibiotic: "MEM" },
  { organism: "Pseudomonas aeruginosa", antibiotic: "CIP" },
  { organism: "Staphylococcus aureus", antibiotic: "FOX" },
  { organism: "Staphylococcus aureus", antibiotic: "CLI" },
  { organism: "Enterococcus faecalis", antibiotic: "AMP" },
  { organism: "Enterococcus faecalis", antibiotic: "VAN" },
  { organism: "Proteus mirabilis", antibiotic: "CIP" },
];

// ---------- planted events (0001) ----------

interface PlantedEvent {
  id: string;
  label: string;
  start: string;
  matches: (e: Episode) => boolean;
}

const within = (date: string, from: string, to: string) => date >= from && date <= to;
const EVENTS: PlantedEvent[] = [
  {
    id: "E1",
    label: "Urology ESBL E. coli, from 2025-06-04",
    start: "2025-06-04",
    matches: (e) =>
      e.first.ward === "URO" &&
      within(e.first.date, "2025-06-04", "2025-08-31") &&
      (e.first.organism === "Escherichia coli" || e.first.phenotype === "esbl"),
  },
  {
    id: "E2",
    label: "ICU MRSA, from 2026-03-03",
    start: "2026-03-03",
    matches: (e) =>
      e.first.ward === "ICU" &&
      within(e.first.date, "2026-03-03", "2026-05-31") &&
      (e.first.organism === "Staphylococcus aureus" || e.first.phenotype === "mrsa"),
  },
  {
    id: "E3",
    label: "No samples at PHC-S, 2025-12-08 to 12-14",
    start: "2025-12-08",
    matches: (e) => e.detector === "sampling-drop" && e.first.ward === "PHC-S" && within(e.first.date, "2025-12-08", "2026-01-15"),
  },
  {
    id: "E4",
    label: "Urinary E. coli trimethoprim rising",
    start: "",
    matches: (e) => e.detector === "rising-trend" && e.key === "Escherichia coli|TMP|urine",
  },
];

// ---------- variants ----------

interface Variant {
  detector: string;
  setting: string;
  run: () => Signal[];
}

const ALPHAS = [0.01, 0.001, 0.0001];
const variants: Variant[] = [];
for (const minPatients of [3, 4])
  for (const windowDays of [14, 28])
    for (const hospitalOnsetOnly of [false, true])
      variants.push({
        detector: "1 profile rule",
        setting: `k ${minPatients}, ${windowDays} d, ${hospitalOnsetOnly ? "day 3+ only" : "all patients"}`,
        run: () => profileRule(records, { minPatients, windowDays, hospitalOnsetOnly }),
      });
for (const alpha of ALPHAS) {
  variants.push({
    detector: "2 profile excess",
    setting: `alpha ${alpha}`,
    run: () => profileExcess(records, { windowDays: 28, baselineDays: 365, alpha, minObserved: 3 }),
  });
}
for (const alpha of ALPHAS) {
  variants.push({
    detector: "2b profile excess, share within specimen",
    setting: `alpha ${alpha}`,
    run: () => profileExcess(records, { windowDays: 28, baselineDays: 365, alpha, minObserved: 3, sameSpecimen: true }),
  });
}
for (const alpha of ALPHAS) {
  variants.push({
    detector: "3 phenotype excess",
    setting: `alpha ${alpha}`,
    run: () => phenotypeExcess(records, PHENOTYPES, { windowDays: 28, baselineDays: 365, alpha, minObserved: 2 }),
  });
}
for (const alpha of ALPHAS) {
  variants.push({
    detector: "4 sampling drop",
    setting: `alpha ${alpha}`,
    run: () => samplingDrop(data.cultures, { windowDays: 7, baselineDays: 56, alpha }),
  });
}
for (const alpha of ALPHAS) {
  variants.push({
    detector: "5 resistance shift",
    setting: `alpha ${alpha}`,
    run: () => resistanceShift(records, PAIRS, { windowDays: 28, baselineDays: 336, stepDays: 7, alpha, minResistant: 3 }),
  });
}
for (const alpha of ALPHAS) {
  variants.push({
    detector: "6 rising trend",
    setting: `alpha ${alpha}`,
    run: () => risingTrend(records, PAIRS, { binDays: 28, minBins: 13, alpha }),
  });
}

// ---------- run and score ----------

const fmtP = (p: number | undefined) => (p === undefined ? "" : p < 1e-6 ? p.toExponential(1) : p.toPrecision(2));
const describe = (e: Episode) => {
  const s = e.first;
  const what = [s.organism, s.antibiotic, s.phenotype?.toUpperCase(), s.profile ? `\`${s.profile}\`` : undefined].filter(Boolean).join(" ");
  const value =
    s.detector === "resistance-shift" || s.detector === "rising-trend"
      ? `${Math.round(100 * s.observed)} % R${s.expected !== undefined ? ` vs ${Math.round(100 * s.expected)} %` : ""}`
      : `${s.observed}${s.expected !== undefined ? ` vs ${s.expected.toFixed(1)}` : ""}`;
  return [s.ward ?? "hospital", what, e.first.date, e.last.date, e.signals, value, fmtP(s.p)];
};

const summary: (string | number)[][] = [];
const details: string[] = [];
const t0 = performance.now();
for (const v of variants) {
  const eps = episodes(v.run());
  const hits = EVENTS.map((ev) => eps.filter(ev.matches));
  const matched = new Set(hits.flat());
  const other = eps.filter((e) => !matched.has(e));
  summary.push([
    v.detector,
    v.setting,
    ...hits.map((h, i) => {
      const first = h[0];
      if (!first) return "–";
      const ev = EVENTS[i] as PlantedEvent;
      return ev.start ? `${daysBetween(ev.start, first.first.date)} d` : first.first.date;
    }),
    other.length,
    (other.length / YEARS).toFixed(1),
  ]);
  details.push(
    `### ${v.detector}, ${v.setting}: ${other.length} other episodes\n\n` +
      table(
        ["unit", "about", "first signal", "last signal", "signals", "observed", "p"],
        other.slice(0, 40).map(describe),
      ) +
      (other.length > 40 ? `\n\n…and ${other.length - 40} more.` : "") +
      "\n",
  );
}
const seconds = ((performance.now() - t0) / 1000).toFixed(1);

function table(head: string[], rows: (string | number)[][]): string {
  return [`| ${head.join(" | ")} |`, `|${head.map(() => "---").join("|")}|`, ...rows.map((r) => `| ${r.join(" | ")} |`)].join("\n");
}

const head = ["detector", "setting", ...EVENTS.map((e) => `${e.id} delay`), "other episodes", "per year"];
await mkdir(OUT, { recursive: true });
await writeFile(
  join(OUT, "summary.md"),
  `# 0002 summary\n\nDelay: days from the event's start to the detector's first signal for it ("–": never). E4 has no start date, so its first signal date is shown. Other episodes: signal episodes (same detector and key, gaps of at most 28 days) that match no planted event, over ${YEARS.toFixed(2)} years. All computed.\n\n${EVENTS.map((e) => `- ${e.id}: ${e.label}`).join("\n")}\n\n${table(head, summary)}\n\nSweep time: ${seconds} s.\n`,
);
await writeFile(join(OUT, "other-episodes.md"), `# 0002 other episodes per variant\n\n${details.join("\n")}`);
console.log(table(head, summary));
console.log(`sweep ${seconds} s`);
