import type { Locale } from "@aei/i18n";
import type { DemoId } from "../demos.ts";
import { copy } from "../fillCopy.ts";
import { added, inWin, last, PACE, pill, type Screenplay, win } from "./script.ts";

// One screenplay per demo file. The drawn cursor works the real screen in the order that professional would, so a
// viewer learns the order of work by watching. Every beat carries a line saying what the viewer sees or learns.
// `mark: true` on a click remembers the notebook's cells, so `added()` is the cell that click created.

/**
 * INFECTION CONTROL, Monday morning. Reads what is open, opens its evidence, picks the signal on the timeline,
 * writes the Monday note, asks the two questions (weekly share, detector) of that signal's weeks, notes what to do.
 */
function control(locale: Locale): Screenplay {
  return {
    pace: PACE,
    beats: [
      // Reads the Summary first: what is open right now, in one sentence.
      { do: "look", at: inWin("answer", ".answer-sentence"), ms: 1100 },
      // "Show the evidence": the arithmetic behind the sentence opens beside it.
      { do: "click", at: inWin("answer", ".answer-primary"), wait: win("math") },
      { do: "think", ms: 500 },
      // The signal's pill on the timeline: when it began; the board follows the selection.
      { do: "click", at: pill("timeline"), wait: ".hs-pill.is-selected" },
      { do: "think", ms: 600 },
      // The pill's menu closes again: the selection is what was wanted.
      { do: "escape" },
      // The Monday note, in the person's own words.
      { do: "click", at: "[data-write-note]", wait: ".nb-note-edit", must: true },
      { do: "type", at: last(".nb-note-edit"), text: copy(locale, "controlMonday") },
      { do: "think", ms: 400 },
      // The weekly share from the + menu: its slice is cut from the selected signal, so Run comes after the slice.
      { do: "click", at: "[data-add-more]", wait: ".nb-menu", mark: true, must: true },
      { do: "click", at: '.nb-menu [data-add="shares"]', wait: added(".nb-run") },
      { do: "think", ms: 350 },
      { do: "click", at: added(".nb-run"), wait: added(".tl-cell"), timeout: 10000 },
      // The numbers are read; then the method behind them is opened: the formula and the code that reproduce it.
      { do: "think", ms: 600 },
      { do: "click", at: added(".tl-cell-method > summary"), wait: added(".nb-more > summary") },
      { do: "think", ms: 500 },
      { do: "click", at: added(".nb-more > summary"), wait: added(".nb-pre") },
      // The view follows to the code: the hand reads along it.
      { do: "look", at: added(".nb-pre"), ms: 2200 },
      // The detector the same way: is the count more than this unit usually has?
      { do: "click", at: "[data-add-more]", wait: ".nb-menu", mark: true },
      { do: "click", at: '.nb-menu [data-add="detector"]', wait: added(".nb-run") },
      { do: "think", ms: 350 },
      { do: "click", at: added(".nb-run"), wait: added(".tl-cell"), timeout: 10000 },
      { do: "think", ms: 600 },
      // The to-do note closes the morning: what to ask the ward, when to re-read.
      { do: "click", at: "[data-write-note]", wait: last(".nb-note-edit") },
      { do: "type", at: last(".nb-note-edit"), text: copy(locale, "controlTodo") },
      { do: "think", ms: 500 },
    ],
  };
}

/**
 * RESEARCHER, a frozen analysis. Types the question, adds a slice, cuts the time frame on the timeline and takes it
 * into the slice, sets the unit, runs the Beta estimate so real numbers appear, opens its method (the formula, the
 * Python), draws its chart. About 20 seconds.
 */
function researcher(locale: Locale): Screenplay {
  return {
    pace: PACE,
    beats: [
      // The question first, typed into a fresh note: a researcher starts from the question, not from the board.
      { do: "click", at: "[data-write-note]", wait: ".nb-note-edit", must: true },
      { do: "type", at: last(".nb-note-edit"), text: copy(locale, "researcherQuestion") },
      { do: "think", ms: 300 },
      // A slice: the frame every analysis below will read.
      { do: "click", at: "[data-add-more]", wait: ".nb-menu", mark: true, must: true },
      { do: "click", at: '.nb-menu [data-add="slice"]', wait: added(".nb-sentence") },
      { do: "think", ms: 300 },
      // Cuts the time frame on the timeline: the last eight weeks before the frozen clock.
      { do: "drag", at: inWin("timeline", ".hs-svg"), weeks: 8, ms: 900 },
      { do: "wait", for: inWin("timeline", ".hs-range") },
      { do: "think", ms: 300 },
      // "Use timeline range": the slice takes those weeks.
      { do: "click", at: added(".nb-actions button:nth-child(2)") },
      { do: "think", ms: 300 },
      // Edit the slice: the unit is Internal medicine A. Done closes the fields.
      { do: "click", at: added(".nb-actions button:first-child"), wait: added(".nb-fields") },
      { do: "pick", at: added("select[id$='-unit']"), value: "MED-A" },
      { do: "click", at: added(".nb-actions button:first-child") },
      { do: "think", ms: 300 },
      // The Beta estimate of the ESBL share from the + menu, then Run: the real numbers arrive, the figure draws.
      { do: "click", at: "[data-add-more]", wait: ".nb-menu", mark: true },
      { do: "click", at: '.nb-menu [data-add="beta"]', wait: added(".nb-run") },
      { do: "think", ms: 250 },
      { do: "click", at: added(".nb-run"), wait: added(".tl-cell"), timeout: 10000 },
      { do: "think", ms: 700 },
      // The method opened: the formula sits typeset, the Python that reproduces the number unrolls under it.
      { do: "click", at: added(".tl-cell-method > summary"), wait: added(".nb-more > summary") },
      { do: "think", ms: 500 },
      { do: "click", at: added(".nb-more > summary"), wait: added(".nb-pre") },
      // The view follows to the code: the hand reads along it.
      { do: "look", at: added(".nb-pre"), ms: 2200 },
      // A chart of the share, fortnight by fortnight, from the result's own button: it draws itself in.
      { do: "click", at: added("[data-add-chart]"), wait: '.nb-cell[data-kind="chart"] svg', timeout: 8000 },
      { do: "look", at: last('.nb-cell[data-kind="chart"] svg'), ms: 1600 },
    ],
  };
}

/**
 * DOCTOR, one patient. Opens the case, picks the ward, the sample and the severity; the answer card updates; opens
 * details on the first row; then the timeline below: the unit's lane and a signal pill.
 */
function clinician(): Screenplay {
  return {
    pace: PACE,
    beats: [
      // The answer card as it stands: the default case.
      { do: "look", at: inWin("coverage", ".dr-answer-head"), ms: 1100 },
      // "Change ward, sample or severity" opens the record strip.
      { do: "click", at: ".dr-answer-change", wait: ".rs", must: true },
      { do: "think", ms: 400 },
      // The ward: Internal medicine A.
      { do: "pick", at: ".rs-unit .rs-select", value: "MED-A" },
      { do: "think", ms: 350 },
      // The sample: a blood culture.
      { do: "click", at: '.rs-choice[data-value="blood"]' },
      { do: "think", ms: 350 },
      // The severity: severe. The answer card recomputes for this case.
      { do: "click", at: '.rs-choice[data-value="severe"]', wait: ".dr-answer:not([aria-busy])" },
      { do: "think", ms: 1000 },
      // The first row's details: why this antibiotic comes first.
      { do: "click", at: ".cl-row", wait: "#dr-details" },
      { do: "think", ms: 1000 },
      // The timeline below: the unit's own lane, then a signal pill.
      { do: "click", at: inWin("timeline", ".hs-lane-hit") },
      { do: "think", ms: 500 },
      { do: "click", at: pill("timeline"), wait: ".hs-pill.is-selected" },
      { do: "think", ms: 700 },
      // The pill's menu closes again.
      { do: "escape" },
    ],
  };
}

/** The pauses between decisions are a third of what they were written at: the show moves, the app still gets time to paint. */
const BREATH = 0.35;

export function screenplayFor(id: DemoId, locale: Locale): Screenplay {
  const play = id === "clinician" ? clinician() : id === "control" ? control(locale) : researcher(locale);
  return {
    ...play,
    beats: play.beats.map((b) =>
      b.do === "think" ? { ...b, ms: Math.max(60, b.ms * BREATH) } : b.do === "look" ? { ...b, ms: (b.ms ?? 1000) * 0.5 } : b,
    ),
  };
}
