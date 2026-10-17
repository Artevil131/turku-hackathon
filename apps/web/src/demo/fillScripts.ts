import { defaultScript, demoOf, type Script } from "./fillScript.ts";
import type { FillPlan } from "./openDemo.ts";

// One screenplay per demo file: the fill-in shows how that professional actually works, in the order they would.
// Cell numbers are the notebook's rows in demos.ts; window names are the board's window ids. Each beat's comment
// says what the viewer should see or learn from it. Timing: `after` follows the previous beat's end, `with`
// overlaps it (seconds after it starts), `at` is a second of the fill (fillScript.ts).

/**
 * INFECTION CONTROL, Monday morning. Cells: 0 Monday note, 1 slice, 2 timeline (folded), 3 weekly share,
 * 4 detector, 5 to-do note. Reads what is open, checks when it began, writes it down, defines the slice, asks the
 * two questions, notes what to do, glances at where the patients came from. About 14 seconds.
 */
const control: Script = [
  // "What is open right now?" The Summary is the first and only thing on the board: one sentence, two numbers.
  { do: "reveal", window: "answer", at: 0.15, for: 0.5 },
  // "When did it begin?" The timeline draws itself under the sentence, left to right, as time runs.
  { do: "reveal", window: "timeline", how: "wipe", for: 0.9, after: 0.1 },
  // The notebook opens while the timeline is still drawing: the page where the week is written down.
  { do: "reveal", window: "notebook", with: 0.45 },
  // The Monday note in the person's own words: what is open, how many against usual, where the patients came from.
  { do: "write", cell: 0, after: 0.25 },
  // The slice, one field at a time: hospital, unit, ESBL, the dates. Decided before any number is asked for.
  { do: "place", cell: 1, after: 0.45 },
  // The timeline pinned into the page under the slice, folded to one line: it reads the slice's hospital.
  { do: "show", cell: 2, after: 0.05 },
  // The weekly share: Run pressed, a beat of thinking, the numbers count up. Run comes after the slice, never before.
  { do: "run", cell: 3, after: 0.3 },
  // The detector, the same gesture: is the count more than this unit usually has?
  { do: "run", cell: 4, after: 0.35 },
  // The to-do note: what to ask the ward, when to re-read the rate, which unit to look at next.
  { do: "write", cell: 5, after: 0.45 },
  // A glance to the side while the note is still being typed: the signal list, then where the patients came from.
  { do: "reveal", window: "signals", with: 0.9 },
  { do: "reveal", window: "graph", with: 0.6 },
  // The colleague leaves; the lock lifts when the last word is typed.
  { do: "done", after: 0.4 },
];

/**
 * RESEARCHER, a frozen analysis. Cells: 0 question, 1 slice, 2 timeline (folded), 3 rate, 4 compare, 5 Beta,
 * 6 detector, 7 Python, 8 chart, 9 reading. Starts from the question, cuts the slice, runs the four analyses in
 * the order they build on each other, reads the code, draws the chart, writes the reading. About 20 seconds.
 */
const researcher: Script = [
  // The notebook first and alone: a researcher starts from the question, not from the board.
  { do: "reveal", window: "notebook", at: 0.15 },
  // The question, typed: what rose, where, when, against what noise. Then the promise: the slice below is frozen.
  { do: "write", cell: 0, after: 0.2, cps: 85 },
  // The slice, field by field: hospital, Internal medicine A, ESBL, 1 March to 30 April, first isolates.
  { do: "place", cell: 1, after: 0.45 },
  // The Summary and the timeline arrive beside the slice: the context the slice is cut from, not the starting point.
  { do: "reveal", window: "answer", with: 0.1 },
  { do: "reveal", window: "timeline", how: "wipe", for: 0.9, with: 0.25 },
  // The timeline pinned into the page, folded.
  { do: "show", cell: 2, with: 0.55 },
  // The rate first: how many, per week, per hundred cultures.
  { do: "run", cell: 3, after: 0.25 },
  // Then against the 61 days before: the same unit, the same length of time.
  { do: "run", cell: 4, after: 0.3 },
  // A Beta estimate of the share, with its credible interval.
  { do: "run", cell: 5, after: 0.3 },
  // The detector last: the count against what this unit usually has.
  { do: "run", cell: 6, after: 0.3 },
  // The Python that reproduces the last result, read for a moment.
  { do: "show", cell: 7, after: 0.35 },
  // The chart draws its line: the share, fortnight by fortnight, over the winter.
  { do: "draw", cell: 8, after: 0.6, for: 1.1 },
  // The reading, typed while the line is still drawing: what the numbers say, and what to check next.
  { do: "write", cell: 9, with: 0.7, cps: 95 },
  // The signal list on the right: the live side of the frozen page.
  { do: "reveal", window: "signals", with: 2.5 },
  { do: "done", after: 0.4 },
];

/**
 * DOCTOR, one patient. Windows: coverage (the answer card, the case, the list); the timeline is not opened for a doctor. Sets the case
 * (ward, sample, severity), the answer resolves, opens details on the first row. About 7 seconds.
 */
const clinician: Script = [
  // The coverage window is the doctor's whole screen. Its answer and list stay veiled until the case is set.
  { do: "veil", window: "coverage", target: "answer", on: true, at: 0 },
  { do: "reveal", window: "coverage", at: 0.15 },
  // "Change the case" opens the record strip.
  { do: "pick", window: "coverage", target: ".dr-answer-change", after: 0.4 },
  // Ward, sample, severity: three small decisions, each pressed in turn.
  { do: "pick", window: "coverage", target: ".rs-unit .rs-select", value: "MED-A", after: 0.5 },
  { do: "pick", window: "coverage", target: ".rs-choice[data-value='urine']", after: 0.45 },
  { do: "pick", window: "coverage", target: ".rs-choice[data-value='mild']", after: 0.45 },
  // The case closes and the answer resolves: which antibiotic to start, and how much of the unit it covers.
  { do: "pick", window: "coverage", target: ".dr-answer-change", after: 0.5 },
  { do: "veil", window: "coverage", target: "answer", on: false, after: 0.15 },
  // Details on the first row: why this one.
  { do: "pick", window: "coverage", target: ".cl-row", after: 1.2 },
  { do: "done", after: 0.6 },
];

const SCRIPTS = { control, researcher, clinician } as const;

/** The screenplay for a plan: the demo's own, or the plain one. */
export function scriptFor(plan: FillPlan): Script {
  const id = demoOf(plan);
  return id ? SCRIPTS[id] : defaultScript(plan);
}
