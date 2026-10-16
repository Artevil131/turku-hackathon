// Dev tooling: what the screens would show on chosen days, from a feed export.
//
//   node scripts/check-screens.ts <isolates.json> <meta.json> [YYYY-MM-DD ...]
//
// isolates.json = GET /api/isolates at the feed's end date; meta.json = GET /api/meta.
// Prints, per day: the alert episodes (one outbreak = one card), the badge
// count, and for every unit and infection site the best match with what its
// figure leaves out ("rests on X of Y, not tested for ..."). Nothing here is
// used by the app; it asks the app's own analysis door (src/analytics, the
// local source: the same gears the browser runs) over released results.

import { readFileSync } from "node:fs";
import type { Result } from "@aei/feed";
import type { Catalog } from "@aei/isolates";
import { DEFAULT_COVERAGE, groupEpisodes, visibleSignals } from "../src/analytics/helpers.ts";
import { localSource } from "../src/analytics/local.ts";
import { unseenEpisodes } from "../src/screens/Alerts/filters.ts";

const [, , isoPath, metaPath, ...days] = process.argv;
if (!isoPath || !metaPath) {
  console.error("usage: node scripts/check-screens.ts <isolates.json> <meta.json> [YYYY-MM-DD ...]");
  process.exit(2);
}
const raw = JSON.parse(readFileSync(isoPath, "utf8"));
const all: Result[] = (Array.isArray(raw) ? raw : raw.records).slice();
all.sort((a, b) => (a.sampleDate < b.sampleDate ? -1 : a.sampleDate > b.sampleDate ? 1 : 0));
const meta = JSON.parse(readFileSync(metaPath, "utf8"));
const units: { code: string }[] = meta.units ?? meta.wards ?? [];
const specimens: { code: string }[] = meta.specimens ?? [];
const catalog: Catalog = { units: meta.units ?? meta.wards ?? [], antibiotics: meta.antibiotics ?? [] };
const door = localSource();
const sync = door.sync;
if (!sync) throw new Error("the local analysis source answers synchronously");

for (const asOf of days.length ? days : [all[all.length - 1]!.sampleDate]) {
  const released = all.filter((r) => r.sampleDate <= asOf);
  const at = { results: released, asOf, catalog };
  const signals = visibleSignals(await door.signals(at, 0), asOf);
  console.log(
    `\n=== ${asOf}: ${released.length} results, ${signals.length} signals, badge ${unseenEpisodes(signals, asOf, new Set()).length}`,
  );
  for (const e of groupEpisodes(signals.filter((s) => s.lastDate > shift(asOf, -28)))) {
    if (e.members.length < 2) continue;
    console.log(
      `  episode ${e.lead.ward} ${e.severity}: ${e.members.map((s) => `${s.firstDate} ${s.kind}${s.antibiotic ? ` ${s.antibiotic}` : ""}`).join(" -> ")}`,
    );
  }
  for (const u of units) {
    for (const sp of specimens) {
      const cov = sync.coverage(at, { ward: u.code, specimen: sp.code }, DEFAULT_COVERAGE.rank);
      const top = cov.drugs[0];
      if (!top) continue;
      const gap = top.untested.length
        ? ` · rests on ${top.main.n} of ${top.isolates}, not tested for ${top.untested.map((x) => `${x.organism} (${x.n})`).join(", ")}`
        : "";
      console.log(
        `  ${u.code.padEnd(6)} ${sp.code.padEnd(6)} n=${String(cov.basis.n).padStart(4)} ${cov.basis.window.padEnd(6)} enough=${cov.basis.enough} top ${top.antibiotic} ${top.main.works}/${top.main.n}${gap}`,
      );
    }
  }
}

function shift(iso: string, d: number): string {
  const t = new Date(`${iso}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + d);
  return t.toISOString().slice(0, 10);
}
