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
export const GRAPH_W = 480;
export const GRAPH_H = 190;

/**
 * Unit positions as fractions of the graph's area: the patient route runs left to right (health centres, the
 * emergency department, then the wards, the intensive care unit in the middle). Hand-set and schematic, not
 * geography; the two busiest units (ED, ICU) get a gap wide enough for a spread label.
 */
const UNIT_FRAC: Record<WardCode, [number, number]> = {
  "PHC-N": [0.09, 0.2],
  "PHC-S": [0.09, 0.8],
  ED: [0.31, 0.5],
  ICU: [0.58, 0.5],
  "MED-A": [0.47, 0.15],
  URO: [0.84, 0.16],
  SURG: [0.9, 0.5],
  GER: [0.84, 0.84],
  "MED-B": [0.47, 0.85],
};

export const unitPoint = (code: WardCode): [number, number] => {
  const [fx, fy] = UNIT_FRAC[code];
  return [fx * GRAPH_W, fy * GRAPH_H];
};

export const NODE_HALF_W = 32;
export const NODE_HALF_H = 14;

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
  items: { id: string; w: number; at: (u: number) => [number, number]; tan: (u: number) => [number, number] }[],
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
