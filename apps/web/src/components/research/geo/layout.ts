import type { WardCode } from "@aei/domain";
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
    // The map keeps the left of the sheet, the inset the right; legend scale and card sit above the inset.
    const sc = 0.78;
    const w = 700;
    const r = 176;
    const h = Math.round((MAP_H + 2 * PAD) * sc);
    return { wide: true, w, h, s: sc, circle: { cx: w - r - 2, cy: h - r - 2, r } };
  }
  // Phone: the inset stacks under the map at full width.
  const sc = 0.82;
  const w = MAP_W + 2 * PAD - 80;
  const r = 206;
  const mapH = Math.round((MAP_H + 2 * PAD) * sc);
  return { wide: false, w, h: mapH + 24 + 2 * r + 8, s: sc, circle: { cx: w / 2, cy: mapH + 24 + r, r } };
}

export const mapPoint = (l: Layout, lon: number, lat: number): [number, number] => {
  const [x, y] = project(lon, lat);
  return [x * l.s, y * l.s];
};

/**
 * Fixed unit positions as fractions of the circle radius. Hand-set, not taken from the home schematic:
 * the two busiest units (ED, ICU) get a gap wide enough for a spread label, and no two boxes touch.
 */
const UNIT_FRAC: Record<WardCode, [number, number]> = {
  "PHC-N": [-0.66, -0.44],
  "PHC-S": [-0.66, 0.44],
  ED: [-0.38, 0],
  ICU: [0.22, 0],
  "MED-A": [-0.04, -0.62],
  URO: [0.58, -0.44],
  SURG: [0.75, 0],
  GER: [0.58, 0.44],
  "MED-B": [-0.04, 0.64],
};

export const unitPoint = (l: Layout, code: WardCode): [number, number] => {
  const [fx, fy] = UNIT_FRAC[code];
  return [l.circle.cx + fx * l.circle.r, l.circle.cy + fy * l.circle.r];
};

export const NODE_HALF_W = 30;
export const NODE_HALF_H = 13;

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
  const at = (u: number): [number, number] => [
    (1 - u) * (1 - u) * s[0] + 2 * (1 - u) * u * cx + u * u * e[0],
    (1 - u) * (1 - u) * s[1] + 2 * (1 - u) * u * cy + u * u * e[1],
  ];
  const tan = (u: number): [number, number] => {
    const dx = 2 * (1 - u) * (cx - s[0]) + 2 * u * (e[0] - cx);
    const dy = 2 * (1 - u) * (cy - s[1]) + 2 * u * (e[1] - cy);
    const len = Math.hypot(dx, dy) || 1;
    return [dx / len, dy / len];
  };
  return {
    at,
    tan,
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

export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface TagSpot {
  /** Centre of the label. */
  x: number;
  y: number;
  /** Where the leader line starts on the curve; null when the label sits on it. */
  from: [number, number] | null;
}

const TAG_H = 18;
const hits = (a: Rect, b: Rect, pad: number) => a.x0 < b.x1 + pad && a.x1 > b.x0 - pad && a.y0 < b.y1 + pad && a.y1 > b.y0 - pad;

/** The box a unit node occupies, with room above it for its alert glyphs. */
export const nodeRect = (p: [number, number]): Rect => ({
  x0: p[0] - NODE_HALF_W - 3,
  x1: p[0] + NODE_HALF_W + 3,
  y0: p[1] - NODE_HALF_H - 13,
  y1: p[1] + NODE_HALF_H + 3,
});

/**
 * Deterministic label placement. Items are placed in the order given; each tries positions along its curve
 * (middle first, then toward the ends), then offsets to either side of it, and takes the cheapest one that
 * stays inside the circle and overlaps no node, glyph or earlier label. A label off its curve gets a leader line.
 */
export function placeTags(
  items: { id: string; w: number; at: (u: number) => [number, number]; tan: (u: number) => [number, number] }[],
  obstacles: Rect[],
  circle: { cx: number; cy: number; r: number },
): Map<string, TagSpot> {
  const placed: Rect[] = [];
  const out = new Map<string, TagSpot>();
  const fits = (r: Rect) =>
    [
      [r.x0, r.y0],
      [r.x1, r.y0],
      [r.x0, r.y1],
      [r.x1, r.y1],
    ].every(([x, y]) => Math.hypot((x as number) - circle.cx, (y as number) - circle.cy) < circle.r - 6);
  for (const it of items) {
    let best: { cost: number; rect: Rect; spot: TagSpot } | null = null;
    for (const u of [0.5, 0.4, 0.6, 0.3, 0.7, 0.22, 0.78]) {
      const [px, py] = it.at(u);
      const [tx, ty] = it.tan(u);
      for (const off of [0, 17, -17, 31, -31]) {
        const x = px - ty * off;
        const y = py + tx * off;
        const rect = { x0: x - it.w / 2, x1: x + it.w / 2, y0: y - TAG_H / 2, y1: y + TAG_H / 2 };
        const cost = Math.abs(u - 0.5) * 60 + Math.abs(off) + (off < 0 ? 1 : 0);
        if (best && cost >= best.cost) continue;
        if (!fits(rect) || obstacles.some((o) => hits(rect, o, 2)) || placed.some((o) => hits(rect, o, 3))) continue;
        best = { cost, rect, spot: { x, y, from: off === 0 ? null : [px, py] } };
      }
    }
    if (!best) {
      const [x, y] = it.at(0.5);
      best = { cost: 0, rect: { x0: x - it.w / 2, x1: x + it.w / 2, y0: y - TAG_H / 2, y1: y + TAG_H / 2 }, spot: { x, y, from: null } };
    }
    placed.push(best.rect);
    out.set(it.id, best.spot);
  }
  return out;
}
