import type { IsolateRecord } from "@aei/domain";
import type { ExportTable } from "@aei/export";
import { formatDate, type Locale, t, wardName } from "@aei/i18n";
import {
  type BetaResult,
  type CellResult,
  cellTable,
  computeBeta,
  computeShares,
  type EventSpec,
  eventKey,
  parseEvent,
  prepare,
  type SharesResult,
  type Slice,
} from "../tools/model.ts";
import { eventName } from "../tools/ResultCell.tsx";
import { type ChartSpec, type ChartType, defaultSpec, type Frame, resolveFrame } from "./spec.ts";

// The numbers behind a chart window: the same calls the Tools window makes (computeShares, computeBeta over
// `prepare`d records), regrouped. Nothing is estimated here; formatting and the sentence for screen readers only.

export const MAX_MULTIPLES = 12;

export type ChartData =
  | { type: "share" | "bars"; frame: Frame; result: SharesResult }
  | { type: "beta"; frame: Frame; result: BetaResult }
  | { type: "multiples"; frame: Frame; units: { unit: string; result: SharesResult }[] };

/** The records a spec asks the API for (also the cache key of the hook). */
export function recordQuery(spec: ChartSpec, frame: Frame) {
  return {
    from: frame.from,
    to: frame.to,
    ...(spec.unit && spec.type !== "multiples" ? { ward: spec.unit } : {}),
    ...(spec.organism ? { organism: spec.organism } : {}),
    ...(spec.specimen ? { specimen: spec.specimen } : {}),
  };
}

const sliceOf = (spec: ChartSpec, frame: Frame, unit: string): Slice => ({
  ...frame,
  unit,
  organism: spec.organism,
  specimen: spec.specimen,
  phenotype: "",
  firstOnly: spec.firstOnly,
});

export function computeChart(records: readonly IsolateRecord[], spec: ChartSpec, frame: Frame): ChartData {
  const event: EventSpec = parseEvent(spec.event);
  const unit = spec.type === "multiples" ? "" : spec.unit;
  const slice = sliceOf(spec, frame, unit);
  const rows = prepare(records, { ...frame, unit }, spec.firstOnly);
  switch (spec.type) {
    case "share":
      return { type: "share", frame, result: computeShares(rows, slice, event, spec.periodDays) };
    case "bars":
      return { type: "bars", frame, result: computeShares(rows, slice, event, 7) };
    case "beta":
      return { type: "beta", frame, result: computeBeta(rows, null, slice, event, null) };
    case "multiples": {
      const byUnit = new Map<string, IsolateRecord[]>();
      for (const r of rows) byUnit.set(r.ward, [...(byUnit.get(r.ward) ?? []), r]);
      const units = [...byUnit.entries()]
        .sort((a, b) => b[1].length - a[1].length || (a[0] < b[0] ? -1 : 1))
        .slice(0, MAX_MULTIPLES)
        .map(([u, rs]) => ({ unit: u, result: computeShares(rs, sliceOf(spec, frame, u), event, 7) }));
      return { type: "multiples", frame, units };
    }
  }
}

/** The chart's numbers as one table for the friend's CSV exporter. */
export function chartTable(data: ChartData): ExportTable {
  if (data.type === "multiples") {
    const columns = ["unit", "from", "to", "k", "n", "share", "lo", "hi"].map((key) => ({ key, label: key }));
    return {
      name: "chart-multiples",
      title: "Weekly share per unit",
      columns,
      rows: data.units.flatMap((u) => cellTable(u.result).rows.map((r) => ({ unit: u.unit, ...r }))),
    };
  }
  const t0 = cellTable(data.result);
  return { ...t0, name: `chart-${data.type}`, title: data.type === "bars" ? "Events per week" : t0.title };
}
// ---------- words ----------

export const pct = (v: number, locale: Locale) => `${(v * 100).toLocaleString(locale, { maximumFractionDigits: 1 })} %`;

function monthRange(locale: Locale, f: Frame): string {
  const fmt = (iso: string, withYear: boolean) =>
    new Intl.DateTimeFormat(locale === "fi" ? "fi-FI" : "en-GB", {
      timeZone: "UTC",
      month: "short",
      ...(withYear ? { year: "numeric" } : {}),
    }).format(new Date(`${iso}T00:00:00Z`));
  const b = fmt(f.to, true);
  return f.from.slice(0, 7) === f.to.slice(0, 7) ? b : `${fmt(f.from, f.from.slice(0, 4) !== f.to.slice(0, 4))}–${b}`;
}

/** "ESBL share per 14 days · Urology · Feb–May 2025"; before the clock starts a trailing window reads "last 12 weeks". */
export function chartTitle(locale: Locale, spec: ChartSpec, asOf: string | null): string {
  const event = eventName(locale, parseEvent(spec.event));
  const what = t(locale, `chartTitle_${spec.type}` as "chartTitle_share", { event, days: spec.periodDays });
  const unit = spec.type === "multiples" ? "" : spec.unit ? wardName(locale, spec.unit as never) : t(locale, "toolsUnitAll");
  const frame = resolveFrame(spec, asOf);
  const when = frame ? monthRange(locale, frame) : "weeks" in spec.window ? t(locale, "chartLastWeeks", { n: spec.window.weeks }) : "";
  return [what, unit, when].filter(Boolean).join(" · ");
}

const known = (p: SharesResult["points"][number]): p is typeof p & { share: number; interval: { lo: number; hi: number } } =>
  p.share !== null && p.interval !== null && Number.isFinite(p.share);

/** One sentence that states the figure's numbers, for the img role's label. */
export function chartAria(locale: Locale, title: string, data: ChartData): string {
  const range = (lo: number, hi: number) => `${pct(lo, locale)}–${pct(hi, locale)}`;
  const periods = (r: SharesResult) =>
    r.points
      .filter(known)
      .map((p) => `${formatDate(locale, p.from)} ${pct(p.share, locale)} (${range(p.interval.lo, p.interval.hi)})`)
      .join("; ");
  switch (data.type) {
    case "share":
      return `${title}. ${periods(data.result) || t(locale, "chartNoData")}`;
    case "bars":
      return `${title}. ${data.result.points.map((p) => `${formatDate(locale, p.from)} ${p.k}/${p.n}`).join("; ") || t(locale, "chartNoData")}`;
    case "beta": {
      const b = data.result.posterior;
      return `${title}. ${t(locale, "toolsBetaAria", { k: data.result.k, n: data.result.n, mean: pct(b.mean, locale), range: range(b.interval.lo, b.interval.hi) })}`;
    }
    case "multiples":
      return `${title}. ${
        data.units
          .map((u) => {
            const last = [...u.result.points].reverse().find(known);
            return `${wardName(locale, u.unit as never)}: ${last ? pct(last.share, locale) : "–"}`;
          })
          .join("; ") || t(locale, "chartNoData")
      }`;
  }
}

export const hasData = (d: ChartData): boolean =>
  d.type === "multiples" ? d.units.length > 0 : d.type === "beta" ? d.result.n > 0 : d.result.points.some((p) => p.n > 0);

// ---------- from the Tools window ----------

const CHART_OF = { shares: "share", beta: "beta", rate: "bars", compare: "share" } as const;

/** The chart a result cell asks for: its own slice and frame, its event, the type that shows it best. Null for a detector run. */
export function specFromResult(r: CellResult, type?: ChartType): ChartSpec | null {
  if (r.kind === "detector") return null;
  const event = r.kind === "rate" ? (r.slice.phenotype ? `phenotype:${r.slice.phenotype}` : "phenotype:esbl") : eventKey(r.event);
  return defaultSpec({
    type: type ?? CHART_OF[r.kind],
    window: { from: r.slice.from, to: r.slice.to },
    unit: r.slice.unit,
    organism: r.slice.organism,
    specimen: r.slice.specimen,
    event,
    periodDays: r.kind === "shares" ? r.periodDays : 14,
    firstOnly: r.slice.firstOnly,
  });
}

/** The chart of the Tools window's current slice and event (the buttons on the share and Beta forms). */
export function specFromSlice(s: Slice, event: string, type: ChartType, periodDays: number): ChartSpec {
  return defaultSpec({
    type,
    window: { from: s.from, to: s.to },
    unit: s.unit,
    organism: s.organism,
    specimen: s.specimen,
    event,
    periodDays,
    firstOnly: s.firstOnly,
  });
}
