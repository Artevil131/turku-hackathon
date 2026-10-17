import { WARDS, type WardCode } from "@aei/domain";
import { POS } from "../../Network.tsx";
import { MAP_H, MAP_W, PAD, project } from "../map/geo.ts";

// Geometry of the one panel: the map of Finland on one side, the Tyks inset
// (a magnified circle anchored at Turku) on the other. Wide puts them side by
// side, narrow stacks the inset under the map. All in viewBox units.

export interface Layout {
  wide: boolean;
  w: number;
  h: number;
  /** Scale applied to the map. */
  s: number;
  circle: { cx: number; cy: number; r: number };
}

export function layoutFor(width: number): Layout {
  if (width >= 560) {
    const s = 0.82;
    const w = 640;
    const r = 152;
    const h = Math.round((MAP_H + 2 * PAD) * s);
    return { wide: true, w, h, s, circle: { cx: w - r - 4, cy: Math.round(h * 0.64), r } };
  }
  const r = 184;
  const mapH = MAP_H + 2 * PAD;
  return {
    wide: false,
    w: MAP_W + 2 * PAD - 80,
    h: mapH + 36 + 2 * r + 12,
    s: 1,
    circle: { cx: (MAP_W + 2 * PAD - 80) / 2, cy: mapH + 36 + r, r },
  };
}

export const mapPoint = (l: Layout, lon: number, lat: number): [number, number] => {
  const [x, y] = project(lon, lat);
  return [x * l.s, y * l.s];
};

/** Schematic unit positions (the home schematic's arrangement), as fractions of the circle radius. */
const UNIT_FRAC: Record<WardCode, [number, number]> = Object.fromEntries(
  WARDS.map((w) => {
    const [x, y] = POS[w.code];
    return [w.code, [((x - 500) / 500) * 0.9, ((y - 280) / 280) * 0.86]];
  }),
) as Record<WardCode, [number, number]>;

export const unitPoint = (l: Layout, code: WardCode): [number, number] => {
  const [fx, fy] = UNIT_FRAC[code];
  return [l.circle.cx + fx * l.circle.r, l.circle.cy + fy * l.circle.r];
};

export const NODE_HALF_W = 27;
export const NODE_HALF_H = 12;

/** A curved path from node a to node b, trimmed to leave both node boxes, and its midpoint. */
export function bendPath(a: [number, number], b: [number, number], bend: number): string {
  const cx = (a[0] + b[0]) / 2 - (b[1] - a[1]) * bend;
  const cy = (a[1] + b[1]) / 2 + (b[0] - a[0]) * bend;
  return `M${a[0].toFixed(1)},${a[1].toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${b[0].toFixed(1)},${b[1].toFixed(1)}`;
}

export function arc(a: [number, number], b: [number, number], bend: number) {
  const cx = (a[0] + b[0]) / 2 - (b[1] - a[1]) * bend;
  const cy = (a[1] + b[1]) / 2 + (b[0] - a[0]) * bend;
  const trim = (p: [number, number], toward: [number, number]): [number, number] => {
    const len = Math.hypot(toward[0] - p[0], toward[1] - p[1]) || 1;
    const ux = (toward[0] - p[0]) / len;
    const uy = (toward[1] - p[1]) / len;
    const k = Math.min((NODE_HALF_W + 5) / (Math.abs(ux) || 1e-6), (NODE_HALF_H + 5) / (Math.abs(uy) || 1e-6));
    return [p[0] + ux * k, p[1] + uy * k];
  };
  const s = trim(a, [cx, cy]);
  const e = trim(b, [cx, cy]);
  return {
    d: `M${s[0].toFixed(1)},${s[1].toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${e[0].toFixed(1)},${e[1].toFixed(1)}`,
    mx: 0.25 * s[0] + 0.5 * cx + 0.25 * e[0],
    my: 0.25 * s[1] + 0.5 * cy + 0.25 * e[1],
  };
}

/** The callout cone from a point to a circle: the two tangent points. */
export function cone(p: [number, number], c: { cx: number; cy: number; r: number }): string {
  const dx = c.cx - p[0];
  const dy = c.cy - p[1];
  const d = Math.hypot(dx, dy);
  const a = Math.atan2(dy, dx);
  const half = Math.asin(Math.min(1, c.r / d));
  const len = Math.sqrt(Math.max(0, d * d - c.r * c.r));
  const t1: [number, number] = [p[0] + len * Math.cos(a + half), p[1] + len * Math.sin(a + half)];
  const t2: [number, number] = [p[0] + len * Math.cos(a - half), p[1] + len * Math.sin(a - half)];
  return `M${p[0].toFixed(1)},${p[1].toFixed(1)} L${t1[0].toFixed(1)},${t1[1].toFixed(1)} L${t2[0].toFixed(1)},${t2[1].toFixed(1)}Z`;
}
