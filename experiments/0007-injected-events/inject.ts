// 0007: detector sensitivity on injected clusters and sampling gaps (README.md).
// Run from the repository root: node experiments/0007-injected-events/inject.ts

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { wilson } from "../../libs/utils/coverage/src/index.ts";
import { joinIsolates, loadDataset } from "../../libs/utils/dataset/src/index.ts";
import { LIVE_SETTINGS, phenotypeExcess, profileExcess, type Signal, samplingDrop } from "../../libs/utils/detect/src/index.ts";
import { type Culture, type IsolateRecord, WARDS, type WardCode } from "../../libs/utils/domain/src/index.ts";
import { addDays, daysBetween } from "../../libs/utils/replay/src/index.ts";

const DATA = "data/synthetic_microbiology_dataset";
const OUT = "experiments/0007-injected-events/out";
const TRIALS = 40;
const FIRST = "2024-10-01";
const LAST = "2026-08-15";

const data = await loadDataset(DATA);
const records = joinIsolates(data);
const UNITS = WARDS.map((w) => w.code);
const SIZE: Record<WardCode, "large" | "medium" | "small"> = {
  ED: "large",
  "PHC-N": "large",
  "PHC-S": "large",
  "MED-A": "medium",
  SURG: "medium",
  URO: "medium",
  GER: "medium",
  "MED-B": "small",
  ICU: "small",
};

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(2026);
const pickInt = (n: number) => Math.floor(rand() * n);
const pick = <T>(xs: readonly T[]) => xs[pickInt(xs.length)] as T;
const span = daysBetween(FIRST, LAST);

const near = (date: string, centre: string, days: number) => Math.abs(daysBetween(centre, date)) <= days;
function drawStart(unit: WardCode, avoid: [WardCode, string][]): string {
  for (;;) {
    const start = addDays(FIRST, pickInt(span + 1));
    if (!avoid.some(([u, c]) => u === unit && near(start, c, 45))) return start;
  }
}

// ---------- clusters ----------

const clones = records.filter(
  (r) =>
    ((r.organism === "Escherichia coli" || r.organism === "Klebsiella pneumoniae") && r.phenotypes.includes("esbl")) ||
    (r.organism === "Staphylococcus aureus" && r.phenotypes.includes("mrsa")),
);
const CLUSTER_AVOID: [WardCode, string][] = [
  ["URO", "2025-06-15"],
  ["ICU", "2026-03-15"],
];

interface Trial {
  setting: string;
  unit: WardCode;
  detected: boolean;
  delay: number | null;
}

function clusterTrial(k: number, t: number): Trial {
  const unit = pick(UNITS);
  const start = drawStart(unit, CLUSTER_AVOID);
  const source = pick(clones);
  const inpatient = WARDS.find((w) => w.code === unit)?.type === "in";
  const injected: IsolateRecord[] = Array.from({ length: k }, (_, i) => {
    const sampleDate = addDays(start, pickInt(14));
    return {
      ...source,
      isolateId: `INJ${t}-${i}-1`,
      cultureId: `INJ${t}-${i}`,
      patientId: `PINJ${t}-${i}`,
      sampleDate,
      admissionDate: inpatient ? addDays(sampleDate, -5) : null,
      ward: unit,
      sex: rand() < 0.5 ? "F" : "M",
    };
  });
  const from = addDays(start, -400);
  const to = addDays(start, 60);
  const around = records.filter((r) => r.sampleDate >= from && r.sampleDate <= to);
  const sameOrganism = [...around.filter((r) => r.organism === source.organism), ...injected];
  const sameUnit = [...around.filter((r) => r.ward === unit), ...injected];
  const signals: Signal[] = [
    ...profileExcess(sameOrganism, LIVE_SETTINGS.profileExcess),
    ...phenotypeExcess(sameUnit, ["esbl", "mrsa"], LIVE_SETTINGS.phenotypeExcess),
  ];
  const first = earliestMatch(
    signals.filter(
      (s) =>
        s.ward === unit &&
        (s.organism === source.organism || (s.phenotype !== undefined && source.phenotypes.includes(s.phenotype))) &&
        s.date >= start &&
        s.date <= addDays(start, 28),
    ),
  );
  // The first injected case, not the drawn start, is the event's onset.
  const onset = injected.map((r) => r.sampleDate).sort()[0] ?? start;
  return { setting: `cluster k = ${k}`, unit, detected: first !== null, delay: first ? Math.max(0, daysBetween(onset, first)) : null };
}

// ---------- sampling gaps ----------

const GAP_AVOID: [WardCode, string][] = [
  ["PHC-S", "2025-12-11"],
  ["MED-A", "2025-05-15"],
];

function gapTrial(days: number, halve: boolean): Trial {
  const unit = pick(UNITS);
  const start = drawStart(unit, GAP_AVOID);
  const end = addDays(start, days - 1);
  const from = addDays(start, -400);
  const to = addDays(start, 60);
  let flip = false;
  const kept: Culture[] = data.cultures.filter((c) => {
    if (c.ward !== unit || c.sampleDate < from || c.sampleDate > to) return false;
    if (c.sampleDate < start || c.sampleDate > end || days === 0) return true;
    if (!halve) return false;
    flip = !flip;
    return flip;
  });
  const first = earliestMatch(
    samplingDrop(kept, LIVE_SETTINGS.samplingDrop).filter((s) => s.ward === unit && s.date >= start && s.date <= addDays(start, 14)),
  );
  const setting = days === 0 ? "gap control (nothing removed)" : halve ? `half the cultures for ${days} d` : `no cultures for ${days} d`;
  return { setting, unit, detected: first !== null, delay: first ? daysBetween(start, first) : null };
}

function earliestMatch(signals: Signal[]): string | null {
  return signals.map((s) => s.date).sort()[0] ?? null;
}

// ---------- run ----------

const trials: Trial[] = [];
const t0 = performance.now();
let n = 0;
for (const k of [0, 2, 3, 4, 6]) for (let i = 0; i < TRIALS; i++) trials.push(clusterTrial(k, n++));
for (const [days, halve] of [
  [0, false],
  [2, false],
  [3, false],
  [5, false],
  [7, false],
  [7, true],
] as const)
  for (let i = 0; i < TRIALS; i++) trials.push(gapTrial(days, halve));
const seconds = ((performance.now() - t0) / 1000).toFixed(1);

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s[(s.length - 1) >> 1] as number) : null;
};
const rate = (ts: Trial[]) => {
  const k = ts.filter((t) => t.detected).length;
  const [lo, hi] = wilson(k, ts.length);
  return `${k}/${ts.length} (${Math.round(100 * lo)}–${Math.round(100 * hi)} %)`;
};
const settings = [...new Set(trials.map((t) => t.setting))];
const rows = settings.map((s) => {
  const ts = trials.filter((t) => t.setting === s);
  const delays = ts.filter((t) => t.delay !== null).map((t) => t.delay as number);
  const bySize = (["large", "medium", "small"] as const).map((z) => {
    const sub = ts.filter((t) => SIZE[t.unit] === z);
    return `${sub.filter((t) => t.detected).length}/${sub.length}`;
  });
  return [s, rate(ts), median(delays) ?? "–", delays.length ? `${Math.min(...delays)}–${Math.max(...delays)}` : "–", ...bySize];
});
const table = (head: string[], body: (string | number)[][]) =>
  [`| ${head.join(" | ")} |`, `|${head.map(() => "---").join("|")}|`, ...body.map((r) => `| ${r.join(" | ")} |`)].join("\n");
const md = `# 0007 results\n\n${TRIALS} trials per setting, seed 2026, live settings (D-020). Detection rate with a 95 % Wilson interval; delay in days from the first injected case (clusters) or the first missing day (gaps) to the first signal; large units ED, PHC-N, PHC-S; medium MED-A, SURG, URO, GER; small MED-B, ICU. Controls inject or remove nothing and show how often a matching signal appears by chance. All computed. Run time ${seconds} s.\n\n${table(["setting", "detected", "median delay", "delay range", "large units", "medium units", "small units"], rows)}\n`;
await mkdir(OUT, { recursive: true });
await writeFile(join(OUT, "results.md"), md);
console.log(md);
