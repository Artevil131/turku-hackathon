// 0005: do patient factors predict coverage better than the hospital's last
// year? (README.md). Run from the repository root:
//   node experiments/0005-patient-factors/backtest.ts

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { firstIsolates } from "../../libs/utils/counting/src/index.ts";
import { joinIsolates, loadDataset } from "../../libs/utils/dataset/src/index.ts";
import { ANTIBIOTICS, type AntibioticCode, type IsolateRecord, type Specimen } from "../../libs/utils/domain/src/index.ts";
import { effectiveResult, suitsSpecimen } from "../../libs/utils/eucast/src/index.ts";
import { fitLogistic, type LogisticModel, predict } from "../../libs/utils/logistic/src/index.ts";
import { addDays, daysBetween } from "../../libs/utils/replay/src/index.ts";

const DATA = "data/synthetic_microbiology_dataset";
const OUT = "experiments/0005-patient-factors/out";
const FIRST_TARGET = "2024-09-30";
const LAST_DAY = "2026-09-27";
const PERIOD = 28;
const TRAIN_PERIODS = 13;
const BOOTSTRAPS = 1000;
const SPECIMENS: Specimen[] = ["urine", "blood", "wound"];

const data = await loadDataset(DATA);
const records = joinIsolates(data);
const wardType = new Map(data.cultures.map((c) => [c.cultureId, c.wardType]));

// Outcome per isolate and antibiotic (as in 0004).
const outcome = new Map<string, Partial<Record<AntibioticCode, 0 | 1>>>();
for (const r of records) {
  const o: Partial<Record<AntibioticCode, 0 | 1>> = {};
  for (const a of ANTIBIOTICS) {
    if (!suitsSpecimen(a.code, r.specimen)) continue;
    const e = effectiveResult(r, a.code);
    if (e.basis === "untested") continue;
    o[a.code] = e.result === "S" ? 1 : 0;
  }
  outcome.set(r.isolateId, o);
}

// Each patient's isolates in date order, for the earlier-findings features.
const byPatient = new Map<string, IsolateRecord[]>();
for (const r of records) byPatient.set(r.patientId, [...(byPatient.get(r.patientId) ?? []), r]);
for (const list of byPatient.values()) list.sort((a, b) => a.sampleDate.localeCompare(b.sampleDate));

const earlier = (r: IsolateRecord) =>
  (byPatient.get(r.patientId) ?? []).filter((e) => e.sampleDate < r.sampleDate && daysBetween(e.sampleDate, r.sampleDate) <= 365);

type Model = "A all" | "B earlier resistance" | "C demographics and stay";
const MODELS: Model[] = ["A all", "B earlier resistance", "C demographics and stay"];
const FEATURE_NAMES: Record<Model, string[]> = {
  "A all": ["male", "age (per decade)", "inpatient", "day 3+ of stay", "earlier isolate not covered", "earlier ESBL/MRSA/VRE/CPE"],
  "B earlier resistance": ["earlier isolate not covered", "earlier ESBL/MRSA/VRE/CPE"],
  "C demographics and stay": ["male", "age (per decade)", "inpatient", "day 3+ of stay"],
};

function features(r: IsolateRecord, a: AntibioticCode): Record<Model, number[]> {
  const prior = earlier(r);
  const notCovered = prior.some((e) => outcome.get(e.isolateId)?.[a] === 0) ? 1 : 0;
  const flagged = prior.some((e) => e.phenotypes.length > 0) ? 1 : 0;
  const male = r.sex === "M" ? 1 : 0;
  const age = (r.ageYears - 60) / 10;
  const inpatient = wardType.get(r.cultureId) === "in" ? 1 : 0;
  const onset = r.admissionDate && daysBetween(r.admissionDate, r.sampleDate) >= 2 ? 1 : 0;
  return {
    "A all": [male, age, inpatient, onset, notCovered, flagged],
    "B earlier resistance": [notCovered, flagged],
    "C demographics and stay": [male, age, inpatient, onset],
  };
}

// First isolates per 28-day period on a grid that ends each period just before a target window.
const periodStart = (i: number) => addDays(FIRST_TARGET, PERIOD * i);
const periods = new Map<number, IsolateRecord[]>();
const periodOf = (i: number) => {
  let p = periods.get(i);
  if (!p) {
    const from = periodStart(i);
    const to = addDays(from, PERIOD - 1);
    p = firstIsolates(
      records.filter((r) => r.sampleDate >= from && r.sampleDate <= to),
      { from, to },
    );
    periods.set(i, p);
  }
  return p;
};
const featureCache = new Map<string, Record<Model, number[]>>();
const featuresOf = (r: IsolateRecord, a: AntibioticCode) => {
  const k = `${r.isolateId}|${a}`;
  let f = featureCache.get(k);
  if (!f) {
    f = features(r, a);
    featureCache.set(k, f);
  }
  return f;
};

function fitAll(trainPeriods: number[]): Map<string, Record<Model, LogisticModel> & { pHosp: number }> {
  const rows = trainPeriods.flatMap(periodOf);
  const fits = new Map<string, Record<Model, LogisticModel> & { pHosp: number }>();
  for (const specimen of SPECIMENS) {
    for (const ab of ANTIBIOTICS) {
      if (!suitsSpecimen(ab.code, specimen)) continue;
      const train = rows.filter((r) => r.specimen === specimen && outcome.get(r.isolateId)?.[ab.code] !== undefined);
      if (train.length === 0) continue;
      const y = train.map((r) => outcome.get(r.isolateId)?.[ab.code] as 0 | 1);
      const entry = { pHosp: y.reduce<number>((s, v) => s + v, 0) / y.length } as Record<Model, LogisticModel> & { pHosp: number };
      for (const m of MODELS) entry[m] = fitLogistic(
          train.map((r) => featuresOf(r, ab.code)[m]),
          y,
          { l2: 1 },
        );
      fits.set(`${specimen}|${ab.code}`, entry);
    }
  }
  return fits;
}

const NAMES = ["baseline: hospital 365 d", ...MODELS.map((m) => `logistic ${m}`)];
interface Acc {
  brier: number[];
  logloss: number[];
  n: number;
}
const perWindow: Acc[] = [];
const clip = (p: number) => Math.min(0.999, Math.max(0.001, p));
let unconverged = 0;
let fits = 0;

for (let j = 0; addDays(periodStart(j), PERIOD - 1) <= LAST_DAY; j++) {
  const models = fitAll(Array.from({ length: TRAIN_PERIODS }, (_, k) => j - TRAIN_PERIODS + k));
  for (const e of models.values())
    for (const m of MODELS) {
      fits++;
      if (!e[m].converged) unconverged++;
    }
  const acc: Acc = { brier: NAMES.map(() => 0), logloss: NAMES.map(() => 0), n: 0 };
  for (const r of periodOf(j)) {
    for (const [a, y] of Object.entries(outcome.get(r.isolateId) ?? {}) as [AntibioticCode, 0 | 1][]) {
      const fit = models.get(`${r.specimen}|${a}`);
      if (!fit) continue;
      const f = featuresOf(r, a);
      const ps = [fit.pHosp, ...MODELS.map((m) => predict(fit[m], f[m]))];
      acc.n++;
      ps.forEach((p, i) => {
        acc.brier[i] = (acc.brier[i] as number) + (p - y) ** 2;
        acc.logloss[i] = (acc.logloss[i] as number) - Math.log(y ? clip(p) : 1 - clip(p));
      });
    }
  }
  perWindow.push(acc);
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const table = (head: string[], rows: (string | number)[][]) =>
  [`| ${head.join(" | ")} |`, `|${head.map(() => "---").join("|")}|`, ...rows.map((r) => `| ${r.join(" | ")} |`)].join("\n");

function summarise(metric: "brier" | "logloss") {
  const total = (ws: Acc[], i: number) => ws.reduce((s, w) => s + (w[metric][i] as number), 0) / ws.reduce((s, w) => s + w.n, 0);
  const rand = mulberry32(2026);
  const diffs: number[][] = NAMES.map(() => []);
  for (let b = 0; b < BOOTSTRAPS; b++) {
    const sample = perWindow.map(() => perWindow[Math.floor(rand() * perWindow.length)] as Acc);
    const base = total(sample, 0);
    NAMES.forEach((_, i) => diffs[i]?.push(total(sample, i) - base));
  }
  const q = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.floor(p * (xs.length - 1))] as number;
  const base = total(perWindow, 0);
  return NAMES.map((name, i) => {
    const v = total(perWindow, i);
    const d = diffs[i] as number[];
    return [name, v.toFixed(4), (v - base).toFixed(4), i === 0 ? "–" : `${q(d, 0.025).toFixed(4)} to ${q(d, 0.975).toFixed(4)}`];
  });
}

// Odds ratios of model A fitted on the last 13 periods of data.
const lastJ = perWindow.length - 1;
const finalFits = fitAll(Array.from({ length: TRAIN_PERIODS }, (_, k) => lastJ - TRAIN_PERIODS + 1 + k));
const orRows: (string | number)[][] = [];
for (const [key, e] of finalFits) {
  const [specimen, a] = key.split("|") as [Specimen, AntibioticCode];
  const w = e["A all"].weights;
  orRows.push([
    specimen,
    a,
    `${Math.round(100 * e.pHosp)} %`,
    ...FEATURE_NAMES["A all"].map((_, k) => Math.exp(-(w[k + 1] as number)).toFixed(2)),
  ]);
}

const n = perWindow.reduce((s, w) => s + w.n, 0);
let md = `# 0005 results\n\nTarget windows: ${perWindow.length}; predictions: ${n}; model fits: ${fits}, not converged: ${unconverged}. Lower is better; difference to the baseline with a 95 % interval from ${BOOTSTRAPS} bootstrap resamples of target windows (seed 2026). All computed.\n\n`;
md += `### Brier score\n\n${table(["model", "mean", "minus baseline", "95 % interval"], summarise("brier"))}\n\n`;
md += `### Log loss\n\n${table(["model", "mean", "minus baseline", "95 % interval"], summarise("logloss"))}\n\n`;
md += `### Odds ratios for NOT being covered, model A, fitted on the last ${TRAIN_PERIODS * PERIOD} days (penalised, so shrunk toward 1)\n\n`;
md += `${table(["specimen", "antibiotic", "covered (hospital)", ...FEATURE_NAMES["A all"]], orRows)}\n`;
await mkdir(OUT, { recursive: true });
await writeFile(join(OUT, "results.md"), md);
console.log(md);
