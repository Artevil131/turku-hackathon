// Prints what the TypeScript gears compute on the full dataset, as JSON, for
// the parity tests in this directory (test_parity.py) to compare with the
// Python mirrors in libs/utils/py/aei. Run by the tests:
//   node libs/utils/py/tests/ts_dump.ts data/synthetic_microbiology_dataset
// The cluster and gap trials below copy experiments/0007's former inject.ts,
// so the Python port of its trial machinery (aei.inject) is checked against
// the original.

import { firstIsolates } from "../../counting/src/index.ts";
import { wilson } from "../../coverage/src/index.ts";
import { joinIsolates, loadDataset } from "../../dataset/src/index.ts";
import {
  cochranArmitageRising,
  emptyRun,
  episodes,
  fisherMidPGreater,
  hasAcquiredResistance,
  inDetectedCluster,
  LIVE_SETTINGS,
  liveSignals,
  normalUpper,
  type Pair,
  phenotypeExcess,
  poissonLower,
  poissonUpper,
  profileExcess,
  profileOf,
  profileRule,
  resistanceShift,
  risingTrend,
  type Signal,
  SURVEILLANCE_PAIRS,
  samplingDrop,
} from "../../detect/src/index.ts";
import { ANTIBIOTICS, type Culture, type IsolateRecord, PHENOTYPES, SPECIMENS, WARDS, type WardCode } from "../../domain/src/index.ts";
import { effectiveResult, suitsSpecimen } from "../../eucast/src/index.ts";
import { fitLogistic, predict } from "../../logistic/src/index.ts";
import { carrierArrivals, patientFlows, patientMoves, phenotypeTrails, trailLinks } from "../../relations/src/index.ts";
import { addDays, daysBetween } from "../../replay/src/index.ts";

const data = await loadDataset(process.argv[2] ?? "data/synthetic_microbiology_dataset");
const records = joinIsolates(data);
const ids = (rs: readonly IsolateRecord[]) => rs.map((r) => r.isolateId);
const eps = (ss: readonly Signal[]) =>
  episodes(ss).map((e) => ({ detector: e.detector, key: e.key, first: e.first.date, last: e.last.date, signals: e.signals }));

// ---------- 0007 trial machinery (copied from the former experiments/0007-injected-events/inject.ts) ----------

const FIRST = "2024-10-01";
const LAST = "2026-08-15";
const UNITS = WARDS.map((w) => w.code);
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clones = records.filter(
  (r) =>
    ((r.organism === "Escherichia coli" || r.organism === "Klebsiella pneumoniae") && r.phenotypes.includes("esbl")) ||
    (r.organism === "Staphylococcus aureus" && r.phenotypes.includes("mrsa")),
);
const CLUSTER_AVOID: [WardCode, string][] = [
  ["URO", "2025-06-15"],
  ["ICU", "2026-03-15"],
];
const GAP_AVOID: [WardCode, string][] = [
  ["PHC-S", "2025-12-11"],
  ["MED-A", "2025-05-15"],
];
function trials(seed: number) {
  const rand = mulberry32(seed);
  const pickInt = (n: number) => Math.floor(rand() * n);
  const pick = <T>(xs: readonly T[]) => xs[pickInt(xs.length)] as T;
  const span = daysBetween(FIRST, LAST);
  const near = (date: string, centre: string, days: number) => Math.abs(daysBetween(centre, date)) <= days;
  const drawStart = (unit: WardCode, avoid: [WardCode, string][]) => {
    for (;;) {
      const start = addDays(FIRST, pickInt(span + 1));
      if (!avoid.some(([u, c]) => u === unit && near(start, c, 45))) return start;
    }
  };
  const earliestMatch = (signals: Signal[]) => signals.map((s) => s.date).sort()[0] ?? null;
  const clusterTrial = (k: number, t: number) => {
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
    const signals: Signal[] = [
      ...profileExcess([...around.filter((r) => r.organism === source.organism), ...injected], LIVE_SETTINGS.profileExcess),
      ...phenotypeExcess([...around.filter((r) => r.ward === unit), ...injected], ["esbl", "mrsa"], LIVE_SETTINGS.phenotypeExcess),
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
    const onset = injected.map((r) => r.sampleDate).sort()[0] ?? start;
    return {
      setting: `cluster k = ${k}`,
      unit,
      detected: first !== null,
      delay: first ? Math.max(0, daysBetween(onset, first)) : null,
      first,
    };
  };
  const gapTrial = (days: number, halve: boolean) => {
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
    return { setting, unit, detected: first !== null, delay: first ? daysBetween(start, first) : null, first };
  };
  const out = [];
  let n = 0;
  for (const k of [0, 3, 6]) for (let i = 0; i < 2; i++) out.push(clusterTrial(k, n++));
  for (const [days, halve] of [
    [0, false],
    [3, false],
    [7, true],
  ] as const)
    for (let i = 0; i < 2; i++) out.push(gapTrial(days, halve));
  return out;
}

// ---------- the dump ----------

// Pairs that signal in experiments/0006, in every setting; the whole 66 series take Node about 15 s.
const PAIRS_BY_SETTING: Pair[] = SURVEILLANCE_PAIRS.filter((p) =>
  ["Escherichia coli|TMP", "Escherichia coli|CXM", "Klebsiella pneumoniae|CRO", "Pseudomonas aeruginosa|MEM"].includes(
    `${p.organism}|${p.antibiotic}`,
  ),
).flatMap((p) => [{ ...p }, { ...p, setting: "in" as const }, { ...p, setting: "out" as const }]);
const window = { from: "2025-01-01", to: "2025-06-30" };
const trails = phenotypeTrails(data.cultures, records);
const trailsWindowed = phenotypeTrails(data.cultures, records, { window, maxDays: 60, phenotype: "esbl" });
const logisticRows = records.filter((r) => r.results.CIP !== undefined).slice(0, 3000);
const logisticX = logisticRows.map((r) => [r.sex === "M" ? 1 : 0, (r.ageYears - 60) / 10, r.phenotypes.length > 0 ? 1 : 0]);
const logisticY = logisticRows.map((r) => (r.results.CIP === "R" ? 1 : 0) as 0 | 1);
const model = fitLogistic(logisticX, logisticY, { l2: 1 });

const live = liveSignals(records, data.cultures);
const clusters = live.filter((s) => s.detector === "profile-excess" || s.detector === "phenotype-excess"); // = clusterSignals(records)
const excess = profileExcess(records, { windowDays: 28, baselineDays: 365, alpha: 0.01, minObserved: 3 });
const out = {
  stats: {
    poissonUpper: [0, 1, 2, 3, 5, 9, 20].flatMap((k) => [0, 0.01, 0.4, 2.5, 11].map((m) => poissonUpper(k, m))),
    poissonLower: [0, 1, 2, 3, 5, 9, 20].flatMap((k) => [0, 0.01, 0.4, 2.5, 11].map((m) => poissonLower(k, m))),
    fisher: [
      [3, 2, 1, 40],
      [5, 20, 30, 400],
      [0, 3, 3, 0],
      [12, 3, 2, 300],
      [4, 0, 0, 50],
    ].map(([a, b, c, d]) => fisherMidPGreater(a as number, b as number, c as number, d as number)),
    normalUpper: [-3, -1, 0, 0.7, 2, 3.5, 6].map(normalUpper),
    trend: [
      [
        { events: 1, n: 10 },
        { events: 2, n: 10 },
        { events: 5, n: 12 },
      ],
      [
        { events: 0, n: 5 },
        { events: 0, n: 0 },
        { events: 3, n: 4 },
        { events: 9, n: 11 },
      ],
    ].map(cochranArmitageRising),
    wilson: [
      [0, 0],
      [0, 5],
      [3, 7],
      [40, 40],
      [123, 456],
    ].map(([k, n]) => wilson(k as number, n as number)),
  },
  eucast: {
    effective: records.map((r) =>
      ANTIBIOTICS.map((a) => `${effectiveResult(r, a.code).result ?? "-"}:${effectiveResult(r, a.code).basis}`).join(","),
    ),
    suits: SPECIMENS.flatMap((s) => ANTIBIOTICS.map((a) => suitsSpecimen(a.code, s.code))),
  },
  counting: {
    all: ids(firstIsolates(records)),
    period: ids(firstIsolates(records, { from: "2025-03-01", to: "2025-05-31" })),
  },
  detect: {
    profile: records.map(profileOf),
    acquired: records.map(hasAcquiredResistance),
    profileRule: profileRule(records, { minPatients: 3, windowDays: 14, hospitalOnsetOnly: true }),
    profileRule4: profileRule(records, { minPatients: 4, windowDays: 28, hospitalOnsetOnly: false }),
    profileExcess: excess,
    profileExcessSpecimen: profileExcess(records, { windowDays: 28, baselineDays: 365, alpha: 0.01, minObserved: 3, sameSpecimen: true }),
    phenotypeExcess: phenotypeExcess(records, PHENOTYPES, { windowDays: 28, baselineDays: 365, alpha: 0.01, minObserved: 2 }),
    samplingDrop: samplingDrop(data.cultures, { windowDays: 7, baselineDays: 56, alpha: 0.01 }),
    emptyRun: emptyRun(data.cultures, { baselineDays: 56, alpha: 0.05 }),
    resistanceShift: resistanceShift(records, SURVEILLANCE_PAIRS, {
      windowDays: 28,
      baselineDays: 336,
      stepDays: 7,
      alpha: 0.01,
      minResistant: 3,
    }),
    risingTrend: risingTrend(records, SURVEILLANCE_PAIRS, { binDays: 28, minBins: 13, alpha: 0.01 }),
    risingTrendBySetting: risingTrend(records, PAIRS_BY_SETTING, {
      ...LIVE_SETTINGS.risingTrend,
      alpha: 0.01,
      exclude: inDetectedCluster(clusters),
    }),
    episodes: eps(excess),
    liveSignals: live,
    liveEpisodes: eps(live),
  },
  relations: {
    moves: patientMoves(data.cultures),
    flows: patientFlows(data.cultures),
    flowsWindow: patientFlows(data.cultures, window),
    trails: trails.map((t) => ({ patientId: t.patientId, phenotype: t.phenotype, steps: t.steps })),
    trailsWindowed: trailsWindowed.map((t) => ({ patientId: t.patientId, phenotype: t.phenotype, steps: t.steps })),
    links: trailLinks(trails),
    linksWindow: trailLinks(trails, window),
    arrivals: carrierArrivals(trails),
    arrivalsWindow: carrierArrivals(trails, window),
  },
  logistic: {
    weights: model.weights,
    iterations: model.iterations,
    predictions: logisticX.slice(0, 50).map((x) => predict(model, x)),
  },
  format: (() => {
    const xs = [
      0,
      12.25,
      0.125,
      -0.00001,
      1e-7,
      4.3e-5,
      0.0012345,
      9.96,
      9.95,
      1 / 3,
      2.5,
      -2.5,
      0.5,
      -0.5,
      1.005,
      123456789.123,
      1e21,
      5e-7,
      1.25e-6,
      0.99999,
      100,
      7.5e-10,
      0.00095,
      2 / 3,
      1092 / 365.25,
    ];
    const rand = mulberry32(2026);
    return {
      xs,
      fixed1: xs.map((x) => x.toFixed(1)),
      fixed4: xs.map((x) => x.toFixed(4)),
      precision2: xs.map((x) => x.toPrecision(2)),
      exponential1: xs.map((x) => x.toExponential(1)),
      round: xs.map((x) => Math.round(x)),
      string: xs.map((x) => String(x)),
      mulberry32: Array.from({ length: 1000 }, rand),
    };
  })(),
  trials: Object.fromEntries([1, 7, 2026].map((seed) => [seed, trials(seed)])),
};
console.log(JSON.stringify(out));
