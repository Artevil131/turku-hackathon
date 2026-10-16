// Shared by finland.html and finland3d.html: data loading, the Gamma estimate per county, the fan chart.
const $ = (id) => document.getElementById(id);
const DATA = "../../data/external/"; // written by scripts/fetch_thl_ttr.py (D-025, D-037) and scripts/fetch_county_geometry.py
// University-hospital collaborative areas. Åland is autonomous; its referrals go to Turku, so it is pooled with TYKS here.
const CATCHMENT = {
  "Helsingin kaupunki": "HUS",
  "Vantaan ja Keravan hyvinvointialue": "HUS",
  "Länsi-Uudenmaan hyvinvointialue": "HUS",
  "Itä-Uudenmaan hyvinvointialue": "HUS",
  "Keski-Uudenmaan hyvinvointialue": "HUS",
  "Päijät-Hämeen hyvinvointialue": "HUS",
  "Kymenlaakson hyvinvointialue": "HUS",
  "Etelä-Karjalan hyvinvointialue": "HUS",
  "Varsinais-Suomen hyvinvointialue": "TYKS",
  "Satakunnan hyvinvointialue": "TYKS",
  "Pohjanmaan hyvinvointialue": "TYKS",
  Ahvenanmaa: "TYKS",
  "Pirkanmaan hyvinvointialue": "TAYS",
  "Kanta-Hämeen hyvinvointialue": "TAYS",
  "Etelä-Pohjanmaan hyvinvointialue": "TAYS",
  "Pohjois-Savon hyvinvointialue": "KYS",
  "Etelä-Savon hyvinvointialue": "KYS",
  "Pohjois-Karjalan hyvinvointialue": "KYS",
  "Keski-Suomen hyvinvointialue": "KYS",
  "Pohjois-Pohjanmaan hyvinvointialue": "OYS",
  "Lapin hyvinvointialue": "OYS",
  "Kainuun hyvinvointialue": "OYS",
  "Keski-Pohjanmaan hyvinvointialue": "OYS",
};
const FI_MONTHS = {
  tammikuu: "01",
  helmikuu: "02",
  maaliskuu: "03",
  huhtikuu: "04",
  toukokuu: "05",
  kesäkuu: "06",
  heinäkuu: "07",
  elokuu: "08",
  syyskuu: "09",
  lokakuu: "10",
  marraskuu: "11",
  joulukuu: "12",
};
const short = (n) => n.replace(" hyvinvointialue", "").replace("Helsingin kaupunki", "Helsinki");

let GEO,
  D,
  selected = "Varsinais-Suomen hyvinvointialue",
  timer = null;

// Gamma posterior for a rate: counts c over exposure E person-years, prior rate r0 with pseudo-exposure E0.
function gammaPost(c, E, r0, E0) {
  const a = c + r0 * E0,
    b = E + E0;
  const mean = a / b;
  const q = (p) => {
    // Wilson–Hilferty quantile of Gamma(a, rate b)
    const z = p === 0.05 ? -1.6449 : p === 0.95 ? 1.6449 : 0;
    const k = Math.max(a, 1e-9);
    return (k / b) * Math.max(1e-9, 1 - 1 / (9 * k) + z * Math.sqrt(1 / (9 * k))) ** 3;
  };
  return { mean, lo: q(0.05), hi: q(0.95), w: E / (E + E0), a, b };
}
function counts(flag) {
  if (flag === "CPE") return D.counts.CPE_Kpn.map((row, i) => row.map((v, j) => v + D.counts.CPE_Ecoli[i][j]));
  return D.counts[flag];
}
// Estimate for every county at month index m with window W months.
function estimates(flag, m, W, E0) {
  const C = counts(flag);
  const m0 = Math.max(0, m - W + 1);
  const months = m - m0 + 1;
  const rows = D.areas.map((name, i) => {
    let c = 0;
    for (let j = m0; j <= m; j++) c += C[i][j];
    const E = (D.population[i][m] * months) / 12;
    return { name, i, c, E, pop: D.population[i][m], catch: CATCHMENT[name] || "?" };
  });
  const byCatch = {};
  for (const r of rows) {
    byCatch[r.catch] ||= { c: 0, E: 0 };
    const g = byCatch[r.catch];
    g.c += r.c;
    g.E += r.E;
  }
  for (const r of rows) {
    const g = byCatch[r.catch];
    r.r0 = g.c / g.E;
    Object.assign(r, gammaPost(r.c, r.E, r.r0, E0));
  }
  return rows;
}

function monthLabel(j) {
  const [fi, y] = D.months[j].split(" ");
  return `${y}-${FI_MONTHS[fi]}`;
}
function drawDetail(e, Wn) {
  $("detail").innerHTML = `<h2>${short(e.name)} <span class="muted">· ${e.catch} catchment</span></h2>
    <div class="big">${(e.mean * 1e5).toFixed(1)} <span class="muted" style="font-size:14px">per 100,000 per year, 90% interval ${(e.lo * 1e5).toFixed(1)}–${(e.hi * 1e5).toFixed(1)}</span></div>
    <div class="muted">${e.c} cases over ${Wn} month${Wn > 1 ? "s" : ""} in a population of ${e.pop.toLocaleString()}. ${Math.round(e.w * 100)}% of the estimate is this county's own data, the rest the ${e.catch} catchment's rate of ${(e.r0 * 1e5).toFixed(1)}.</div>
    <div class="muted" style="margin-top:6px">Gamma(${e.a.toFixed(1)}, ${Math.round(e.b).toLocaleString()} person-years): posterior for the rate, the count cousin of the Beta used for %S.</div>`;
}
function drawFan(flag, name, Wn, E0, mSel) {
  const i = D.areas.indexOf(name);
  const C = counts(flag);
  const n = D.months.length;
  const series = [];
  for (let m = 0; m < n; m++) series.push(estimates(flag, m, Wn, E0)[i]);
  const Wd = Math.max(560, Math.min(1000, $("fan").clientWidth || 700)),
    Hd = 260,
    L = 44,
    R = 40,
    T = 12,
    B = 34;
  const x = (m) => L + (m * (Wd - L - R)) / n,
    bw = (Wd - L - R) / n;
  const rmax = Math.max(1e-9, ...series.map((s) => s.hi * 1e5));
  const cmax = Math.max(1, ...C[i]);
  const yR = (v) => T + (Hd - T - B) * (1 - v / rmax),
    yC = (v) => T + (Hd - T - B) * (1 - v / cmax);
  let s = `<svg width="${Wd}" height="${Hd}">`;
  s += `<line class="axis" x1="${L}" y1="${Hd - B}" x2="${Wd - R}" y2="${Hd - B}"/>`;
  C[i].forEach((c, m) => {
    s += `<rect x="${x(m)}" y="${yC(c)}" width="${Math.max(1, bw - 1)}" height="${Hd - B - yC(c)}" fill="var(--accent)" opacity="${m >= n - 2 ? 0.15 : 0.3}"><title>${monthLabel(m)}: ${c} cases</title></rect>`;
  });
  const band = series
    .map((e, m) => `${x(m) + bw / 2},${yR(e.hi * 1e5)}`)
    .concat(series.map((e, m) => `${x(m) + bw / 2},${yR(e.lo * 1e5)}`).reverse());
  s += `<polygon points="${band.join(" ")}" fill="var(--r)" opacity="0.18"/>`;
  s += `<polyline fill="none" stroke="var(--r)" stroke-width="2" points="${series.map((e, m) => `${x(m) + bw / 2},${yR(e.mean * 1e5)}`).join(" ")}"/>`;
  s += `<polyline fill="none" stroke="var(--muted)" stroke-width="1" stroke-dasharray="3 3" points="${series.map((e, m) => `${x(m) + bw / 2},${yR(e.r0 * 1e5)}`).join(" ")}"/>`;
  s += `<line x1="${x(mSel) + bw / 2}" y1="${T}" x2="${x(mSel) + bw / 2}" y2="${Hd - B}" stroke="var(--fg)" stroke-dasharray="4 3"/>`;
  for (const f of [0, 0.5, 1])
    s += `<text x="${L - 6}" y="${yR(f * rmax) + 4}" text-anchor="end">${(f * rmax).toFixed(0)}</text><text x="${Wd - R + 6}" y="${yC(f * cmax) + 4}">${Math.round(f * cmax)}</text>`;
  for (let m = 0; m < n; m += 6) s += `<text x="${x(m)}" y="${Hd - B + 16}">${monthLabel(m)}</text>`;
  s += `<text x="${L}" y="${Hd - 4}" fill="var(--muted)">red line and band: estimated rate per 100,000/yr with 90% interval (left axis); dashed: ${CATCHMENT[name]} catchment; bars: monthly cases (right axis), last two months incomplete</text></svg>`;
  $("fan").innerHTML = s;
}

// Groups in regional.json (aei.thl.GROUPS names) for the four phenotypes shown.
const GROUP_NAMES = {
  MRSA: "MRSA carriage",
  ESBL_Ecoli: "ESBL carriage, E. coli",
  VRE: "VRE carriage",
  CPE_Kpn: "CPE carriage, K. pneumoniae",
  CPE_Ecoli: "CPE carriage, E. coli",
};
const NATIONAL = "Finland (all counties)";
// regional.json -> { areas, months, counts{flag: areas × months}, population: areas × months }.
// Population is not in the file; it is recovered as cases / incidence × 100,000, median over months with 3+ cases.
function fromRegional(view) {
  const months = view.months.map((m) => {
    const [y, mm] = m.split("-");
    const fi = Object.keys(FI_MONTHS).find((k) => FI_MONTHS[k] === mm);
    return `${fi} ${y}`;
  });
  const areas = view.regions.filter((r) => r !== NATIONAL);
  const bySeries = {};
  for (const s of view.series) bySeries[s.group + "|" + s.region] = s;
  const counts = {};
  for (const [flag, g] of Object.entries(GROUP_NAMES))
    counts[flag] = areas.map((a) => (bySeries[g + "|" + a] || { cases: months.map(() => 0) }).cases.map((v) => v || 0));
  const population = areas.map((a) => {
    const ests = [];
    for (const g of Object.values(GROUP_NAMES)) {
      const s = bySeries[g + "|" + a];
      if (!s) continue;
      s.cases.forEach((c, i) => {
        const inc = s.incidencePer100k[i];
        if (c >= 3 && inc > 0) ests.push((c / inc) * 1e5);
      });
    }
    ests.sort((x, y) => x - y);
    const pop = ests.length ? ests[Math.floor(ests.length / 2)] : 100000;
    return months.map(() => Math.round(pop));
  });
  return { areas, months, counts, population, source: view.source, fetched: view.fetched };
}
async function loadOpenData() {
  const [geo, view] = await Promise.all([
    fetch(DATA + "statfi/counties.geojson").then((r) => r.json()),
    fetch(DATA + "thl/regional.json").then((r) => r.json()),
  ]);
  return { geo, data: fromRegional(view) };
}
