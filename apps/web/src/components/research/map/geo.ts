import type { CountyFeature } from "@aei/contract";

// Projection and path drawing ported from scripts/explore/finland.html:
// an equirectangular fit of Finland with the longitude scaled by cos 65 deg.

export const MAP_W = 480;
export const MAP_H = 720;
export const PAD = 10;
const LON0 = 19.0;
const LON1 = 31.8;
const LAT0 = 59.6;
const LAT1 = 70.2;
const COS = Math.cos((65 * Math.PI) / 180);
const k = Math.min(MAP_W / ((LON1 - LON0) * COS), MAP_H / (LAT1 - LAT0));

export const project = (lon: number, lat: number): [number, number] => [(lon - LON0) * COS * k + PAD, (LAT1 - lat) * k + PAD];

type Ring = number[][];

function polygons(geom: CountyFeature["geometry"]): Ring[][] {
  return geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;
}

export function pathOf(geom: CountyFeature["geometry"]): string {
  return polygons(geom)
    .map((rings) =>
      rings
        .map(
          (ring) =>
            `M${ring
              .map(([lo, la]) =>
                project(lo as number, la as number)
                  .map((v) => v.toFixed(1))
                  .join(","),
              )
              .join("L")}Z`,
        )
        .join(""),
    )
    .join("");
}

/** Area-weighted centroid of the largest polygon's outer ring, in map units. */
export function centroidOf(geom: CountyFeature["geometry"]): [number, number] {
  let best: { area: number; c: [number, number] } | null = null;
  for (const rings of polygons(geom)) {
    const pts = (rings[0] ?? []).map(([lo, la]) => project(lo as number, la as number));
    let a = 0;
    let cx = 0;
    let cy = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i] as [number, number];
      const [x1, y1] = pts[i + 1] as [number, number];
      const f = x0 * y1 - x1 * y0;
      a += f;
      cx += (x0 + x1) * f;
      cy += (y0 + y1) * f;
    }
    const area = Math.abs(a) / 2;
    if (!best || area > best.area) best = { area, c: a === 0 ? (pts[0] ?? [0, 0]) : [cx / (3 * a), cy / (3 * a)] };
  }
  return best?.c ?? [0, 0];
}

export const TYKS = project(22.27, 60.45);
