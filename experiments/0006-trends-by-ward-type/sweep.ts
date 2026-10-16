// 0006: trend detection by ward type (README.md).
// Run from the repository root: node experiments/0006-trends-by-ward-type/sweep.ts

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { joinIsolates, loadDataset } from "../../libs/utils/dataset/src/index.ts";
import {
  clusterSignals,
  episodes,
  inDetectedCluster,
  LIVE_SETTINGS,
  type Pair,
  risingTrend,
  SURVEILLANCE_PAIRS,
} from "../../libs/utils/detect/src/index.ts";

const DATA = "data/synthetic_microbiology_dataset";
const OUT = "experiments/0006-trends-by-ward-type/out";
const ALPHAS = [0.01, 0.001, 0.0001];
const SETTINGS: (Pair["setting"] | undefined)[] = [undefined, "in", "out"];
const label = (s: Pair["setting"] | undefined) => (s === "in" ? "inpatient" : s === "out" ? "outpatient" : "all units");

const records = joinIsolates(await loadDataset(DATA));
const exclude = inDetectedCluster(clusterSignals(records));

const pairs: Pair[] = SURVEILLANCE_PAIRS.flatMap((p) => SETTINGS.map((setting) => (setting ? { ...p, setting } : { ...p })));
const series = pairs.length;

// First signal date per series and alpha; the smallest p seen.
const rows: string[][] = [];
const signalling = new Map<number, number>(ALPHAS.map((a) => [a, 0]));
const all = risingTrend(records, pairs, { ...LIVE_SETTINGS.risingTrend, alpha: 1, exclude });
for (const pair of pairs) {
  const key = `${pair.organism}|${pair.antibiotic}|${pair.specimen ?? "all"}${pair.setting ? `|${pair.setting}` : ""}`;
  const mine = all.filter((s) => s.key === key);
  const minP = Math.min(...mine.map((s) => s.p ?? 1));
  const firsts = ALPHAS.map((a) => mine.find((s) => (s.p ?? 1) < a)?.date ?? "–");
  ALPHAS.forEach((a, i) => {
    if (firsts[i] !== "–") signalling.set(a, (signalling.get(a) ?? 0) + 1);
  });
  if (firsts[0] !== "–") {
    const episodesAt001 = episodes(mine.filter((s) => (s.p ?? 1) < 0.001)).length;
    rows.push([`${pair.organism} ${pair.antibiotic}${pair.specimen ? ` (${pair.specimen})` : ""}`, label(pair.setting), minP.toExponential(1), ...firsts, String(episodesAt001)]);
  }
}

const table = (head: string[], body: string[][]) =>
  [`| ${head.join(" | ")} |`, `|${head.map(() => "---").join("|")}|`, ...body.map((r) => `| ${r.join(" | ")} |`)].join("\n");
let md = `# 0006 results\n\n${series} series (22 pairs × all units, inpatient, outpatient). Isolates of clusters already detected are left out from the day of detection (D-022). All computed.\n\n`;
md += `Series signalling at least once: ${ALPHAS.map((a) => `alpha ${a}: ${signalling.get(a)}`).join("; ")}.\n\n`;
md += `### Every series that signals at alpha 0.01\n\n${table(["pair", "stratum", "smallest p", ...ALPHAS.map((a) => `first at ${a}`), "episodes at 0.001"], rows)}\n`;
await mkdir(OUT, { recursive: true });
await writeFile(join(OUT, "results.md"), md);
console.log(md);
