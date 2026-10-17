import type { NbCell } from "../components/research/notebook/model.ts";
import type { DemoId } from "./demos.ts";
import type { FillPlan } from "./openDemo.ts";

// The fill-in is a screenplay: a list of timed beats the player (FillOverlay.tsx) performs against the plan and the
// DOM. Times are seconds. A beat starts `at` a second of the fill, `after` the previous beat ends (the default, 0),
// or `with` the previous beat: that many seconds after it starts, so beats overlap. Durations and easing are the
// beat's own; the player only reads them.

export type Beat =
  /** A window appears: it rises in, or (`wipe`) is drawn left to right like a timeline. */
  | { do: "reveal"; window: string; how?: "rise" | "wipe"; for?: number }
  /** A note cell is typed in, character by character, with a breath at the end of each sentence. */
  | { do: "write"; cell: number; cps?: number }
  /** A slice cell's sentence fills in one field at a time (hospital, unit, phenotype, dates…), `each` seconds apart. */
  | { do: "place"; cell: number; each?: number }
  /** A cell appears as it is (a code cell, a collapsed timeline). */
  | { do: "show"; cell: number }
  /** An analysis cell: Run is pressed, the tool thinks for `think` seconds, then its numbers count up over `for`. */
  | { do: "run"; cell: number; think?: number; for?: number }
  /** A chart cell opens and draws its line over `for` seconds. */
  | { do: "draw"; cell: number; for?: number }
  /** A control inside a window is pressed (a button, a row) or set (a select, with `value`). */
  | { do: "pick"; window: string; target: string; value?: string }
  /** Elements inside a window are veiled (`on`) or revealed again: a result that waits for its inputs. */
  | { do: "veil"; window: string; target: string; on: boolean }
  /** The colleague leaves: the lock lifts once every running beat has ended. */
  | { do: "done" };

export type Step = Beat & {
  at?: number;
  after?: number;
  with?: number;
  /** A CSS easing for this beat's motion; the app's --mo-ease otherwise. */
  ease?: string;
};
export type Script = readonly Step[];

/** Default lengths, in seconds, when a beat names none. */
export const PACE = {
  rise: 0.5,
  wipe: 0.9,
  /** Characters per second: brisk, but each sentence still arrives as one. */
  cps: 80,
  field: 0.24,
  show: 0.3,
  press: 0.22,
  think: 0.5,
  numbers: 0.5,
  draw: 1.0,
  /** A chart fetches its data before it can draw. */
  load: 0.4,
  pick: 0.28,
} as const;

/**
 * When each of the first k characters of `text` is on screen, typed at about `cps`: every stroke a little
 * different (never a pause mid-word), a breath after a sentence, a shorter one after a comma or a line end.
 */
export function typingTimes(text: string, cps: number): number[] {
  const times = [0];
  let t = 0;
  let seed = 11;
  const noise = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i] ?? "";
    const next = text[i + 1] ?? "";
    t += (0.8 + 0.4 * noise()) / cps;
    if (ch === "\n") t += next === "\n" ? 0.1 : 0.22;
    else if (/[.!?:]/.test(ch) && (next === "" || /\s/.test(next))) t += 0.34;
    else if ((ch === "," || ch === ";") && /\s/.test(next)) t += 0.12;
    times.push(t);
  }
  return times;
}

/** The note as read, without its Markdown marks. */
const plainNote = (text: string) => text.replace(/^#{1,6}\s+|^\s*[-*]\s+/gm, "").replace(/\n{2,}/g, "\n");

/** How many parts the slice cell's sentence has (hospital, unit, organism, specimen, phenotype, dates, first isolates). */
const sliceParts = (c: NbCell | undefined) =>
  c?.kind === "slice" ? 3 + [c.slice.site, c.slice.organism, c.slice.specimen, c.slice.phenotype].filter(Boolean).length : 4;

/** How long a beat takes, so the next can follow it. */
export function estimate(step: Step, plan: FillPlan): number {
  switch (step.do) {
    case "reveal":
      return step.for ?? (step.how === "wipe" ? PACE.wipe : PACE.rise);
    case "write": {
      const c = plan.cells[step.cell];
      return typingTimes(c?.kind === "note" ? plainNote(c.text) : "", step.cps ?? PACE.cps).at(-1) ?? 0;
    }
    case "place":
      return sliceParts(plan.cells[step.cell]) * (step.each ?? PACE.field);
    case "show":
      return PACE.show;
    case "run":
      return PACE.press + (step.think ?? PACE.think) + (step.for ?? PACE.numbers);
    case "draw":
      return PACE.load + (step.for ?? PACE.draw);
    case "pick":
      return PACE.pick;
    case "veil":
    case "done":
      return 0;
  }
}

export interface Timed {
  step: Step;
  start: number;
  end: number;
}

/** The script on a clock: when each beat starts and ends, and the whole fill's length. */
export function resolve(script: Script, plan: FillPlan): { steps: Timed[]; total: number } {
  const steps: Timed[] = [];
  let prev: Timed | null = null;
  for (const step of script) {
    const start: number = Math.max(
      0,
      step.at ?? (prev === null ? 0 : step.with !== undefined ? prev.start + step.with : prev.end + (step.after ?? 0)),
    );
    const timed: Timed = { step, start, end: start + estimate(step, plan) };
    steps.push(timed);
    prev = timed;
  }
  return { steps, total: Math.max(0, ...steps.map((s) => s.end)) };
}

/** A plain screenplay for a demo without its own: the windows in reading order, then the notebook top to bottom. */
export function defaultScript(plan: FillPlan): Script {
  const script: Step[] = [];
  plan.windows.forEach((id, i) => {
    if (id === "timeline") script.push({ do: "reveal", window: id, how: "wipe", after: 0.1 });
    else if (i === 0) script.push({ do: "reveal", window: id, at: 0.2 });
    else script.push({ do: "reveal", window: id, after: 0.1 });
  });
  plan.cells.forEach((c, i) => {
    if (c.kind === "note") script.push({ do: "write", cell: i, after: 0.3 });
    else if (c.kind === "slice") script.push({ do: "place", cell: i, after: 0.3 });
    else if (c.kind === "analysis") script.push({ do: "run", cell: i, after: 0.3 });
    else if (c.kind === "chart") script.push({ do: "draw", cell: i, after: 0.3 });
    else script.push({ do: "show", cell: i, after: 0.2 });
  });
  script.push({ do: "done", after: 0.4 });
  return script;
}

/** Which demo a plan belongs to, read off its shape (the plan carries no id). */
export function demoOf(plan: FillPlan): DemoId | null {
  if (plan.windows.includes("coverage") && plan.cells.length === 0) return "clinician";
  if (plan.cells.some((c) => c.kind === "chart")) return "researcher";
  if (plan.cells.some((c) => c.kind === "analysis" && c.tool === "shares")) return "control";
  return null;
}
