// 0003: backtest coverage estimators on the next 28 days (README.md).
// Run from the repository root: node experiments/0003-coverage-estimators/backtest.ts

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { firstIsolates } from "../../libs/utils/counting/src/index.ts";
import { joinIsolates, loadDataset } from "../../libs/utils/dataset/src/index.ts";
import { ANTIBIOTICS, type AntibioticCode, type IsolateRecord } from "../../libs/utils/domain/src/index.ts";
import { effectiveResult, suitsSpecimen } from "../../libs/utils/eucast/src/index.ts";
import { addDays } from "../../libs/utils/replay/src/index.ts";

const DATA = "data/synthetic_microbiology_dataset";
const OUT = "experiments/0003-coverage-estimators/out";
const FIRST_TARGET = "2024-09-30";
const LAST_DAY = "2026-09-27";
const SHRINK_YEAR = 20;
const SHRINK_MONTH = [5, 20, 50];
const BOOTSTRAPS = 1000;

const records = joinIsolates(await loadDataset(DATA));

// Covered (1), not covered (0) or unknown (undefined) for each isolate and antibiotic.
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

type Counts = Map<string, { k: number; n: number }>;
function tally(list: readonly IsolateRecord[], cellOf: (r: IsolateRecord, a: AntibioticCode) => string): Counts {
  const m: Counts = new Map();
  for (const r of list) {
    for (const [a, y] of Object.entries(outcome.get(r.isolateId) ?? {}) as [AntibioticCode, 0 | 1][]) {
      const key = cellOf(r, a);
      const c = m.get(key) ?? { k: 0, n: 0 };
      c.k += y;
      c.n += 1;
      m.set(key, c);
    }
  }
  return m;
}
const unitCell = (r: IsolateRecord, a: AntibioticCode) => `${r.ward}|${r.specimen}|${a}`;
const hospCell = (r: IsolateRecord, a: AntibioticCode) => `${r.specimen}|${a}`;
const inRange = (from: string, to: string) => records.filter((r) => r.sampleDate >= from && r.sampleDate <= to);

const ESTIMATORS = [
  "1 unit 28 d raw",
  "2 unit 365 d raw",
  "3 hospital 365 d (baseline)",
  "4 hospital 28 d",
  `5 unit 365 d shrunk to hospital (M ${SHRINK_YEAR})`,
  ...SHRINK_MONTH.map((m) => `6 unit 28 d shrunk to 5 (M ${m})`),
];
const BASE = 2;

interface Acc {
  brier: number[];
  logloss: number[];
  n: number;
}
type Subset = "all" | "small" | "no URO";
const SUBSETS: Subset[] = ["all", "small", "no URO"];
// window → subset → accumulators
const perWindow: Record<Subset, Acc>[] = [];
let fallbacks1 = 0;
let fallbacks2 = 0;
let predictions = 0;

const clip = (p: number) => Math.min(0.999, Math.max(0.001, p));
const ratio = (c: { k: number; n: number } | undefined) => (c && c.n > 0 ? c.k / c.n : undefined);

for (let start = FIRST_TARGET; addDays(start, 27) <= LAST_DAY; start = addDays(start, 28)) {
  const end = addDays(start, 27);
  const target = firstIsolates(inRange(start, end), { from: start, to: end });
  const f28 = firstIsolates(inRange(addDays(start, -28), addDays(start, -1)), { from: addDays(start, -28), to: addDays(start, -1) });
  const f365 = firstIsolates(inRange(addDays(start, -365), addDays(start, -1)), { from: addDays(start, -365), to: addDays(start, -1) });
  const u28 = tally(f28, unitCell);
  const u365 = tally(f365, unitCell);
  const h28 = tally(f28, hospCell);
  const h365 = tally(f365, hospCell);

  const acc = Object.fromEntries(
    SUBSETS.map((s) => [s, { brier: ESTIMATORS.map(() => 0), logloss: ESTIMATORS.map(() => 0), n: 0 }]),
  ) as Record<Subset, Acc>;
  for (const r of target) {
    for (const [a, y] of Object.entries(outcome.get(r.isolateId) ?? {}) as [AntibioticCode, 0 | 1][]) {
      const uc = unitCell(r, a);
      const hc = hospCell(r, a);
      const pHosp = ratio(h365.get(hc)) ?? 0.5;
      const c28 = u28.get(uc) ?? { k: 0, n: 0 };
      const c365 = u365.get(uc) ?? { k: 0, n: 0 };
      const p5 = (c365.k + SHRINK_YEAR * pHosp) / (c365.n + SHRINK_YEAR);
      if (c28.n === 0) fallbacks1++;
      if (c365.n === 0) fallbacks2++;
      predictions++;
      const ps = [
        ratio(c28) ?? pHosp,
        ratio(c365) ?? pHosp,
        pHosp,
        ratio(h28.get(hc)) ?? pHosp,
        p5,
        ...SHRINK_MONTH.map((m) => (c28.k + m * p5) / (c28.n + m)),
      ];
      const subsets: Subset[] = ["all"];
      if (c28.n < 30) subsets.push("small");
      if (r.ward !== "URO") subsets.push("no URO");
      for (const s of subsets) {
        const A = acc[s];
        A.n++;
        ps.forEach((p, i) => {
          A.brier[i] = (A.brier[i] as number) + (p - y) ** 2;
          A.logloss[i] = (A.logloss[i] as number) - Math.log(y ? clip(p) : 1 - clip(p));
        });
      }
    }
  }
  perWindow.push(acc);
}

// Seeded bootstrap over target windows.
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function summarise(subset: Subset, metric: "brier" | "logloss") {
  const total = (ws: Record<Subset, Acc>[], i: number) => {
    const n = ws.reduce((s, w) => s + w[subset].n, 0);
    return n ? ws.reduce((s, w) => s + (w[subset][metric][i] as number), 0) / n : Number.NaN;
  };
  const rand = mulberry32(2026);
  const diffs: number[][] = ESTIMATORS.map(() => []);
  for (let b = 0; b < BOOTSTRAPS; b++) {
    const sample = perWindow.map(() => perWindow[Math.floor(rand() * perWindow.length)] as Record<Subset, Acc>);
    const base = total(sample, BASE);
    ESTIMATORS.forEach((_, i) => diffs[i]?.push(total(sample, i) - base));
  }
  const q = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.floor(p * (xs.length - 1))] as number;
  const base = total(perWindow, BASE);
  return ESTIMATORS.map((name, i) => {
    const v = total(perWindow, i);
    const d = diffs[i] as number[];
    return [name, v.toFixed(4), (v - base).toFixed(4), i === BASE ? "–" : `${q(d, 0.025).toFixed(4)} to ${q(d, 0.975).toFixed(4)}`];
  });
}

function table(head: string[], rows: (string | number)[][]): string {
  return [`| ${head.join(" | ")} |`, `|${head.map(() => "---").join("|")}|`, ...rows.map((r) => `| ${r.join(" | ")} |`)].join("\n");
}

let md = "# 0003 results\n\nLower is better. Difference to the baseline (estimator 3) with a 95 % interval from 1,000 bootstrap resamples of target windows (seed 2026). All computed.\n\n";
md += `Target windows: ${perWindow.length}; predictions (first isolate × antibiotic): ${predictions}. Unit 28-day cell empty (raw estimator 1 fell back to the baseline): ${((100 * fallbacks1) / predictions).toFixed(1)} %; unit 365-day cell empty: ${((100 * fallbacks2) / predictions).toFixed(1)} %.\n\n`;
for (const subset of SUBSETS) {
  const n = perWindow.reduce((s, w) => s + w[subset].n, 0);
  for (const metric of ["brier", "logloss"] as const) {
    md += `### ${subset === "all" ? "All cells" : subset === "small" ? "Cells with under 30 first isolates in the unit's last 28 days" : "All units except Urology"} · ${metric === "brier" ? "Brier score" : "log loss"} (n = ${n})\n\n`;
    md += `${table(["estimator", "mean", "minus baseline", "95 % interval"], summarise(subset, metric))}\n\n`;
  }
}
await mkdir(OUT, { recursive: true });
await writeFile(join(OUT, "results.md"), md);
console.log(md);
