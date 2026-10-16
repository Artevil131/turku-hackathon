import type { Culture, IsolateRecord } from "@aei/domain";
import { type Pair, phenotypeExcess, profileExcess, risingTrend, type Signal, samplingDrop } from "./detectors.ts";

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
  risingTrend: { binDays: 28, minBins: 13, alpha: 0.001 },
} as const;

/** Every signal of the live detector set over a history; each depends only on samples up to its date. */
export function liveSignals(records: readonly IsolateRecord[], cultures: readonly Culture[]): Signal[] {
  return [
    ...profileExcess(records, LIVE_SETTINGS.profileExcess),
    ...phenotypeExcess(records, ["esbl", "mrsa", "vre", "cpe"], LIVE_SETTINGS.phenotypeExcess),
    ...samplingDrop(cultures, LIVE_SETTINGS.samplingDrop),
    ...risingTrend(records, SURVEILLANCE_PAIRS, LIVE_SETTINGS.risingTrend),
  ];
}
