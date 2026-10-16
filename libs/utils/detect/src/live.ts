import type { Culture, IsoDate, IsolateRecord } from "@aei/domain";
import { addDays } from "@aei/replay";
import { emptyRun, episodes, type Pair, phenotypeExcess, profileExcess, risingTrend, type Signal, samplingDrop } from "./detectors.ts";

// The detectors and thresholds the tool runs live (D-020): the best setting
// of each detector in experiments/0002, provisional until the team reviews
// that table. Together they caught every planted event at about 5 other
// signal episodes a year.

/** Organism, antibiotic and specimen pairs watched for slow trends (experiments/0001 and 0002). */
export const SURVEILLANCE_PAIRS: readonly Pair[] = [
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

export const LIVE_SETTINGS = {
  profileExcess: { windowDays: 28, baselineDays: 365, alpha: 0.0001, minObserved: 3, sameSpecimen: true },
  phenotypeExcess: { windowDays: 28, baselineDays: 365, alpha: 0.001, minObserved: 2 },
  samplingDrop: { windowDays: 7, baselineDays: 56, alpha: 0.0001 },
  emptyRun: { baselineDays: 56, alpha: 0.001 },
  risingTrend: { binDays: 28, minBins: 13, alpha: 0.001 },
} as const;

/**
 * Every signal of the live detector set over a history; each depends only on
 * samples up to its date. Isolates of a cluster already detected are left
 * out of the trend test from the day it was detected, so an outbreak raises
 * cluster alerts, not also a hospital-wide trend.
 */
export function liveSignals(records: readonly IsolateRecord[], cultures: readonly Culture[]): Signal[] {
  const clusters = clusterSignals(records);
  return [
    ...clusters,
    ...samplingDrop(cultures, LIVE_SETTINGS.samplingDrop),
    ...emptyRun(cultures, LIVE_SETTINGS.emptyRun),
    ...risingTrend(records, SURVEILLANCE_PAIRS, { ...LIVE_SETTINGS.risingTrend, exclude: inDetectedCluster(clusters) }),
  ];
}

/** Profile and phenotype excess signals of the live set. */
export function clusterSignals(records: readonly IsolateRecord[]): Signal[] {
  return [
    ...profileExcess(records, LIVE_SETTINGS.profileExcess),
    ...phenotypeExcess(records, ["esbl", "mrsa", "vre", "cpe"], LIVE_SETTINGS.phenotypeExcess),
  ];
}

/** True for an isolate inside a cluster episode already detected by `asOf`: its unit, organism or phenotype, and dates. */
export function inDetectedCluster(clusters: readonly Signal[]): (r: IsolateRecord, asOf: IsoDate) => boolean {
  const spans = episodes(clusters).map((e) => ({
    detected: e.first.date,
    from: addDays(e.first.date, 1 - LIVE_SETTINGS.profileExcess.windowDays),
    to: e.last.date,
    ward: e.first.ward,
    organism: e.first.organism,
    phenotype: e.first.phenotype,
  }));
  return (r: IsolateRecord, asOf: IsoDate) =>
    spans.some(
      (s) =>
        s.detected <= asOf &&
        r.ward === s.ward &&
        r.sampleDate >= s.from &&
        r.sampleDate <= s.to &&
        (s.organism ? r.organism === s.organism : s.phenotype ? r.phenotypes.includes(s.phenotype) : false),
    );
}
