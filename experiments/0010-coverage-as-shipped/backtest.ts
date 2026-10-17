// 0010: runs the shipped coverage list (@aei/coverage) month by month and records what the next month's
// patients grew (README.md). Writes out/rows.json for analysis.py.
//   node experiments/0010-coverage-as-shipped/backtest.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { firstIsolates } from "../../libs/utils/counting/src/index.ts";
import {
  type CoverageResult,
  coverage,
  IV_ONLY,
  type Severity,
  suggest,
  suggestCombinations,
} from "../../libs/utils/coverage/src/index.ts";
import { joinIsolates, loadDataset } from "../../libs/utils/dataset/src/index.ts";
import type { AntibioticCode } from "../../libs/utils/domain/src/index.ts";

// WHO AWaRe (2023) as @aei/coverage exported it when this experiment ran (2cc7d33, D-026); the gear dropped it in
// 729f327 (D-050, D-056). Kept here so the record's `aware` column and analysis.py's Access shares still mean what
// they meant; the suggestion order itself is the live gear's.
const AWARE: Record<AntibioticCode, "Access" | "Watch"> = {
  AMP: "Access",
  MEC: "Access",
  TMP: "Access",
  NIT: "Access",
  CLI: "Access",
  TZP: "Watch",
  FOX: "Watch",
  CXM: "Watch",
  CRO: "Watch",
  CAZ: "Watch",
  MEM: "Watch",
  CIP: "Watch",
  VAN: "Watch",
};
import { type AntibioticCode, type IsolateRecord, SPECIMENS, type Specimen, WARDS } from "../../libs/utils/domain/src/index.ts";
import { effectiveResult } from "../../libs/utils/eucast/src/index.ts";
import { addDays } from "../../libs/utils/replay/src/index.ts";

const DIR = "experiments/0010-coverage-as-shipped";
const t0 = Date.now();
const records = joinIsolates(await loadDataset("data/synthetic_microbiology_dataset"));

/** Last day of each month from 2024-09 to 2026-08: the as-of dates. */
const asOfs: string[] = [];
for (let i = 0; i < 24; i++) {
  const nextMonth = new Date(Date.UTC(2024, 9 + i, 1)).toISOString().slice(0, 10); // 2024-10-01 .. 2026-09-01
  asOfs.push(addDays(nextMonth, -1));
}

const SEVERITIES: Severity[] = ["mild", "severe"];

/** The hospital antibiogram (baseline): specimen, last 365 days, all organisms, highest share among suggestible antibiotics. */
function baselinePick(asOf: string, specimen: Specimen, result: CoverageResult, severity: Severity): AntibioticCode | null {
  const from = addDays(asOf, -364);
  const pool = firstIsolates(
    records.filter((r) => r.specimen === specimen && r.sampleDate >= from && r.sampleDate <= asOf),
    { from, to: asOf },
  );
  let best: AntibioticCode | null = null;
  let bestShare = -1;
  for (const c of result.antibiotics) {
    if (severity === "mild" && IV_ONLY.includes(c.antibiotic)) continue;
    let covered = 0;
    let known = 0;
    for (const r of pool) {
      const e = effectiveResult(r, c.antibiotic);
      if (e.basis === "untested") continue;
      known++;
      if (e.result === "S") covered++;
    }
    if (known >= 30 && covered / known > bestShare) {
      bestShare = covered / known;
      best = c.antibiotic;
    }
  }
  return best;
}

const rows: Record<string, unknown>[] = [];
const combos: Record<string, unknown>[] = [];
const baselineCache = new Map<string, AntibioticCode | null>();
for (const asOf of asOfs) {
  const monthStart = addDays(asOf, 1);
  const month = monthStart.slice(0, 7);
  const next = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 1)).toISOString().slice(0, 10);
  const monthEnd = addDays(next, -1);
  const monthDays = Number(monthEnd.slice(8, 10));
  const known: IsolateRecord[] = records.filter((r) => r.sampleDate <= asOf);
  for (const ward of WARDS.map((w) => w.code))
    for (const { code: specimen } of SPECIMENS) {
      const result = coverage(known, { asOf, ward, specimen });
      // The unit's own first isolates of the target month, counted by the same code.
      const target = coverage(records, { asOf: monthEnd, ward, specimen, windowDays: monthDays, minTested: 1 });
      if (target.level !== "unit") continue;
      for (const severity of SEVERITIES) {
        const key = `${asOf}|${specimen}|${severity}`;
        if (!baselineCache.has(key)) baselineCache.set(key, baselinePick(asOf, specimen, result, severity));
        const baseline = baselineCache.get(key);
        const suggestions = suggest(result, severity);
        suggestions.forEach((s, rank) => {
          const t = target.antibiotics.find((a) => a.antibiotic === s.antibiotic);
          if (!t) return;
          const basis = severity === "mild" ? t.spectrum.counts : t.counts;
          rows.push({
            month,
            ward,
            specimen,
            severity,
            level: result.level,
            pool: result.isolates,
            targetIsolates: target.isolates,
            antibiotic: s.antibiotic,
            aware: AWARE[s.antibiotic],
            rank,
            standing: s.standing,
            share: s.share,
            lower: s.interval?.[0] ?? null,
            allShare: s.allOrganisms.share,
            baseline: s.antibiotic === baseline,
            covered: basis.covered,
            known: basis.known,
            allCovered: t.counts.covered,
            allKnown: t.counts.known,
          });
        });
        const pair = suggestCombinations(result, severity)[0];
        if (pair) {
          const t = target.combinations.find((c) => c.antibiotics[0] === pair.antibiotics[0] && c.antibiotics[1] === pair.antibiotics[1]);
          combos.push({
            month,
            ward,
            specimen,
            pair: pair.antibiotics.join("+"),
            standing: pair.standing,
            share: pair.coverage.share,
            covered: t?.counts.covered ?? 0,
            known: t?.counts.known ?? 0,
          });
        }
      }
    }
}
mkdirSync(`${DIR}/out`, { recursive: true });
writeFileSync(`${DIR}/out/rows.json`, JSON.stringify({ rows, combos }));
console.log(`${asOfs.length} months, ${rows.length} rows, ${combos.length} combination rows, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
