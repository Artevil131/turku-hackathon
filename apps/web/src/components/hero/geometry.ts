import type { Alert, WeeklyResponse } from "@aei/contract";
import type { WardCode } from "@aei/domain";
import { type Locale, phenotypeName, t, wardName } from "@aei/i18n";

// Pure helpers for the weekly stream: day maths, monotone cubic paths (no
// library), stacked layers, alert pills.

const DAY_MS = 86_400_000;
export const dayNumber = (iso: string) => Math.round(Date.parse(`${iso}T00:00:00Z`) / DAY_MS);
export const isoFromDay = (n: number) => new Date(n * DAY_MS).toISOString().slice(0, 10);
/** `12.5.2025`: the compact date of the design (same in both languages). */
export const compactDate = (iso: string) => `${Number(iso.slice(8, 10))}.${Number(iso.slice(5, 7))}.${iso.slice(0, 4)}`;

export const PHENOTYPE_ORDER = ["esbl", "mrsa", "vre", "cpe"] as const;
export type Ph = (typeof PHENOTYPE_ORDER)[number];
export const SURPRISE_CAP = 6;

export type Pt = readonly [number, number];

interface Seg {
  c1: Pt;
  c2: Pt;
  p: Pt;
}

/** Fritsch–Carlson monotone cubic segments through points sorted by x: no overshoot, no library. */
export function monotoneSegments(pts: readonly Pt[]): Seg[] {
  const n = pts.length;
  if (n < 2) return [];
  const dx: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const a = pts[i] as Pt;
    const b = pts[i + 1] as Pt;
    dx.push(b[0] - a[0]);
    m.push(b[0] === a[0] ? 0 : (b[1] - a[1]) / (b[0] - a[0]));
  }
  const tan: number[] = [m[0] as number];
  for (let i = 1; i < n - 1; i++) {
    const s0 = m[i - 1] as number;
    const s1 = m[i] as number;
    tan.push(s0 * s1 <= 0 ? 0 : (s0 + s1) / 2);
  }
  tan.push(m[n - 2] as number);
  for (let i = 0; i < n - 1; i++) {
    const s = m[i] as number;
    if (s === 0) {
      tan[i] = 0;
      tan[i + 1] = 0;
      continue;
    }
    const a = (tan[i] as number) / s;
    const b = (tan[i + 1] as number) / s;
    const h = Math.hypot(a, b);
    if (h > 3) {
      tan[i] = ((3 * a) / h) * s;
      tan[i + 1] = ((3 * b) / h) * s;
    }
  }
  const out: Seg[] = [];
  for (let i = 0; i < n - 1; i++) {
    const a = pts[i] as Pt;
    const b = pts[i + 1] as Pt;
    const d = (dx[i] as number) / 3;
    out.push({ c1: [a[0] + d, a[1] + d * (tan[i] as number)], c2: [b[0] - d, b[1] - d * (tan[i + 1] as number)], p: b });
  }
  return out;
}

const f = (v: number) => Math.round(v * 100) / 100;
const C = (s: Seg) => `C${f(s.c1[0])} ${f(s.c1[1])} ${f(s.c2[0])} ${f(s.c2[1])} ${f(s.p[0])} ${f(s.p[1])}`;

/** `M x y C …` through the points. */
export function linePath(pts: readonly Pt[]): string {
  const first = pts[0];
  if (!first) return "";
  return `M${f(first[0])} ${f(first[1])}${monotoneSegments(pts).map(C).join("")}`;
}

/** Closed band between an upper and a lower curve (both sorted by x). */
export function bandPath(upper: readonly Pt[], lower: readonly Pt[]): string {
  const u = upper[0];
  const l = lower[lower.length - 1];
  if (!u || !l) return "";
  const back = [...lower].reverse();
  return `${linePath(upper)}L${f(l[0])} ${f(l[1])}${monotoneSegments(back).map(C).join("")}Z`;
}

/** Dated week index (Monday) of a day number; -1 when before the first week. */
export function weekIndex(weekDays: readonly number[], day: number): number {
  let lo = 0;
  let hi = weekDays.length - 1;
  let at = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if ((weekDays[mid] as number) <= day) {
      at = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return at;
}

export interface WeekRow {
  /** Monday. */
  date: string;
  day: number;
  /** Last day shown (Sunday, or the as-of date for the last, partial week). */
  last: string;
  partial: boolean;
  /** Counts hidden: a partial week the loaded data reaches beyond. */
  hidden: boolean;
  ph: Record<Ph, number>;
  cultures: number;
  units: Partial<Record<WardCode, number>>;
  /** Per unit and phenotype, and the unit's cultures: the raw counts a ratio is made of. */
  uph: Partial<Record<WardCode, Record<Ph, number>>>;
  ucult: Partial<Record<WardCode, number>>;
  total: number;
}

/** The weekly series cut at the as-of date: nothing after it is kept. */
export function weekRows(data: WeeklyResponse | null, asOf: string): WeekRow[] {
  if (!data) return [];
  const rows: WeekRow[] = [];
  const asOfDay = dayNumber(asOf);
  const wards = Object.keys(data.units) as WardCode[];
  data.weeks.forEach((w, i) => {
    const day = dayNumber(w);
    if (day > asOfDay) return;
    const partial = asOfDay < day + 6;
    const hidden = partial && data.asOf > asOf;
    const ph = { esbl: 0, mrsa: 0, vre: 0, cpe: 0 };
    const units: Partial<Record<WardCode, number>> = {};
    const uph: WeekRow["uph"] = {};
    const ucult: WeekRow["ucult"] = {};
    let cultures = 0;
    for (const u of wards) {
      const uw = data.units[u];
      if (!uw) continue;
      cultures += uw.cultures[i] ?? 0;
      ucult[u] = uw.cultures[i] ?? 0;
      let sum = 0;
      const mine = { esbl: 0, mrsa: 0, vre: 0, cpe: 0 };
      for (const p of PHENOTYPE_ORDER) {
        const v = uw.phenotypes[p]?.[i] ?? 0;
        ph[p] += v;
        mine[p] = v;
        sum += v;
      }
      units[u] = sum;
      uph[u] = mine;
    }
    const total = ph.esbl + ph.mrsa + ph.vre + ph.cpe;
    rows.push({ date: w, day, last: partial ? asOf : isoFromDay(day + 6), partial, hidden, ph, cultures, units, uph, ucult, total });
  });
  return rows;
}

// ---- alert pills -------------------------------------------------------------

export type PillKind = "sentinel" | "cluster" | "trend" | "data";

export function pillKind(a: Alert): PillKind {
  if (a.kind !== "detector") return a.kind === "carrier" ? "cluster" : "sentinel";
  switch (a.detector) {
    case "profile-excess":
    case "phenotype-excess":
      return "cluster";
    case "rising-trend":
      return "trend";
    default:
      return "data";
  }
}

/** −log10 p capped at 6; null where the alert has no test (rules). */
export function surprise(a: Alert): number | null {
  if (a.kind !== "detector" || a.p === undefined) return null;
  return a.p <= 0 ? SURPRISE_CAP : Math.min(Math.max(-Math.log10(a.p), 0), SURPRISE_CAP);
}

function num(locale: Locale, v: number): string {
  return new Intl.NumberFormat(locale === "fi" ? "fi-FI" : "en-GB", {
    maximumFractionDigits: Math.abs(v) < 10 && v % 1 !== 0 ? 1 : 0,
  }).format(v);
}

/** What caused the alert, in a few characters: "ESBL 7 · 1.4", "MRSA new", "no samples". */
export function pillLabel(locale: Locale, a: Alert): string {
  if (a.kind === "cpe") return phenotypeName("cpe");
  if (a.kind === "new-in-unit") return `${phenotypeName(a.phenotype)} ${t(locale, "tlPillNew")}`;
  if (a.kind === "carrier") return `${phenotypeName(a.phenotype)} ${t(locale, "tlPillCarrier")}`;
  const ratio = a.expected === undefined ? num(locale, a.observed) : `${num(locale, a.observed)} · ${num(locale, a.expected)}`;
  switch (a.detector) {
    case "phenotype-excess":
      return `${a.phenotype ? phenotypeName(a.phenotype) : t(locale, "tlCluster")} ${ratio}`;
    case "profile-excess":
      return `${t(locale, "tlPillProfile")} ${ratio}`;
    case "rising-trend":
      return `${t(locale, "tlPillTrend")} ↗`;
    case "sampling-drop":
      return `${t(locale, "tlPillSamples")} ${ratio}`;
    case "empty-run":
      return t(locale, "tlPillNoSamples");
  }
}

/** One line for assistive technology and the readout: label, unit, date, surprise. */
export function pillLine(locale: Locale, a: Alert): string {
  const parts = [pillLabel(locale, a)];
  if (a.ward) parts.push(wardName(locale, a.ward));
  parts.push(compactDate(a.date));
  const s = surprise(a);
  if (s !== null) parts.push(`${t(locale, "tlSurprise")} ${num(locale, Math.round(s * 10) / 10)}`);
  return parts.join(" · ");
}

export const PILL_CHAR = 7.7;
export const pillWidth = (label: string, glyph: boolean) => Math.ceil(label.length * PILL_CHAR + 8 + (glyph ? 7 : 0));

/** Splits points at gaps (null): every stretch of consecutive points is drawn on its own. */
export function runs(pts: readonly (Pt | null)[]): Pt[][] {
  const out: Pt[][] = [];
  let cur: Pt[] = [];
  for (const p of pts) {
    if (p) cur.push(p);
    else if (cur.length) {
      out.push(cur);
      cur = [];
    }
  }
  if (cur.length) out.push(cur);
  return out;
}
