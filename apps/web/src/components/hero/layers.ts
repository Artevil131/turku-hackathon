import type { WardCode } from "@aei/domain";
import { useCallback, useEffect, useRef, useState } from "react";
import { knownWard, siteWards } from "../../sites.ts";
import { hashPage, hashParams } from "../../url.ts";
import { dayNumber, PHENOTYPE_ORDER, type Ph, type PillKind, type WeekRow } from "./geometry.ts";

// What the band shows, chosen by the reader: lines, metric, stacking, unit lanes, signal kinds and
// the window. Kept in localStorage and in the URL hash as `tl=`, a short dot-separated code that
// lists only what differs from the default, e.g. `tl=r.o.w26.-cult.-u:ICU.-k:data`.

export type LineKey = Ph | "cult";
export const LINE_KEYS: readonly LineKey[] = [...PHENOTYPE_ORDER, "cult"];
export const PILL_KINDS: readonly PillKind[] = ["sentinel", "cluster", "trend", "data"];
export const WINDOWS = [0, 52, 26, 12] as const;
export type WindowWeeks = (typeof WINDOWS)[number];
/** The unit lanes: the selected hospital's units (D-051). */
export const wardCodes = (): WardCode[] => siteWards().map((w) => w.code);

export interface Layers {
  /** Hidden lines. */
  lines: Record<LineKey, boolean>;
  /** "count": patients per week; "ratio": per 100 cultures of the same week. */
  metric: "count" | "ratio";
  stacked: boolean;
  /** Hidden unit lanes and signal kinds are listed, so the default is the empty list. */
  units: Record<string, boolean>;
  kinds: Record<PillKind, boolean>;
  /** 0: whole history, else the last n weeks. */
  window: WindowWeeks;
}

const allOn = <K extends string>(keys: readonly K[]) => Object.fromEntries(keys.map((k) => [k, true])) as Record<K, boolean>;

export const DEFAULT_LAYERS: Layers = {
  lines: allOn(LINE_KEYS),
  metric: "count",
  stacked: true,
  units: {},
  kinds: allOn(PILL_KINDS),
  window: 0,
};

/** The short code; "" for the default. */
export function encodeLayers(l: Layers): string {
  const out: string[] = [];
  for (const k of LINE_KEYS) if (!l.lines[k]) out.push(`-${k}`);
  if (l.metric === "ratio") out.push("r");
  if (!l.stacked) out.push("o");
  if (l.window) out.push(`w${l.window}`);
  for (const [u, on] of Object.entries(l.units)) if (on === false) out.push(`-u:${u}`);
  for (const k of PILL_KINDS) if (!l.kinds[k]) out.push(`-k:${k}`);
  return out.join(".");
}

/** Reads a code; anything unknown is ignored. */
export function decodeLayers(code: string | null | undefined): Layers {
  const l: Layers = {
    ...DEFAULT_LAYERS,
    lines: { ...DEFAULT_LAYERS.lines },
    units: { ...DEFAULT_LAYERS.units },
    kinds: { ...DEFAULT_LAYERS.kinds },
  };
  for (const tok of (code ?? "").split(".")) {
    if (tok === "r") l.metric = "ratio";
    else if (tok === "o") l.stacked = false;
    else if (/^w\d+$/.test(tok)) {
      const n = Number(tok.slice(1)) as WindowWeeks;
      if (WINDOWS.includes(n)) l.window = n;
    } else if (tok.startsWith("-u:")) {
      const u = tok.slice(3);
      if (knownWard(u)) l.units[u] = false;
    } else if (tok.startsWith("-k:")) {
      const k = tok.slice(3) as PillKind;
      if (k in l.kinds) l.kinds[k] = false;
    } else if (tok.startsWith("-")) {
      const k = tok.slice(1) as LineKey;
      if (k in l.lines) l.lines[k] = false;
    }
  }
  return l;
}

// ---- per-week values under a metric ----------------------------------------------------------

export interface View {
  ph: Record<Ph, number | null>;
  units: Partial<Record<WardCode, number | null>>;
  /** Sum of the visible phenotypes, null where the ratio has no cultures to divide by. */
  total: number | null;
}
export type ViewRow = WeekRow & { v: View };

const per100 = (n: number, cultures: number) => (cultures > 0 ? (n / cultures) * 100 : null);

/**
 * Each week under the chosen metric. A ratio is the same raw counts divided by the same week's
 * cultures x 100 (D-042); a week with no cultures is null (a gap), never a division by zero.
 * Hidden phenotypes leave the totals and the unit lanes.
 */
export function viewRows(rows: readonly WeekRow[], l: Layers): ViewRow[] {
  const ratio = l.metric === "ratio";
  const on = PHENOTYPE_ORDER.filter((p) => l.lines[p]);
  return rows.map((r) => {
    const ph = {} as Record<Ph, number | null>;
    let sum = 0;
    for (const p of PHENOTYPE_ORDER) {
      ph[p] = ratio ? per100(r.ph[p], r.cultures) : r.ph[p];
      if (on.includes(p)) sum += r.ph[p];
    }
    const units: Partial<Record<WardCode, number | null>> = {};
    for (const [u, byPh] of Object.entries(r.uph) as [WardCode, Record<Ph, number>][]) {
      const n = on.reduce((s, p) => s + byPh[p], 0);
      units[u] = ratio ? per100(n, r.ucult[u] ?? 0) : n;
    }
    return { ...r, v: { ph, units, total: ratio ? per100(sum, r.cultures) : sum } };
  });
}

/** Rows of the chosen window; the right edge stays at the replay date. */
export function windowRows<T extends { day: number }>(rows: readonly T[], weeks: WindowWeeks): T[] {
  return weeks && rows.length > weeks ? rows.slice(rows.length - weeks) : [...rows];
}

/** First day of the window, never before the dataset start. */
export function windowStart(start: string, firstRow: { day: number } | undefined, weeks: WindowWeeks): number {
  const d0 = dayNumber(start);
  return weeks && firstRow ? Math.max(d0, firstRow.day) : d0;
}

// ---- URL and storage -------------------------------------------------------------------------

const KEY = "aei.timeline.layers";

function stored(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}
function store(code: string) {
  try {
    if (code) localStorage.setItem(KEY, code);
    else localStorage.removeItem(KEY);
  } catch {
    /* private mode: the choice lives for the session only */
  }
}

/** Puts `tl` into the current hash without touching the page's own params. */
function writeTl(code: string) {
  const params = hashParams();
  if ((params.get("tl") ?? "") === code) return;
  if (code) params.set("tl", code);
  else params.delete("tl");
  const qs = params.toString().replace(/%3A/gi, ":");
  const next = `#${hashPage()}${qs ? `?${qs}` : ""}`;
  if (location.hash !== next) history.replaceState(history.state, "", next);
}

/** The layers state: URL first, then localStorage; writes both on every change. */
export function useLayers(): [Layers, (next: Layers) => void] {
  const [layers, setLayers] = useState<Layers>(() => decodeLayers(hashParams().get("tl") ?? stored()));
  const code = useRef("");
  code.current = encodeLayers(layers);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `layers` is what the code is derived from
  useEffect(() => {
    store(code.current);
    writeTl(code.current);
  }, [layers]);

  // A link with `tl=` (or a page change that dropped it) is read again.
  useEffect(() => {
    const onHash = () => {
      const tl = hashParams().get("tl");
      if (tl === null) writeTl(code.current);
      else if (tl !== code.current) setLayers(decodeLayers(tl));
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const set = useCallback((next: Layers) => setLayers(next), []);
  return [layers, set];
}
