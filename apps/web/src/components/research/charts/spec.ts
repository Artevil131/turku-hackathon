// A chart on the board is described by a plain object, so it survives a reload and can be saved with a
// project later. No numbers live here: the data is fetched and computed again from the spec (useChartData).

import { shift } from "../feed/model.ts";

export const CHART_TYPES = ["share", "bars", "beta", "multiples"] as const;
export type ChartType = (typeof CHART_TYPES)[number];
export const CHART_PERIODS = [7, 14, 28] as const;
export const CHART_WEEKS = [8, 12, 26, 52] as const;

/** A trailing window ends at the clock and moves with it; a fixed one is a result cell's own frame. */
export type ChartWindow = { weeks: number } | { from: string; to: string };

export interface ChartSpec {
  type: ChartType;
  window: ChartWindow;
  /** "" is every unit. Small multiples show every unit and ignore it. */
  unit: string;
  /** "" is every organism. */
  organism: string;
  specimen: string;
  /** `phenotype:esbl` or `antibiotic:CIP` (model.ts `eventKey`). */
  event: string;
  /** Days per period for the share line; the bars and the small multiples are weekly. */
  periodDays: number;
  firstOnly: boolean;
}

export interface Frame {
  from: string;
  to: string;
}

/** The dates a spec covers at this clock; a fixed window never reaches past the clock. */
export function resolveFrame(spec: ChartSpec, asOf: string | null): Frame | null {
  const w = spec.window;
  if ("weeks" in w) return asOf === null ? null : { from: shift(asOf, 1 - w.weeks * 7), to: asOf };
  const to = asOf !== null && asOf < w.to ? asOf : w.to;
  return w.from <= to ? { from: w.from, to } : null;
}

export const defaultSpec = (patch: Partial<ChartSpec> = {}): ChartSpec => ({
  type: "share",
  window: { weeks: 12 },
  unit: "",
  organism: "",
  specimen: "",
  event: "phenotype:esbl",
  periodDays: 14,
  firstOnly: true,
  ...patch,
});

const isStr = (v: unknown): v is string => typeof v === "string";

/** Reads a stored spec; anything malformed gives null (the chart is dropped, the rest of the layout stays). */
export function parseSpec(v: unknown): ChartSpec | null {
  if (typeof v !== "object" || v === null) return null;
  const o = v as Record<string, unknown>;
  const w = o.window as Record<string, unknown> | undefined;
  const window: ChartWindow | null =
    w && typeof w.weeks === "number" && w.weeks >= 1 && w.weeks <= 104
      ? { weeks: Math.round(w.weeks) }
      : w && isStr(w.from) && isStr(w.to)
        ? { from: w.from, to: w.to }
        : null;
  if (!window || !CHART_TYPES.includes(o.type as ChartType)) return null;
  if (!isStr(o.unit) || !isStr(o.organism) || !isStr(o.specimen) || !isStr(o.event) || !/^(phenotype|antibiotic):/.test(o.event))
    return null;
  if (typeof o.periodDays !== "number" || !CHART_PERIODS.includes(o.periodDays as never) || typeof o.firstOnly !== "boolean") return null;
  return {
    type: o.type as ChartType,
    window,
    unit: o.unit,
    organism: o.organism,
    specimen: o.specimen,
    event: o.event,
    periodDays: o.periodDays,
    firstOnly: o.firstOnly,
  };
}
