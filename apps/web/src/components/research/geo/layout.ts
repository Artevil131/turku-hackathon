import type { WardCode } from "@aei/domain";
import { MAP_H, MAP_W, PAD, project } from "../map/geo.ts";

// Geometry of the map window: the map of Finland, either alone at full width
// (narrow) or on the left with room on the right for the legend and the card
// (wide). The unit graph has its own geometry (unitPoint below). All in
// viewBox units.

export interface Layout {
  wide: boolean;
  w: number;
  h: number;
  /** Scale applied to the map. */
  s: number;
}

/** The map fills its panel: one viewBox, scaled by the browser; the bottom strip is room for the legend. */
export const MAP_LAYOUT: Layout = { wide: true, w: MAP_W + 2 * PAD, h: MAP_H + 2 * PAD + 34, s: 1 };

export const mapPoint = (l: Layout, lon: number, lat: number): [number, number] => {
  const [x, y] = project(lon, lat);
  return [x * l.s, y * l.s];
};

/** The unit graph's drawing area, in viewBox units. */
export const GRAPH_W = 420;
export const GRAPH_H = 300;

/** Centre of the inner ring; the health centres and the emergency department sit on an outer arc to its left. */
const CENTER: [number, number] = [232, 150];

/**
 * Unit positions: the six hospital units on an inner ring, the emergency department and the two health centres
 * outside it, so the patient route reads from the outside in. Hand-set and schematic, not geography; the gaps
 * are wide enough for a "share · n" label beside an edge.
 */
const UNIT_POINT: Record<WardCode, [number, number]> = {
  ED: [38, 150],
  "PHC-N": [136, 46],
  "PHC-S": [136, 254],
  ICU: [140, 150],
  "MED-A": [186, 98],
  SURG: [278, 98],
  URO: [324, 150],
  GER: [278, 202],
  "MED-B": [186, 202],
};

export const unitPoint = (code: WardCode): [number, number] => UNIT_POINT[code];

export const NODE_HALF_W = 29;
export const NODE_HALF_H = 13;

/** A curved path from node a to node b, trimmed to leave both node boxes, and its midpoint. */
export function bendPath(a: [number, number], b: [number, number], bend: number): string {
  const cx = (a[0] + b[0]) / 2 - (b[1] - a[1]) * bend;
  const cy = (a[1] + b[1]) / 2 + (b[0] - a[0]) * bend;
  return `M${a[0].toFixed(1)},${a[1].toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${b[0].toFixed(1)},${b[1].toFixed(1)}`;
}

/** A quadratic curve from node a to node b through control point c, trimmed to leave both node boxes. */
export function curve(a: [number, number], b: [number, number], c: [number, number]) {
  const [cx, cy] = c;
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

export function arc(a: [number, number], b: [number, number], bend: number) {
  return curve(a, b, [(a[0] + b[0]) / 2 - (b[1] - a[1]) * bend, (a[1] + b[1]) / 2 + (b[0] - a[0]) * bend]);
}

const inside = (p: [number, number], r: { x0: number; x1: number; y0: number; y1: number }) =>
  p[0] > r.x0 && p[0] < r.x1 && p[1] > r.y0 && p[1] < r.y1;

/**
 * The control point of the edge between units a and b: bulging away from the middle of the graph (so edges
 * run round the ring, not across it), by the smallest bend whose curve leaves every other unit's box clear.
 * Deterministic and symmetric: route(a, b) and route(b, a) are the same curve.
 */
export function route(a: WardCode, b: WardCode): [number, number] {
  const [from, to] = a < b ? [a, b] : [b, a];
  const p = unitPoint(from);
  const q = unitPoint(to);
  const len = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
  const m: [number, number] = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  const n: [number, number] = [-(q[1] - p[1]) / len, (q[0] - p[0]) / len];
  const out = n[0] * (m[0] - CENTER[0]) + n[1] * (m[1] - CENTER[1]) >= 0 ? 1 : -1;
  const boxes = WARDS_ALL.filter((w) => w !== from && w !== to).map((w) => {
    const [x, y] = unitPoint(w);
    return { x0: x - NODE_HALF_W - 5, x1: x + NODE_HALF_W + 5, y0: y - NODE_HALF_H - 5, y1: y + NODE_HALF_H + 5 };
  });
  let best: { c: [number, number]; hits: number } | null = null;
  for (const k of [0.14, -0.14, 0.26, -0.26, 0.4, -0.4, 0.55, -0.55]) {
    const c: [number, number] = [m[0] + n[0] * out * k * len, m[1] + n[1] * out * k * len];
    const g = curve(p, q, c);
    let hits = 0;
    for (let u = 0.06; u <= 0.94; u += 0.04) {
      const pt = g.at(u);
      if (boxes.some((r) => inside(pt, r))) hits++;
    }
    if (!best || hits < best.hits) best = { c, hits };
    if (hits === 0) break;
  }
  return (best as NonNullable<typeof best>).c;
}

const WARDS_ALL = Object.keys(UNIT_POINT) as WardCode[];

/** Which side of a curve at u faces away from the middle of the graph: +1 along its left normal, else -1. */
export function outwardSide(g: { at: (u: number) => [number, number]; tan: (u: number) => [number, number] }, u = 0.5): 1 | -1 {
  const [x, y] = g.at(u);
  const [tx, ty] = g.tan(u);
  return -ty * (x - CENTER[0]) + tx * (y - CENTER[1]) >= 0 ? 1 : -1;
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

const TAG_H = 20;
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
 * stays inside the bounds and overlaps no node, glyph or earlier label. A label off its curve gets a leader line.
 */
export function placeTags(
  items: { id: string; w: number; side?: 1 | -1; at: (u: number) => [number, number]; tan: (u: number) => [number, number] }[],
  obstacles: Rect[],
  bounds: Rect,
): Map<string, TagSpot> {
  const placed: Rect[] = [];
  const out = new Map<string, TagSpot>();
  const fits = (r: Rect) => r.x0 >= bounds.x0 + 4 && r.x1 <= bounds.x1 - 4 && r.y0 >= bounds.y0 + 4 && r.y1 <= bounds.y1 - 4;
  for (const it of items) {
    let best: { cost: number; rect: Rect; spot: TagSpot } | null = null;
    for (const u of [0.5, 0.4, 0.6, 0.3, 0.7, 0.22, 0.78]) {
      const [px, py] = it.at(u);
      const [tx, ty] = it.tan(u);
      const sd = it.side ?? 1;
      for (const off of [0, 17 * sd, -17 * sd, 31 * sd, -31 * sd]) {
        const x = px - ty * off;
        const y = py + tx * off;
        const rect = { x0: x - it.w / 2, x1: x + it.w / 2, y0: y - TAG_H / 2, y1: y + TAG_H / 2 };
        const cost = Math.abs(u - 0.5) * 60 + Math.abs(off) + (off * sd < 0 ? 12 : 0) + (off === 0 ? 24 : 0);
        if (best && cost >= best.cost) continue;
        if (!fits(rect) || obstacles.some((o) => hits(rect, o, 2)) || placed.some((o) => hits(rect, o, 3))) continue;
        best = { cost, rect, spot: { x, y, from: Math.abs(off) < 20 ? null : [px, py] } };
      }
    }
    // A label that would collide is dropped; the edge's tooltip still carries the figures.
    if (!best) continue;
    placed.push(best.rect);
    out.set(it.id, best.spot);
  }
  return out;
}
