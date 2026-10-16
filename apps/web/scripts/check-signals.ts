// Dev tooling: replay the feed day by day through detectSignals and measure it
// against the planted events (benchmarks/planted-events/README.md).
//
//   node scripts/check-signals.ts <isolates.json> <meta.json>
//
// isolates.json = GET /api/isolates at the feed's end date; meta.json = GET /api/meta.
// The planted events are named here, in the benchmark, never in the engine.

import { readFileSync } from "node:fs";
import type { Result } from "../src/feed/types.ts";
import { detectSignals, resetSignalCache } from "../src/engine/signals.ts";
import type { Catalog, Signal, SignalKind } from "../src/engine/types.ts";

const [, , isoPath, metaPath] = process.argv;
if (!isoPath || !metaPath) {
  console.error("usage: node scripts/check-signals.ts <isolates.json> <meta.json>");
  process.exit(2);
}
const raw = JSON.parse(readFileSync(isoPath, "utf8"));
const all: Result[] = (Array.isArray(raw) ? raw : raw.records).slice();
all.sort((a, b) => (a.sampleDate < b.sampleDate ? -1 : a.sampleDate > b.sampleDate ? 1 : 0));
const meta = JSON.parse(readFileSync(metaPath, "utf8"));
const catalog: Catalog = { units: meta.units ?? meta.wards ?? [], antibiotics: meta.antibiotics ?? [] };

const DAY = 86_400_000;
const toDay = (d: string) => Date.parse(d + "T00:00:00Z") / DAY;
const toIso = (n: number) => new Date(n * DAY).toISOString().slice(0, 10);

const firstDay = toDay(all[0]!.sampleDate);
const lastDay = toDay(all[all.length - 1]!.sampleDate);
const startDay = firstDay + 180;

// Replay as the app does: each day a new, longer array of released results.
const firstSeen = new Map<string, string>();
const times: number[] = [];
let final: Signal[] = [];
let cut = 0;
for (let d = startDay; d <= lastDay; d++) {
  const asOf = toIso(d);
  while (cut < all.length && all[cut]!.sampleDate <= asOf) cut++;
  const released = all.slice(0, cut);
  const t0 = performance.now();
  final = detectSignals(released, asOf, catalog);
  times.push(performance.now() - t0);
  for (const s of final) if (!firstSeen.has(s.id)) firstSeen.set(s.id, asOf);
}
const unstable = final.filter((s) => firstSeen.get(s.id)! > s.firstDate && s.firstDate >= toIso(startDay));

// Cold calls (empty cache, fresh objects): the app opening mid-replay and at the end.
const cold = (asOf: string) => {
  const fresh: Result[] = JSON.parse(JSON.stringify(all.filter((r) => r.sampleDate <= asOf)));
  resetSignalCache();
  const t = performance.now();
  detectSignals(fresh, asOf, catalog);
  return performance.now() - t;
};
const coldMid = cold(toIso(Math.round((firstDay + lastDay) / 2)));
const coldEnd = cold(toIso(lastDay));

// ---------- Planted events ----------
interface Planted {
  id: string;
  name: string;
  onset: string;
  match: (s: Signal) => boolean;
  /** Days after onset an episode may start and still count. */
  within: number;
}
const planted: Planted[] = [
  { id: "E1", name: "URO ESBL E. coli cluster", onset: "2025-06-02", within: 60, match: (s) => s.ward === "URO" && (s.phenotype === "esbl" || s.organism === "Escherichia coli") },
  { id: "E2", name: "ICU MRSA outbreak", onset: "2026-03-03", within: 45, match: (s) => s.ward === "ICU" && (s.phenotype === "mrsa" || s.organism === "Staphylococcus aureus") },
  { id: "E3", name: "PHC-S no samples", onset: "2025-12-08", within: 14, match: (s) => s.ward === "PHC-S" && s.kind === "data-gap" },
  { id: "E5?", name: "MED-A near-empty week", onset: "2025-05-12", within: 14, match: (s) => s.ward === "MED-A" && s.kind === "data-gap" },
  { id: "E4a", name: "urine E. coli TMP rising", onset: toIso(startDay), within: 2000, match: (s) => s.kind === "trend" && s.organism === "Escherichia coli" && s.specimen === "urine" && s.antibiotic === "TMP" },
  { id: "E4b", name: "P. aeruginosa TZP rising", onset: toIso(startDay), within: 2000, match: (s) => s.kind === "trend" && s.organism === "Pseudomonas aeruginosa" && s.antibiotic === "TZP" },
];
const kinds: SignalKind[] = ["sentinel", "surge", "cluster", "data-gap", "shift", "trend"];

const matched = new Set<string>();
console.log("\n== Planted events: first detection per kind ==");
console.log("event  kind       first date   delay  episode");
for (const e of planted) {
  const o = toDay(e.onset);
  let any = false;
  for (const k of kinds) {
    const hits = final
      .filter((s) => s.kind === k && e.match(s) && toDay(s.lastDate) >= o - 7 && toDay(s.firstDate) <= o + e.within)
      .sort((a, b) => (a.firstDate < b.firstDate ? -1 : 1));
    for (const h of hits) matched.add(h.id);
    const h = hits[0];
    if (!h) continue;
    any = true;
    const delay = Math.round(toDay(h.firstDate) - o);
    console.log(
      `${e.id.padEnd(6)} ${k.padEnd(10)} ${h.firstDate}  ${String(delay).padStart(5)}  ${describe(h)}${hits.length > 1 ? `  (+${hits.length - 1} more)` : ""}`,
    );
  }
  if (!any) console.log(`${e.id.padEnd(6)} -- not detected (${e.name})`);
}

// ---------- Volume ----------
const years = (lastDay - startDay + 1) / 365.25;
console.log(`\n== Episodes per kind, ${toIso(startDay)}..${toIso(lastDay)} (${years.toFixed(2)} years) ==`);
for (const k of kinds) {
  const n = final.filter((s) => s.kind === k && s.firstDate >= toIso(startDay)).length;
  const other = final.filter((s) => s.kind === k && s.firstDate >= toIso(startDay) && !matched.has(s.id)).length;
  const high = final.filter((s) => s.kind === k && s.firstDate >= toIso(startDay) && s.severity === "high").length;
  console.log(
    `${k.padEnd(10)} total ${String(n).padStart(4)}  per year ${(n / years).toFixed(1).padStart(6)}  (high ${high}, medium ${n - high})   not planted ${other} (${(other / years).toFixed(1)}/yr)`,
  );
}

// ---------- Strongest other episodes ----------
console.log("\n== 15 strongest episodes not matched to a planted event ==");
const others = final
  .filter((s) => !matched.has(s.id) && s.firstDate >= toIso(startDay))
  .sort((a, b) => (a.p ?? 1) - (b.p ?? 1) || (a.severity < b.severity ? -1 : 1));
for (const s of others.slice(0, 15)) console.log(`${s.firstDate}..${s.lastDate}  ${s.kind.padEnd(9)} ${s.severity.padEnd(6)} ${describe(s)}`);

// ---------- Timing ----------
const sorted = [...times].sort((a, b) => a - b);
const q = (f: number) => sorted[Math.min(sorted.length - 1, Math.floor(f * sorted.length))]!.toFixed(1);
console.log(`\n== Timing over ${times.length} daily calls (${all.length} results) ==`);
console.log(`first call (cold, ${toIso(startDay)}) ${times[0]!.toFixed(1)} ms; daily median ${q(0.5)} ms, p95 ${q(0.95)} ms, max ${sorted[sorted.length - 1]!.toFixed(1)} ms; cold call (empty cache) mid-replay ${coldMid.toFixed(1)} ms, at end ${coldEnd.toFixed(1)} ms`);
console.log(unstable.length ? `UNSTABLE ids: ${unstable.length} (first seen after their firstDate)` : "ids stable: every episode was first seen on its firstDate");

function describe(s: Signal): string {
  const parts = [s.ward ?? "hospital", s.organism, s.specimen, s.phenotype, s.antibiotic, s.resists?.join("+")].filter(Boolean).join(" ");
  const p = s.p !== undefined ? ` p=${s.p.toExponential(1)}` : "";
  const e = s.expected !== undefined ? ` exp=${s.expected}` : "";
  return `${parts} obs=${s.observed}${e}${p} n_iso=${s.isolateIds.length}`;
}
