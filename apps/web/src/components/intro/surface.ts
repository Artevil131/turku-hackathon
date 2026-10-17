import type { CountyFeature } from "@aei/contract";

// Geometry and field maths for the pitch intro, ported from scripts/explore/surface.html:
// a km plane centred on Finland, a grid over the land with the county of each cell, the county
// rates smoothed over the grid with a Gaussian kernel, and the smoothed field cut into flat terraces.

export interface Hospital {
  id: string;
  name: string;
  lon: number;
  lat: number;
  uni?: boolean;
  county: string;
  /** The university hospital this central hospital refers to. */
  to?: string;
}

// Hospitals and the referral tree (central hospital -> university hospital), as in surface.html.
export const HOSPITALS: Hospital[] = [
  { id: "HUS", name: "HUS Meilahti, Helsinki", lon: 24.91, lat: 60.19, uni: true, county: "Helsingin kaupunki" },
  { id: "Tyks", name: "Tyks, Turku", lon: 22.27, lat: 60.45, uni: true, county: "Varsinais-Suomen hyvinvointialue" },
  { id: "Tays", name: "Tays, Tampere", lon: 23.8, lat: 61.5, uni: true, county: "Pirkanmaan hyvinvointialue" },
  { id: "KYS", name: "KYS, Kuopio", lon: 27.63, lat: 62.89, uni: true, county: "Pohjois-Savon hyvinvointialue" },
  { id: "OYS", name: "OYS, Oulu", lon: 25.52, lat: 65.01, uni: true, county: "Pohjois-Pohjanmaan hyvinvointialue" },
  { id: "Pori", name: "Satasairaala, Pori", lon: 21.8, lat: 61.49, county: "Satakunnan hyvinvointialue", to: "Tyks" },
  { id: "Vaasa", name: "Vaasa central hospital", lon: 21.62, lat: 63.1, county: "Pohjanmaan hyvinvointialue", to: "Tyks" },
  { id: "Mariehamn", name: "Ålands centralsjukhus", lon: 19.94, lat: 60.1, county: "Ahvenanmaa", to: "Tyks" },
  { id: "Hameenlinna", name: "Kanta-Häme central hospital", lon: 24.46, lat: 61.0, county: "Kanta-Hämeen hyvinvointialue", to: "Tays" },
  { id: "Seinajoki", name: "Seinäjoki central hospital", lon: 22.84, lat: 62.79, county: "Etelä-Pohjanmaan hyvinvointialue", to: "Tays" },
  { id: "Jyvaskyla", name: "Nova, Jyväskylä", lon: 25.75, lat: 62.24, county: "Keski-Suomen hyvinvointialue", to: "KYS" },
  { id: "Mikkeli", name: "Mikkeli central hospital", lon: 27.27, lat: 61.69, county: "Etelä-Savon hyvinvointialue", to: "KYS" },
  { id: "Joensuu", name: "Siun sote, Joensuu", lon: 29.76, lat: 62.6, county: "Pohjois-Karjalan hyvinvointialue", to: "KYS" },
  { id: "Rovaniemi", name: "Lapland central hospital", lon: 25.73, lat: 66.5, county: "Lapin hyvinvointialue", to: "OYS" },
  { id: "Kajaani", name: "Kainuu central hospital", lon: 27.73, lat: 64.22, county: "Kainuun hyvinvointialue", to: "OYS" },
  { id: "Kokkola", name: "Soite, Kokkola", lon: 23.13, lat: 63.84, county: "Keski-Pohjanmaan hyvinvointialue", to: "OYS" },
  { id: "Espoo", name: "Jorvi, Espoo", lon: 24.68, lat: 60.22, county: "Länsi-Uudenmaan hyvinvointialue", to: "HUS" },
  { id: "Vantaa", name: "Peijas, Vantaa", lon: 25.07, lat: 60.33, county: "Vantaan ja Keravan hyvinvointialue", to: "HUS" },
  { id: "Hyvinkaa", name: "Hyvinkää hospital", lon: 24.86, lat: 60.63, county: "Keski-Uudenmaan hyvinvointialue", to: "HUS" },
  { id: "Porvoo", name: "Porvoo hospital", lon: 25.66, lat: 60.39, county: "Itä-Uudenmaan hyvinvointialue", to: "HUS" },
  { id: "Lahti", name: "Päijät-Häme central hospital", lon: 25.66, lat: 60.98, county: "Päijät-Hämeen hyvinvointialue", to: "HUS" },
  { id: "Kotka", name: "Kymenlaakso central hospital", lon: 26.95, lat: 60.47, county: "Kymenlaakson hyvinvointialue", to: "HUS" },
  {
    id: "Lappeenranta",
    name: "South Karelia central hospital",
    lon: 28.19,
    lat: 61.06,
    county: "Etelä-Karjalan hyvinvointialue",
    to: "HUS",
  },
];
const UNI_LINKS: [string, string][] = [
  ["HUS", "Tyks"],
  ["HUS", "Tays"],
  ["Tays", "Tyks"],
  ["Tays", "KYS"],
  ["KYS", "OYS"],
  ["Tays", "OYS"],
  ["HUS", "KYS"],
];
/** [from, to, weight]: referral links first, links between university hospitals lighter. */
export const LINKS: [string, string, number][] = [
  ...HOSPITALS.filter((h) => h.to).map((h): [string, string, number] => [h.id, h.to as string, 1]),
  ...UNI_LINKS.map(([a, b]): [string, string, number] => [a, b, 0.6]),
];

const CX = 25.5;
const CY = 64.9;
const KM_LAT = 111.2;
const KM_LON = 111.2 * Math.cos((CY * Math.PI) / 180);
export const toKm = (lon: number, lat: number): [number, number] => [(lon - CX) * KM_LON, (CY - lat) * KM_LAT];

const LON0 = 19.2;
const LON1 = 31.6;
const LAT0 = 59.7;
const LAT1 = 70.1;

type Ring = number[][];
const polygons = (g: CountyFeature["geometry"]): Ring[][] => (g.type === "Polygon" ? [g.coordinates] : g.coordinates);

interface BoxRing {
  pts: Ring;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

function boxed(ring: Ring): BoxRing {
  let x0 = 1e9;
  let x1 = -1e9;
  let y0 = 1e9;
  let y1 = -1e9;
  for (const p of ring) {
    const lo = p[0] as number;
    const la = p[1] as number;
    if (lo < x0) x0 = lo;
    if (lo > x1) x1 = lo;
    if (la < y0) y0 = la;
    if (la > y1) y1 = la;
  }
  return { pts: ring, x0, x1, y0, y1 };
}

function inRing(x: number, y: number, r: BoxRing): boolean {
  if (x < r.x0 || x > r.x1 || y < r.y0 || y > r.y1) return false;
  let inside = false;
  const ring = r.pts;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = (ring[i] as number[])[0] as number;
    const yi = (ring[i] as number[])[1] as number;
    const xj = (ring[j] as number[])[0] as number;
    const yj = (ring[j] as number[])[1] as number;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export interface Grid {
  nx: number;
  ny: number;
  /** Cell centres and sizes, km. */
  x: Float32Array;
  y: Float32Array;
  cw: number;
  ch: number;
  /** Index into `names`, or -1 off the land. */
  county: Int16Array;
  names: string[];
  /** Per county: mean of the outline vertices, km. */
  centroids: [number, number][];
  /** Land cell indices. */
  land: Int32Array;
}

export function buildGrid(features: CountyFeature[], nx = 80, ny = 124): Grid {
  const names = features.map((f) => f.properties.nimi);
  const shapes = features.map((f) =>
    polygons(f.geometry)
      .map((poly) => poly[0] as Ring)
      .filter((r) => {
        const b = boxed(r);
        return b.x1 - b.x0 + (b.y1 - b.y0) > 0.3;
      })
      .map(boxed),
  );
  const x = new Float32Array(nx * ny);
  const y = new Float32Array(nx * ny);
  const county = new Int16Array(nx * ny).fill(-1);
  const land: number[] = [];
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const lon = LON0 + ((i + 0.5) * (LON1 - LON0)) / nx;
      const lat = LAT0 + ((j + 0.5) * (LAT1 - LAT0)) / ny;
      const k = j * nx + i;
      const [px, py] = toKm(lon, lat);
      x[k] = px;
      y[k] = py;
      outer: for (let c = 0; c < shapes.length; c++)
        for (const r of shapes[c] as BoxRing[])
          if (inRing(lon, lat, r)) {
            county[k] = c;
            land.push(k);
            break outer;
          }
    }
  const centroids = shapes.map((rs): [number, number] => {
    let sx = 0;
    let sy = 0;
    let n = 0;
    for (const r of rs)
      for (const p of r.pts) {
        const [px, py] = toKm(p[0] as number, p[1] as number);
        sx += px;
        sy += py;
        n++;
      }
    return [sx / Math.max(1, n), sy / Math.max(1, n)];
  });
  return {
    nx,
    ny,
    x,
    y,
    cw: ((LON1 - LON0) / nx) * KM_LON,
    ch: ((LAT1 - LAT0) / ny) * KM_LAT,
    county,
    names,
    centroids,
    land: Int32Array.from(land),
  };
}

/** Nearest land cell to a lon/lat, or -1. */
export function cellAt(g: Grid, lon: number, lat: number): number {
  const i = Math.min(g.nx - 1, Math.max(0, Math.round(((lon - LON0) / (LON1 - LON0)) * g.nx - 0.5)));
  const j = Math.min(g.ny - 1, Math.max(0, Math.round(((lat - LAT0) / (LAT1 - LAT0)) * g.ny - 0.5)));
  for (let r = 0; r < 5; r++)
    for (let dj = -r; dj <= r; dj++)
      for (let di = -r; di <= r; di++) {
        const ii = i + di;
        const jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= g.nx || jj >= g.ny) continue;
        if ((g.county[jj * g.nx + ii] as number) >= 0) return jj * g.nx + ii;
      }
  return -1;
}

export interface Terraces {
  /** Smoothed value per cell, NaN off the land. */
  field: Float32Array;
  /** Terrace index per cell, 0 .. steps-1, 255 off the land. */
  level: Uint8Array;
  lo: number;
  hi: number;
  steps: number;
}

/**
 * Gaussian-smooths the county values over the land (bandwidth in km, as in surface.html, the cell's own
 * county always counting at least as much as a centroid 0.7 bandwidths away) and cuts the result into
 * `steps` equal bands. Counties with a null value are left out of the smoothing.
 */
export function terraces(g: Grid, values: (number | null)[], steps: number, bw = 120): Terraces {
  const pts: { c: [number, number]; v: number }[] = [];
  values.forEach((v, i) => {
    if (v !== null) pts.push({ c: g.centroids[i] as [number, number], v });
  });
  const field = new Float32Array(g.county.length).fill(Number.NaN);
  const level = new Uint8Array(g.county.length).fill(255);
  const s2 = 2 * bw * bw;
  const w0 = Math.exp(-0.5);
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  for (const k of g.land) {
    let num = 0;
    let den = 0;
    for (const p of pts) {
      const dx = (g.x[k] as number) - p.c[0];
      const dy = (g.y[k] as number) - p.c[1];
      const w = Math.exp(-(dx * dx + dy * dy) / s2);
      num += w * p.v;
      den += w;
    }
    const own = values[g.county[k] as number];
    if (own !== null && own !== undefined) {
      num += w0 * own;
      den += w0;
    }
    const v = den > 0 ? num / den : 0;
    field[k] = v;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  if (!Number.isFinite(lo)) {
    lo = 0;
    hi = 0;
  }
  const span = hi - lo;
  for (const k of g.land) {
    const f = span > 1e-9 ? ((field[k] as number) - lo) / span : 0;
    level[k] = Math.min(steps - 1, Math.max(0, Math.floor(f * steps)));
  }
  return { field, level, lo, hi, steps };
}

/** A flat plain, for the outline fallback: one terrace over the whole land. */
export function flatTerraces(g: Grid): Terraces {
  const level = new Uint8Array(g.county.length).fill(255);
  for (const k of g.land) level[k] = 0;
  return { field: new Float32Array(g.county.length), level, lo: 0, hi: 0, steps: 1 };
}

export function parseHex(css: string, fallback: [number, number, number]): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(css.trim());
  if (!m) return fallback;
  const n = Number.parseInt(m[1] as string, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
