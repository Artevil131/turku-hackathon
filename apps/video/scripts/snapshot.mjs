// Every number in the pitch video comes from here: the running AEI server read at two clock dates, a real
// HL7 v2 message built from the dataset (aei.messages), and the county polygons. Writes src/snapshot.json.
//
//     AEI_URL=http://localhost:8787 pnpm --filter @aei/video snapshot
//
// The server needs the full dataset and data/external/thl/regional.json; the polygons come from
// `uv run python scripts/fetch_county_geometry.py`. The server's clock is put back afterwards.
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../../..");
const API = (process.env.AEI_URL ?? "http://localhost:8787").replace(/\/$/, "");
const OUTBREAK_DAY = "2025-06-08";
const REGION_DAY = "2025-10-03";

// The server keeps a replay clock per visitor cookie (D-078), so every request here carries the same one.
const visitor = { cookie: `aei_visitor=${crypto.randomUUID().replaceAll("-", "")}` };
const get = async (path) => {
  const res = await fetch(`${API}${path}`, { headers: visitor });
  if (!res.ok) throw new Error(`GET ${path}: ${res.status}`);
  return res.json();
};
const seek = (date) =>
  fetch(`${API}/api/clock`, {
    method: "POST",
    headers: { ...visitor, "content-type": "application/json" },
    body: JSON.stringify({ action: "seek", date }),
  });

const clock0 = await get("/api/clock");
try {
  // ---------- the outbreak week ----------
  await seek(OUTBREAK_DAY);
  const { alerts } = await get("/api/alerts?from=2025-05-12");
  const cluster = alerts.find((a) => a.kind === "detector" && a.ward === "URO" && a.detector === "profile-excess");
  if (!cluster) throw new Error("no Urology profile-excess alert by 8 June");
  const explain = (lang) => get(`/api/explain?id=${encodeURIComponent(cluster.id)}&lang=${lang}`).then((r) => r.text);
  const { records } = await get("/api/isolates?from=2025-05-12&to=2025-06-08");
  // One dot per isolate: day, unit, and whether it carries the cluster's profile.
  const order = ["AMP", "MEC", "TZP", "FOX", "CXM", "CRO", "CAZ", "MEM", "CIP", "TMP", "NIT", "VAN", "CLI"];
  const profileOf = (r) => order.map((a) => r.results[a] ?? ".").join("");
  const dots = records.map((r) => ({
    day: r.sampleDate,
    ward: r.ward,
    cluster: r.ward === "URO" && r.organism === cluster.organism && profileOf(r) === cluster.profile,
  }));
  const coverage = async (severity) => {
    const c = await get(`/api/coverage?ward=URO&specimen=urine&severity=${severity}`);
    return {
      level: c.coverage.level,
      isolates: c.coverage.isolates,
      from: c.coverage.from,
      suggestions: c.suggestions.slice(0, 5).map((s) => ({
        antibiotic: s.antibiotic,
        standing: s.standing,
        share: s.share,
        interval: s.interval,
        allOrganisms: s.allOrganisms.share,
      })),
    };
  };
  const treat = { mild: await coverage("mild"), severe: await coverage("severe") };
  const quality = await get("/api/quality");

  // ---------- the region ----------
  await seek(REGION_DAY);
  const regional = await get("/api/regional");
  const home = "Varsinais-Suomen hyvinvointialue";
  const homeSeries = regional.series.find((s) => s.region === home && s.group === "CPE carriage, E. coli");

  // ---------- a real lab message: one of the outbreak's ESBL E. coli (patient pseudonym masked) ----------
  const py = spawnSync(
    "uv",
    [
      "run",
      "python",
      "-c",
      "from aei.messages import lab_reports, to_hl7\n" +
        "r = [x for x in lab_reports('data/synthetic_microbiology_dataset', '2025-06-04', '2025-06-04') if x.ward == 'URO' and any(i.organism == 'Escherichia coli' and 'esbl' in i.phenotypes for i in x.isolates)][0]\n" +
        "print(to_hl7(r).replace('\\r', '\\n'))",
    ],
    { cwd: ROOT, encoding: "utf8" },
  );
  if (py.status !== 0) throw new Error(py.stderr);
  const hl7 = py.stdout
    .trim()
    .split("\n")
    .map((l) => (l.startsWith("PID|") ? l.replace(/^PID\|1\|\|[^|^]*/, "PID|1||PSEUDO-0001") : l));

  // ---------- county outlines as SVG paths, equirectangular with cos(64°) ----------
  const geo = JSON.parse(readFileSync(join(ROOT, "data/external/statfi/counties.geojson"), "utf8"));
  const kx = Math.cos((64 * Math.PI) / 180);
  const polygons = (g) => (g.type === "Polygon" ? [g.coordinates] : g.coordinates);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const f of geo.features)
    for (const poly of polygons(f.geometry))
      for (const [lon, lat] of poly[0]) {
        minX = Math.min(minX, lon * kx);
        maxX = Math.max(maxX, lon * kx);
        minY = Math.min(minY, -lat);
        maxY = Math.max(maxY, -lat);
      }
  const H = 1000;
  const scale = H / (maxY - minY);
  const W = Math.round((maxX - minX) * scale);
  const counties = geo.features.map((f) => ({
    name: f.properties.nimi,
    en: f.properties.name,
    d: polygons(f.geometry)
      .map((poly) => {
        const ring = poly[0].filter((_, i, a) => i % 2 === 0 || i === a.length - 1);
        return `M${ring.map(([lon, lat]) => `${((lon * kx - minX) * scale).toFixed(1)},${((-lat - minY) * scale).toFixed(1)}`).join("L")}Z`;
      })
      .join(""),
  }));

  const snapshot = {
    source: `AEI server ${API}, read ${new Date().toISOString().slice(0, 10)}`,
    outbreak: {
      asOf: OUTBREAK_DAY,
      alert: {
        date: cluster.date,
        organism: cluster.organism,
        observed: cluster.observed,
        expected: cluster.expected,
        en: await explain("en"),
        fi: await explain("fi"),
      },
      incidents: new Set(alerts.map((a) => a.incident ?? a.id)).size,
      dots,
    },
    treat,
    quality: { checked: quality.checked, findings: quality.summary.reduce((n, c) => n + c.count, 0) },
    region: {
      asOf: REGION_DAY,
      tested: regional.settings.testedSeriesMonths,
      signals: regional.signals.map((s) => ({
        group: s.group,
        region: s.region,
        month: s.month,
        cases: s.cases,
        expected: s.expected,
        strong: s.strong,
      })),
      home: { region: home, group: "CPE carriage, E. coli", months: regional.months.slice(-24), cases: homeSeries.cases.slice(-24) },
    },
    hl7,
    map: { width: W, height: H, counties },
  };
  writeFileSync(join(HERE, "../src/snapshot.json"), `${JSON.stringify(snapshot, null, 1)}\n`);
  console.log(
    `snapshot: ${dots.length} isolates, alert ${cluster.date} (${cluster.observed} vs ${cluster.expected}), ${regional.signals.length} county signals, ${counties.length} counties, ${hl7.length} HL7 segments`,
  );
} finally {
  await seek(clock0.asOf);
}
