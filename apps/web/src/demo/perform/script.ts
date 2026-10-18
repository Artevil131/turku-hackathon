// A performance is a screenplay: the drawn cursor operates the real screen, one beat after another, the way the
// professional would. Targets are the app's own DOM (a selector, or a function for "the cell just added").
// Timing lives here too: the pace of the cursor and the typing, and the `think` beats between decisions.

export type Target = string | (() => Element | null);

export type Beat =
  /** The cursor goes to it and rests there, as if reading it; `timeout` bounds the wait for something that may not be there. */
  | { do: "look"; at: Target; ms?: number; timeout?: number; orbit?: number }
  /** The cursor goes to it, scans it (`turns` loops around its box, the ring on it meanwhile) and leaves it alone. */
  | { do: "orbit"; at: Target; turns?: number; ms?: number; timeout?: number }
  /** The cursor goes to it and clicks it; `wait` is what should appear afterwards (a menu, a result). `orbit`: loops around it first. */
  | { do: "click"; at: Target; wait?: Target; timeout?: number; mark?: boolean; must?: boolean; orbit?: number }
  /** The cursor goes to a text field and types `text`, at `cps` characters a second, then leaves the field (`stay`: keeps it focused, for a list that closes on blur). */
  | { do: "type"; at: Target; text: string; cps?: number; must?: boolean; stay?: boolean; orbit?: number }
  /**
   * The cursor drags across a weekly band: the last `weeks` up to the clock, or from one fraction of the plot to
   * another (0 = the first week, 1 = the clock).
   */
  | { do: "drag"; at: Target; dates?: [string, string]; weeks?: number; from?: number; to?: number; ms?: number }
  /** The cursor goes to a formula, reads along it as its symbols appear one by one, then visits the values of its letters. */
  | { do: "typeset"; at: Target; timeout?: number }
  /** The cursor goes to a select or input and sets it to `value`, as a choice made. */
  | { do: "pick"; at: Target; value: string; must?: boolean; orbit?: number }
  /** Waits for something to appear (the real tool answering); on timeout the show goes on, unless `must`. */
  | { do: "wait"; for: Target; timeout?: number; must?: boolean }
  /** A human beat: a pause before a decision or after a result. */
  | { do: "think"; ms: number }
  /** The hand presses Escape: the menu or popover it opened closes. */
  | { do: "escape" }
  /** A chapter mark, free: announced with its time (the `aei:perform` event, the dev console) so a narration can be written against it. */
  | { do: "scene"; name: string };

export interface Pace {
  /** The hand's shortest and longest travel, ms; a move takes `min + 90 · log2(distance / 16 + 1)`, capped (hand.ts). */
  min: number;
  max: number;
  /** The hand rests this long on a target before pressing, ms. */
  dwell: number;
  /** Pressed before a click releases, ms. */
  press: number;
  /** Characters per second when typing: readable as it appears. */
  cps: number;
  /** How long a target may take to appear before the step is skipped, ms. */
  timeout: number;
}

export interface Screenplay {
  pace: Pace;
  beats: Beat[];
}

export const PACE: Pace = {
  min: 130,
  max: 420,
  dwell: 50,
  press: 80,
  cps: 95,
  timeout: 2500,
};

// ---------- targets ----------

export const first = (sel: string): Target => sel;
export const last =
  (sel: string): Target =>
  () => {
    const all = document.querySelectorAll(sel);
    return all[all.length - 1] ?? null;
  };
export const win = (id: string) => `.ws-win[data-win="${id}"]`;
export const inWin = (id: string, sel: string) => `${win(id)} ${sel}`;

/**
 * A notebook cell added since the last `mark`ed click: the first new one, or the first new one holding `inner`
 * (an analysis added under a fresh slice is two new cells). The player snapshots the cells before every click
 * with `mark: true`, so "the cell the + menu just created" has a name.
 */
export const added =
  (inner = ""): Target =>
  () => {
    const fresh = [...document.querySelectorAll<HTMLElement>(".nb-cell")].filter((c) => !marked.has(c.dataset.cell ?? ""));
    if (!inner) return fresh[0] ?? null;
    for (const c of fresh) {
      const el = c.querySelector(inner);
      if (el) return el;
    }
    return null;
  };
let marked = new Set<string>();
export const mark = () => {
  marked = new Set([...document.querySelectorAll<HTMLElement>(".nb-cell")].map((c) => c.dataset.cell ?? ""));
};

/** A signal pill on a band: the selected signal's, else the latest ordinary one (not the clock's sentinel, not a data note). */
export const pill =
  (id: string): Target =>
  () => {
    const selected = document.querySelector(`${win(id)} .hs-pill.is-selected`);
    if (selected) return selected;
    const plain = document.querySelectorAll(`${win(id)} .hs-pill:not([data-kind="sentinel"]):not([data-kind="data"])`);
    return plain[plain.length - 1] ?? document.querySelector(`${win(id)} .hs-pill`);
  };
