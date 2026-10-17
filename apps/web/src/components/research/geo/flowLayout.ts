import type { WardCode } from "@aei/domain";

// Pure layout of the focused flow view (a small three-column Sankey): grouping
// of small flows, band order, stacking at both ends without crossings, and the
// path of one band. Positions are on the cross axis (y when the columns sit
// side by side, x when they are stacked); the component maps them to the page.

export interface SideFlow {
  unit: WardCode;
  patients: number;
}

/** One band: a unit, or the grouped small flows. */
export interface Item {
  key: string;
  /** The unit of the band; null for "others". */
  unit: WardCode | null;
  units: WardCode[];
  patients: number;
  /** Share of the side's total flow, 0 to 1. */
  share: number;
}

export interface GroupOptions {
  /** Flows under this share of the side's total are small. */
  minShare?: number;
  /** Flows under this many patients are small. */
  minN?: number;
  /** Keep at most this many named bands; the rest are grouped. */
  maxItems?: number;
}

export const OTHERS = "others";

/**
 * Bands of one side, biggest first (ties by unit code). Flows under 3 % of the
 * side or under 2 patients are grouped into one "others" band, placed last; a
 * single small flow stays under its own name, since "others" would hide nothing.
 */
export function groupFlows(
  flows: readonly SideFlow[],
  { minShare = 0.03, minN = 2, maxItems = Number.POSITIVE_INFINITY }: GroupOptions = {},
): Item[] {
  const total = flows.reduce((s, f) => s + f.patients, 0);
  if (total <= 0) return [];
  const sorted = flows.filter((f) => f.patients > 0).sort((a, b) => b.patients - a.patients || a.unit.localeCompare(b.unit));
  const big: SideFlow[] = [];
  const small: SideFlow[] = [];
  for (const f of sorted) (f.patients >= minN && f.patients / total >= minShare && big.length < maxItems ? big : small).push(f);
  const named = (f: SideFlow): Item => ({ key: f.unit, unit: f.unit, units: [f.unit], patients: f.patients, share: f.patients / total });
  const items = big.map(named);
  if (small.length === 1 && small[0]) items.push(named(small[0]));
  else if (small.length > 1) {
    const n = small.reduce((s, f) => s + f.patients, 0);
    items.push({ key: OTHERS, unit: null, units: small.map((f) => f.unit), patients: n, share: n / total });
  }
  return items;
}

export interface Placed extends Item {
  /** Thickness of the band, cross-axis units. */
  t: number;
  /** The band's extent where it meets the centre node. */
  c0: number;
  c1: number;
  /** The unit node's box. */
  n0: number;
  n1: number;
  /** The band's extent where it meets the unit node (inside the box). */
  b0: number;
  b1: number;
}

export interface FlowLayoutOptions {
  /** Length of the cross axis. */
  span: number;
  minBand?: number;
  minNode?: number;
  gap?: number;
  /** Space kept free at both ends of the cross axis. */
  margin?: number;
  /** The centre node is never shorter than this. */
  centreMin?: number;
}

export interface FlowLayout {
  /** Cross-axis units per patient. */
  k: number;
  centre: { c0: number; c1: number };
  ins: Placed[];
  outs: Placed[];
}

function placeSide(items: Item[], k: number, mid: number, minBand: number, minNode: number, gap: number): Placed[] {
  const t = items.map((i) => Math.max(minBand, i.patients * k));
  const h = t.map((x) => Math.max(x, minNode));
  const stack = t.reduce((s, x) => s + x, 0);
  const nodes = h.reduce((s, x) => s + x, 0) + gap * Math.max(0, items.length - 1);
  let c = mid - stack / 2;
  let n = mid - nodes / 2;
  return items.map((item, i) => {
    const ti = t[i] as number;
    const hi = h[i] as number;
    const p: Placed = { ...item, t: ti, c0: c, c1: c + ti, n0: n, n1: n + hi, b0: n + (hi - ti) / 2, b1: n + (hi + ti) / 2 };
    c += ti;
    n += hi + gap;
    return p;
  });
}

const sumT = (items: Item[], k: number, minBand: number) => items.reduce((s, i) => s + Math.max(minBand, i.patients * k), 0);
const nodesLen = (items: Item[], k: number, minBand: number, minNode: number, gap: number) =>
  items.reduce((s, i) => s + Math.max(minNode, Math.max(minBand, i.patients * k)), 0) + gap * Math.max(0, items.length - 1);

/**
 * One scale for both sides (a band's thickness is its patients times k), both
 * stacks centred on the middle of the axis and kept in the same order at the
 * centre node and at the unit nodes, so bands never cross. k is the largest
 * scale at which the tallest stack takes about 70 % of the axis and every
 * unit node still fits.
 */
export function layoutFlow(ins: Item[], outs: Item[], opts: FlowLayoutOptions): FlowLayout {
  const { span, minBand = 3, minNode = 28, gap = 6, margin = 4, centreMin = 40 } = opts;
  const mid = span / 2;
  const room = Math.max(1, span - 2 * margin);
  const most = Math.max(
    ins.reduce((s, i) => s + i.patients, 0),
    outs.reduce((s, i) => s + i.patients, 0),
    1,
  );
  let k = (room * 0.7) / most;
  for (let guard = 0; guard < 60; guard++) {
    if (Math.max(nodesLen(ins, k, minBand, minNode, gap), nodesLen(outs, k, minBand, minNode, gap)) <= room) break;
    k *= 0.93;
  }
  const height = Math.max(centreMin, sumT(ins, k, minBand), sumT(outs, k, minBand));
  return {
    k,
    centre: { c0: mid - height / 2, c1: mid + height / 2 },
    ins: placeSide(ins, k, mid, minBand, minNode, gap),
    outs: placeSide(outs, k, mid, minBand, minNode, gap),
  };
}

const f = (n: number) => n.toFixed(1);

/**
 * The closed path of one band from the near edge (a, extent a0..a1 on the cross
 * axis) to the far edge (b, extent b0..b1) with smooth cubic curves whose
 * control points sit halfway along the main axis. `vertical` swaps the axes for
 * the stacked layout.
 */
export function bandPath(a: number, a0: number, a1: number, b: number, b0: number, b1: number, vertical = false): string {
  const m = (a + b) / 2;
  const p = (x: number, y: number) => (vertical ? `${f(y)},${f(x)}` : `${f(x)},${f(y)}`);
  return `M${p(a, a0)} C${p(m, a0)} ${p(m, b0)} ${p(b, b0)} L${p(b, b1)} C${p(m, b1)} ${p(m, a1)} ${p(a, a1)} Z`;
}

/**
 * Fill opacity of a band by its patients: one ramp for the whole view, the
 * largest band strongest (`hi`), the smallest light (`lo`). Square-root easing,
 * so a band of a few patients is still visible beside a band of a hundred.
 */
export function bandOpacity(patients: number, max: number, lo: number, hi: number): number {
  if (!(max > 0)) return lo;
  const t = Math.min(1, Math.max(0, patients / max));
  return lo + (hi - lo) * Math.sqrt(t);
}

/** Shade step of a matrix cell, 0 for no patients, else 1..steps by patients over the largest cell. */
export function shadeStep(patients: number, max: number, steps = 7): number {
  if (!(patients > 0) || !(max > 0)) return 0;
  return Math.min(steps, Math.max(1, Math.ceil((patients / max) * steps)));
}

export interface FlowMatrix {
  /** n[i][j]: patients from codes[i] to codes[j]; the diagonal stays 0. */
  n: number[][];
  max: number;
  rowTotal: number[];
  colTotal: number[];
}

/** The flows as a square matrix over `codes` (rows from, columns to); repeated pairs add up, other units are ignored. */
export function flowMatrix(flows: readonly { from: WardCode; to: WardCode; patients: number }[], codes: readonly WardCode[]): FlowMatrix {
  const at = new Map(codes.map((c, i) => [c, i]));
  const n = codes.map(() => codes.map(() => 0));
  for (const f of flows) {
    const i = at.get(f.from);
    const j = at.get(f.to);
    if (i === undefined || j === undefined || i === j || !(f.patients > 0)) continue;
    (n[i] as number[])[j] = ((n[i] as number[])[j] as number) + f.patients;
  }
  const rowTotal = n.map((r) => r.reduce((s, x) => s + x, 0));
  const colTotal = codes.map((_, j) => n.reduce((s, r) => s + (r[j] as number), 0));
  return { n, max: Math.max(0, ...n.flat()), rowTotal, colTotal };
}
