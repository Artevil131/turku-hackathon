import { fillTemplate, TOOL_METHODS, type ToolMethod } from "@aei/method";
import { apiOrigin } from "../notebook/kernel.ts";
import { type CellResult, pythonCall } from "./model.ts";

// What each result was computed with: the registry's method for it, the formula's letters with this result's
// numbers, and its code in Python (step by step) and R. The rail's result cells and the notebook read the same.

export type Lang = "python" | "r";

/** A value the result does not have (the share of a rate without a phenotype). */
const NONE = "\u0000none";

export function methodFor(r: CellResult): ToolMethod {
  if (r.kind === "beta") return TOOL_METHODS[r.discounted ? "tool-beta-discounted" : "tool-beta"];
  if (r.kind === "detector") return TOOL_METHODS[r.detector === "profile" ? "tool-detector-profile" : "tool-detector-phenotype"];
  return TOOL_METHODS[`tool-${r.kind}`];
}

const short = (v: number) => (Number.isFinite(v) ? Number(v.toPrecision(6)) : Number.NaN);
const q = (v: string) => JSON.stringify(v);

/** The formula's letters with this result's numbers: what the method block shows and the snippets are filled with. */
export function lettersOf(r: CellResult): { show: [string, number | string][]; fill: Record<string, number | string> } {
  switch (r.kind) {
    case "rate": {
      // Without a phenotype every isolate is counted, so there is no share: n is left out (None in Python, NA in R).
      const n = r.share?.n ?? null;
      const fill = { k: r.count, n: n ?? NONE, T: short(r.weeks), c: r.cultures };
      return {
        show: [
          ["k", r.count],
          ["n", n ?? "–"],
          ["T", short(r.weeks)],
          ["c", r.cultures],
          ["k/T", short(r.perWeek)],
        ],
        fill,
      };
    }
    case "compare": {
      const fill = { kA: r.a.k, nA: r.a.n, tA: short(r.a.weeks), kB: r.b.k, nB: r.b.n, tB: short(r.b.weeks) };
      return {
        show: [...Object.entries(fill), ["Δ", short(r.difference?.diff ?? Number.NaN)], ["RR", short(r.ratio?.ratio ?? Number.NaN)]],
        fill,
      };
    }
    case "shares": {
      const fill = {
        ks: r.points.map((p) => p.k).join(", "),
        ns: r.points.map((p) => p.n).join(", "),
        froms: r.points.map((p) => q(p.from)).join(", "),
        d: r.periodDays,
      };
      return {
        show: [
          ["i", `1…${r.points.length}`],
          ["d", r.periodDays],
          ["Σk", r.points.reduce((s, p) => s + p.k, 0)],
          ["Σn", r.points.reduce((s, p) => s + p.n, 0)],
        ],
        fill,
      };
    }
    case "beta": {
      if (!r.discounted) {
        const fill = { k: r.k, n: r.n };
        return {
          show: [
            ["k", r.k],
            ["n", r.n],
            ["a", r.posterior.a],
            ["b", r.posterior.b],
            ["E[p]", short(r.posterior.mean)],
          ],
          fill,
        };
      }
      const d = r.discounted;
      const fill = { a: short(d.posterior.a), b: short(d.posterior.b), delta: d.delta, m: d.m, pi: short(d.parentShare), W: d.weeks };
      return {
        show: [
          ["δ", d.delta],
          ["m", d.m],
          ["π", short(d.parentShare)],
          ["W", d.weeks],
          ["a", fill.a],
          ["b", fill.b],
          ["n_eff", short(d.posterior.effectiveN)],
        ],
        fill,
      };
    }
    case "detector": {
      const fill = { api: apiOrigin(), ward: r.slice.unit, organism: r.slice.organism, from: r.slice.from, to: r.slice.to };
      return {
        show: [
          ["episodes", r.rows.length],
          ["rows fetched", r.fetched],
        ],
        fill,
      };
    }
  }
}

/** The letters for one language: a missing value is None in Python and NA in R. */
const fillFor = (r: CellResult, lang: Lang) =>
  Object.fromEntries(Object.entries(lettersOf(r).fill).map(([k, v]) => [k, v === NONE ? (lang === "r" ? "NA" : "None") : v]));

/**
 * "Copy as Python": a script that computes this result step by step with the standard library (the registry's
 * snippet with this result's numbers), ending with the aei call that gives the same numbers. The detector's is the
 * live detector itself, run through aei, followed by the call with this run's settings.
 */
export function pythonScript(r: CellResult): string {
  const script = fillTemplate(methodFor(r).snippet, fillFor(r, "python"));
  return r.kind === "detector" ? `${script}\n\n# This run's call:\n# ${pythonCall(r)}` : script;
}

/** The code a cell shows and copies: the step-by-step Python, or the registry's R, filled with this result. */
export function codeFor(r: CellResult, lang: Lang): string {
  return lang === "python" ? pythonScript(r) : fillTemplate(methodFor(r).r, fillFor(r, "r"));
}

/** The method block's Python (the same script). */
export const methodPython = pythonScript;
