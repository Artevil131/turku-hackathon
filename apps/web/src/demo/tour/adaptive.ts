import type { TourStep } from "./steps.ts";
import { GUIDE, type GuideKind, kindOfWindow } from "./windowGuide.ts";

// The tour for any screen: it reads which windows are open and says what each one is, so a template, a blank
// project or a layout of your own gets a guide that matches what is on screen (the demo files keep their own).

/** An open window: its id on the board, its kind and where it sits (px from the top left of the screen). */
export interface OpenWindow {
  id: string;
  kind: GuideKind;
  x: number;
  y: number;
}

/** Dispatched on window to play the adaptive tour now (the sidebar's Guide button); the app owns the tour state. */
export const GUIDE_EVENT = "aei:guide";

/** About one minute at the tour's pace: an intro, an outro and at most six steps between. */
export const MAX_STEPS = 8;
/** Windows whose tops are within this many px count as one row, so side by side reads left to right. */
const ROW_BAND = 24;

const winSel = (id: string) => `.ws-win[data-win="${id}"]`;

/** The windows open on the board now, in reading order: top row first, left to right. */
export function openWindows(root: ParentNode = document): OpenWindow[] {
  const found: OpenWindow[] = [];
  for (const el of root.querySelectorAll<HTMLElement>(".ws-win[data-win]")) {
    const id = el.dataset.win ?? "";
    const kind = kindOfWindow(id);
    if (!kind) continue;
    const r = el.getBoundingClientRect();
    found.push({ id, kind, x: r.left, y: r.top });
  }
  return readingOrder(found);
}

export function readingOrder(windows: readonly OpenWindow[]): OpenWindow[] {
  return [...windows].sort((a, b) => Math.round(a.y / ROW_BAND) - Math.round(b.y / ROW_BAND) || a.x - b.x);
}

/**
 * Intro, one step per kind of open window (copies of a kind count once), the outro. A window's first thing to try
 * gets a step of its own while the budget lasts. No windows: a pointer at the add button instead.
 */
export function adaptiveSteps(open: readonly OpenWindow[] = openWindows()): TourStep[] {
  const outro: TourStep = { say: "tourGdOutro", at: "[data-add-window]" };
  const firsts = new Map<GuideKind, OpenWindow>();
  for (const w of readingOrder(open)) if (!firsts.has(w.kind)) firsts.set(w.kind, w);
  if (firsts.size === 0) return [{ say: "tourGdEmpty", at: "[data-add-window]", act: "click", waitFor: ".ws-picker" }, outro];
  const shown = [...firsts.values()].slice(0, MAX_STEPS - 2);
  let spare = MAX_STEPS - 2 - shown.length;
  const body = shown.flatMap((w): TourStep[] => {
    const guide = GUIDE[w.kind];
    const step: TourStep = { say: guide.what, at: winSel(w.id) };
    const first = guide.tries[0];
    if (!first || spare <= 0) return [step];
    spare--;
    return [step, { say: first.say, at: `${winSel(w.id)} ${first.at}` }];
  });
  return [{ say: "tourGdIntro" }, ...body, outro];
}
