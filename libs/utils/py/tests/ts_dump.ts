// Prints what the TypeScript gears the app runs compute on the full dataset,
// as JSON, for the parity tests in this directory (test_parity.py) to compare
// with their Python mirrors in libs/utils/py/aei. Python-only analysis code
// has no TypeScript copy and is not compared here (D-032). Run by the tests:
//   node libs/utils/py/tests/ts_dump.ts data/synthetic_microbiology_dataset

import { firstIsolates } from "../../counting/src/index.ts";
import { wilson } from "../../coverage/src/index.ts";
import { joinIsolates, loadDataset } from "../../dataset/src/index.ts";
import {
  cochranArmitageRising,
  emptyRun,
  episodes,
  hasAcquiredResistance,
  liveSignals,
  normalUpper,
  phenotypeExcess,
  poissonLower,
  poissonUpper,
  profileExcess,
  profileOf,
  risingTrend,
  type Signal,
  SURVEILLANCE_PAIRS,
  samplingDrop,
} from "../../detect/src/index.ts";
import { ANTIBIOTICS, type IsolateRecord, PHENOTYPES, SPECIMENS } from "../../domain/src/index.ts";
import { effectiveResult, suitsSpecimen } from "../../eucast/src/index.ts";
import { carrierArrivals, countFlows, patientMoves, phenotypeTrails, trailLinks } from "../../relations/src/index.ts";

const data = await loadDataset(process.argv[2] ?? "data/synthetic_microbiology_dataset");
const records = joinIsolates(data);
const ids = (rs: readonly IsolateRecord[]) => rs.map((r) => r.isolateId);
const eps = (ss: readonly Signal[]) =>
  episodes(ss).map((e) => ({ detector: e.detector, key: e.key, first: e.first.date, last: e.last.date, signals: e.signals }));

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- the dump ----------

const window = { from: "2025-01-01", to: "2025-06-30" };
const trails = phenotypeTrails(data.cultures, records);
const trailsWindowed = phenotypeTrails(data.cultures, records, { window, maxDays: 60, phenotype: "esbl" });
const live = liveSignals(records, data.cultures);
const excess = profileExcess(records, { windowDays: 28, baselineDays: 365, alpha: 0.01, minObserved: 3 });
const out = {
  stats: {
    poissonUpper: [0, 1, 2, 3, 5, 9, 20].flatMap((k) => [0, 0.01, 0.4, 2.5, 11].map((m) => poissonUpper(k, m))),
    poissonLower: [0, 1, 2, 3, 5, 9, 20].flatMap((k) => [0, 0.01, 0.4, 2.5, 11].map((m) => poissonLower(k, m))),
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
    profileExcess: excess,
    profileExcessSpecimen: profileExcess(records, { windowDays: 28, baselineDays: 365, alpha: 0.01, minObserved: 3, sameSpecimen: true }),
    phenotypeExcess: phenotypeExcess(records, PHENOTYPES, { windowDays: 28, baselineDays: 365, alpha: 0.01, minObserved: 2 }),
    samplingDrop: samplingDrop(data.cultures, { windowDays: 7, baselineDays: 56, alpha: 0.01 }),
    emptyRun: emptyRun(data.cultures, { baselineDays: 56, alpha: 0.05 }),
    risingTrend: risingTrend(records, SURVEILLANCE_PAIRS, { binDays: 28, minBins: 13, alpha: 0.01 }),
    episodes: eps(excess),
    liveSignals: live,
    liveEpisodes: eps(live),
  },
  relations: {
    moves: patientMoves(data.cultures),
    flows: countFlows(patientMoves(data.cultures)),
    flowsWindow: countFlows(patientMoves(data.cultures), window),
    trails: trails.map((t) => ({ patientId: t.patientId, phenotype: t.phenotype, steps: t.steps })),
    trailsWindowed: trailsWindowed.map((t) => ({ patientId: t.patientId, phenotype: t.phenotype, steps: t.steps })),
    links: trailLinks(trails),
    linksWindow: trailLinks(trails, window),
    arrivals: carrierArrivals(trails),
    arrivalsWindow: carrierArrivals(trails, window),
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
};
console.log(JSON.stringify(out));
