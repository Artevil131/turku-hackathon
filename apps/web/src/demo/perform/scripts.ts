import type { Locale } from "@aei/i18n";
import type { DemoId } from "../demos.ts";
import { copy } from "../fillCopy.ts";
import { added, type Beat, clusterPill, inWin, last, PACE, type Pace, pill, type Screenplay, win } from "./script.ts";

// One screenplay per demo file. The drawn cursor works the real screen in the order that professional would, so a
// viewer learns the order of work by watching. Every beat carries a line saying what the viewer sees or learns.
// `mark: true` on a click remembers the notebook's cells, so `added()` is the cell that click created.

/**
 * The tool rail: the hand opens Statistics, picks an analysis, runs it on the selected signal's data, reads the
 * result in the inspector beside the rail and closes it again. The same tools the notebook's + menu adds as cells.
 */
const toolBeats = (id: "rate" | "compare" | "shares" | "beta" | "detector"): Beat[] => [
  { do: "click", at: '.ws-rail-btn[data-tool="stats"]', wait: ".ws-rail-menu" },
  { do: "think", ms: 300 },
  { do: "click", at: `.ws-rail-menu [data-tool="${id}"]`, wait: ".ws-inspector:not([hidden]) .tl-run" },
  { do: "think", ms: 300 },
  { do: "click", at: ".ws-inspector:not([hidden]) .tl-run", wait: ".ws-inspector:not([hidden]) .tl-cell", timeout: 10000 },
  { do: "think", ms: 1200 },
  { do: "escape" },
];

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
      { do: "typeset", at: inWin("math", "math") },
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
      // The numbers are read; then the method under them (shown with every notebook result): the formula, then the code.
      { do: "think", ms: 600 },
      { do: "typeset", at: added(".nb-formula") },
      { do: "think", ms: 300 },
      { do: "click", at: added(".nb-more > summary"), wait: added(".nb-pre") },
      // The view follows to the code: the hand reads along it.
      { do: "look", at: added(".nb-pre"), ms: 2200 },
      // The detector the same way: is the count more than this unit usually has?
      { do: "click", at: "[data-add-more]", wait: ".nb-menu", mark: true },
      { do: "click", at: '.nb-menu [data-add="detector"]', wait: added(".nb-run") },
      { do: "think", ms: 350 },
      { do: "click", at: added(".nb-run"), wait: added(".tl-cell"), timeout: 10000 },
      { do: "think", ms: 600 },
      // A tool from the rail, on the signal's own data: the usual rate, read in the inspector.
      ...toolBeats("rate"),
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
  // The frozen analysis's frame (demos.ts): 1 March to 30 April 2025.
  const [from, to] = ["2025-03-01", "2025-04-30"];
  return {
    pace: PACE,
    beats: [
      // The question first, typed into a fresh note: a researcher starts from the question, not from the board.
      { do: "click", at: "[data-write-note]", wait: ".nb-note-edit", must: true },
      { do: "type", at: last(".nb-note-edit"), text: copy(locale, "researcherQuestion") },
      { do: "think", ms: 300 },
      // The signal the question is about, before any cutting: the first row of the Signals window opens its card in the
      // pane (seen, expected, by chance), "how we calculate it" stands open with the formula, then back to the list.
      {
        do: "click",
        at: inWin("signals", ".feed-row .feed-row-main"),
        wait: inWin("signals", ".feed-pane-card .sig-tiles"),
        timeout: 8000,
      },
      { do: "think", ms: 500 },
      { do: "look", at: inWin("signals", ".feed-pane-card .sig-tiles"), ms: 2500, timeout: 1500 },
      { do: "look", at: inWin("signals", ".feed-pane-card .sig-how[open] .sig-formula"), ms: 2500, timeout: 1500 },
      { do: "look", at: inWin("signals", ".feed-pane-card .math-poisson"), ms: 2000, timeout: 1500 },
      { do: "click", at: inWin("signals", ".feed-pane-card .sig-back"), wait: inWin("signals", ".feed-list"), timeout: 4000 },
      { do: "think", ms: 400 },
      // A slice: the frame every analysis below will read.
      { do: "click", at: "[data-add-more]", wait: ".nb-menu", mark: true, must: true },
      { do: "click", at: '.nb-menu [data-add="slice"]', wait: added(".nb-sentence") },
      { do: "think", ms: 300 },
      // Cuts the time frame on the timeline: the last eight weeks before the frozen clock.
      { do: "drag", at: inWin("timeline", ".hs-svg"), dates: [from, to], weeks: 8, ms: 1800 },
      { do: "wait", for: inWin("timeline", ".hs-range") },
      { do: "think", ms: 300 },
      // "Use timeline range": the slice takes those weeks.
      { do: "click", at: added(".nb-actions button:nth-child(2)") },
      { do: "think", ms: 300 },
      // Edit the slice: the unit is Internal medicine A. Done closes the fields.
      { do: "click", at: added(".nb-actions button:first-child"), wait: added(".nb-fields") },
      { do: "pick", at: added("select[id$='-unit']"), value: "MED-A" },
      // The slice must hold the frozen analysis's own frame whatever weeks the live timeline shows: the dates are set in the fields.
      { do: "pick", at: added("input[id$='-from']"), value: from },
      { do: "pick", at: added("input[id$='-to']"), value: to },
      { do: "click", at: added(".nb-actions button:first-child") },
      { do: "think", ms: 300 },
      // The slice's frame drawn as a timeline of its own: the same weekly band as the board's, from the slice's first to its last day.
      { do: "click", at: "[data-add-more]", wait: ".nb-menu", mark: true },
      { do: "click", at: '.nb-menu [data-add="timeline"]', wait: added(".nb-timeline svg"), timeout: 8000 },
      { do: "look", at: added(".nb-timeline"), ms: 2200 },
      // The Beta estimate of the ESBL share from the + menu, then Run: the real numbers arrive, the figure draws.
      { do: "click", at: "[data-add-more]", wait: ".nb-menu", mark: true },
      { do: "click", at: '.nb-menu [data-add="beta"]', wait: added(".nb-run") },
      { do: "think", ms: 250 },
      { do: "click", at: added(".nb-run"), wait: added(".tl-cell"), timeout: 10000 },
      { do: "think", ms: 700 },
      // The method under the result: the formula sits typeset, the Python that reproduces the number unrolls under it.
      { do: "typeset", at: added(".nb-formula") },
      { do: "think", ms: 300 },
      { do: "click", at: added(".nb-more > summary"), wait: added(".nb-pre") },
      // The view follows to the code: the hand reads along it.
      { do: "look", at: added(".nb-pre"), ms: 2200 },
      // A chart of the share, fortnight by fortnight, from the result's own button: it draws itself in.
      { do: "click", at: added("[data-add-chart]"), wait: '.nb-cell[data-kind="chart"] svg', timeout: 8000 },
      { do: "look", at: last('.nb-cell[data-kind="chart"] svg'), ms: 1600 },
      // Then the rail: the same Beta estimate is one of its tools, run on the slice without a cell.
      ...toolBeats("beta"),
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
      // The answer card as it stands: the default case (Internal medicine A, urine, mild).
      { do: "look", at: inWin("coverage", ".dr-answer-head"), ms: 1400 },
      // On a narrow screen the case is behind "Change ward, sample or severity"; on a wide one it is already beside the answer.
      { do: "click", at: ".dr-answer-change", wait: ".rs", timeout: 300 },
      { do: "think", ms: 400 },
      // A different ward: the intensive care unit has other bacteria, so the answer will move.
      { do: "pick", at: ".rs-unit .rs-select", value: "ICU" },
      { do: "wait", for: ".dr-answer:not([aria-busy])", timeout: 4000 },
      { do: "look", at: inWin("coverage", ".dr-answer-head"), ms: 1000 },
      // The sample: a blood culture.
      { do: "click", at: '.rs-choice[data-value="blood"]' },
      { do: "wait", for: ".dr-answer:not([aria-busy])", timeout: 4000 },
      { do: "think", ms: 500 },
      // The severity: severe. The answer card recomputes for this case.
      { do: "click", at: '.rs-choice[data-value="severe"]', wait: ".dr-answer:not([aria-busy])", timeout: 4000 },
      { do: "look", at: inWin("coverage", ".dr-answer-head"), ms: 1800 },
      // The first alternative's details: why this antibiotic is good enough.
      { do: "click", at: ".cl-row", wait: "#dr-details", timeout: 2000 },
      { do: "think", ms: 1200 },
    ],
  };
}

/**
 * THE SHOWCASE, about two minutes, for a voice-over: one continuous journey of the hand across the product in the order the
 * pitch tells it (pitch/SUBMISSION.md). It starts on the start page, travels to a demo card and clicks it; that demo file
 * opens empty and its own fill performance plays, by the same hand (the clinician's and the researcher's, `SHOWCASE_FILLS`;
 * the infection-control file opens filled); between them the hand travels through the sidebar, the search, the layouts and
 * the data page, scanning each thing it comes to (an `orbit`, the ring on it) before acting. The clock is paused at
 * 12 May 2025 by the demo files, so every number on screen is the app's own. A `scene` beat marks each chapter; its time
 * is logged. `must` only where the journey cannot go on without it; anything else missing is skipped and the show goes on.
 */
export const SHOWCASE_SCENES = [
  "problem",
  "doctor",
  "search",
  "timeline",
  "anomaly",
  "map",
  "quality",
  "research",
  "export",
  "end",
] as const;
export type ShowcaseScene = (typeof SHOWCASE_SCENES)[number];
/** The demo files the showcase opens empty, to play their own fill-in on the way through. */
export const SHOWCASE_FILLS: readonly DemoId[] = ["clinician", "researcher"];

/** Calmer than the demos between the fills: a slower hand, patient waits for the server. */
const SHOWCASE_PACE: Pace = { ...PACE, min: 200, max: 600, dwell: 120, press: 100, cps: 60, timeout: 6000 };

function showcase(locale: Locale): Screenplay {
  const scene = (name: ShowcaseScene): Beat => ({ do: "scene", name });
  const answered = `${win("coverage")} .dr-answer:not([aria-busy])`;
  /** The signal card a pill opens (in the Signals window's layer, or the Signal window). */
  const card = ".sig";
  const short = 1500;
  /**
   * A demo file's fill-in exactly as its replay button plays it (`screenplayFor`: the same beats, pauses and scaling),
   * at the demos' own pace; the showcase's pace resumes afterwards.
   */
  const fillOf = (id: DemoId): Beat[] => [
    { do: "pace", pace: PACE },
    ...screenplayFor(id, locale).beats,
    { do: "pace", pace: SHOWCASE_PACE },
  ];
  const exported = () => document.querySelector(".sb-pop-status, .project-error");
  return {
    // Calmer than the demos: a slower hand, patient waits for the server; notes typed quickly enough to watch.
    pace: SHOWCASE_PACE,
    beats: [
      // ----- 1. The problem. The start page holds while the voice sets it up: a report a year against cultures in 48 to 72 hours.
      scene("problem"),
      { do: "look", at: ".start-heading h1", ms: 4000 },
      { do: "orbit", at: ".start-ask", turns: 1 },
      { do: "look", at: "#start-demos h2", ms: 2200 },
      // ----- 2. The doctor. The hand travels to the Doctor card, scans it, opens it; the file's own performance plays:
      // the answer card, then the case changed to the intensive care unit, a blood culture, severe; details on a row.
      scene("doctor"),
      { do: "click", at: '.start-demo[data-demo="clinician"]', orbit: 1.5, wait: answered, timeout: 20000, must: true },
      { do: "think", ms: 700 },
      ...fillOf("clinician"),
      // The details stay on screen while the voice says why this antibiotic is good enough.
      { do: "look", at: "#dr-details", ms: 3500, timeout: short },
      // ----- 3. Compound search: the sidebar's Search, a ward and an organism in one line, the list opens pre-filled.
      scene("search"),
      { do: "click", at: "[data-search]", orbit: 1, wait: ".cmd[data-expanded] .cmd-input", must: true },
      { do: "type", at: ".cmd-input", text: copy(locale, "showcaseSearch"), cps: 14, stay: true },
      { do: "wait", for: ".cmd-option", timeout: 5000 },
      { do: "think", ms: 2200 },
      { do: "click", at: ".cmd-option", wait: answered, timeout: 15000 },
      { do: "think", ms: 800 },
      { do: "look", at: ".dr-answer-head", ms: 3000 },
      { do: "orbit", at: ".uc-orgs", turns: 1 },
      // ----- 4. The timeline and a signal: the infection-control file; every unit's weeks, a pill where a count left its usual.
      scene("timeline"),
      { do: "click", at: '.sb-demo[data-demo="control"]', orbit: 1, wait: `${win("answer")} .answer-sentence`, timeout: 20000, must: true },
      { do: "think", ms: 600 },
      { do: "look", at: inWin("answer", ".answer-sentence"), ms: 3800 },
      { do: "orbit", at: inWin("timeline", ".hs-svg"), turns: 1 },
      { do: "look", at: inWin("signals", ".feed-list"), ms: 2800, timeout: short },
      // ----- 5. An anomaly and the maths behind it: the Urology E. coli profile cluster of 4 June 2025 picked on the band,
      // its card (seen 4, expected 0.2, 1 in 35,148 by chance), the Poisson tail formula with this signal's numbers, the
      // bars of that tail, the counts behind it.
      scene("anomaly"),
      { do: "click", at: clusterPill("timeline", "2025-06-04"), wait: `${card} .sig-tiles`, timeout: 8000 },
      { do: "think", ms: 600 },
      { do: "look", at: `${card} .sig-tiles`, ms: 2500, timeout: short },
      // "How we calculate it" stands open in the card's layer; folded (the Signal window), the hand opens it.
      {
        do: "click",
        at: () => document.querySelector(`${card} .sig-how:not([open]) > summary`),
        wait: `${card} .sig-how[open]`,
        timeout: 300,
      },
      { do: "look", at: `${card} .sig-how[open] .sig-formula`, ms: 3000, timeout: short },
      { do: "look", at: `${card} .math-poisson`, ms: 3000, timeout: short },
      { do: "look", at: `${card} .sig-counts`, ms: 3000, timeout: short },
      { do: "escape" },
      // ----- 6. Across the country and between wards: the THL county map, then the patient flow around the unit.
      scene("map"),
      { do: "click", at: '[data-preset="map"]', wait: inWin("map", ".geo-svg"), timeout: 12000 },
      { do: "think", ms: 700 },
      { do: "look", at: inWin("map", ".geo-title"), ms: 1400, timeout: short },
      { do: "orbit", at: inWin("map", ".geo-svg"), turns: 1.5 },
      { do: "look", at: inWin("map", ".geo-faint"), ms: 1400, timeout: short },
      { do: "click", at: '[data-preset="default"]', wait: inWin("graph", ".ug-svg"), timeout: 12000 },
      { do: "think", ms: 800 },
      { do: "look", at: inWin("graph", ".ug-title"), ms: 1200, timeout: short },
      { do: "orbit", at: inWin("graph", ".ug-svg"), turns: 1 },
      // ----- 7. The data behind every number: fifteen checks over every row, their findings listed.
      scene("quality"),
      { do: "click", at: "[data-page-data]", orbit: 1, wait: ".data-page", timeout: 8000, must: true },
      { do: "click", at: "#data-tab-quality", wait: ".quality-checks", timeout: 12000 },
      { do: "think", ms: 600 },
      { do: "look", at: ".quality-results > p", ms: 2200, timeout: short },
      { do: "orbit", at: ".quality-checks", turns: 1.5 },
      // ----- 8. The research workbench: the researcher's file opens empty and its own performance plays: the question,
      // the slice cut on the timeline, the Beta estimate run, its formula and Python, a chart. The project is frozen.
      scene("research"),
      {
        do: "click",
        at: '.sb-demo[data-demo="researcher"]',
        orbit: 1,
        wait: `${win("notebook")} [data-write-note]`,
        timeout: 20000,
        must: true,
      },
      { do: "think", ms: 500 },
      { do: "look", at: ".project-frozen", ms: 1400, timeout: short },
      ...fillOf("researcher"),
      // The inspector closed, the notebook holds still: the chart the analysis drew.
      { do: "look", at: last('.nb-cell[data-kind="chart"] svg'), ms: 3500, timeout: short },
      // ----- 9. One click: the research package (data, scripts, notebook, methods) downloads.
      scene("export"),
      { do: "click", at: "#pm-export", orbit: 1, wait: ".project-export-options", must: true },
      { do: "think", ms: 500 },
      { do: "click", at: ".project-export-options button", wait: exported, timeout: 15000 },
      { do: "think", ms: 3600 },
      { do: "escape" },
      // ----- 10. Home, then the outro: white, the wordmark in the centre, held for the voice to close.
      scene("end"),
      { do: "click", at: ".sb-home", wait: ".start-page", timeout: 8000 },
      // The start page keeps the scroll of the page before it: the hand brings its headline back to the top.
      { do: "look", at: ".start-heading h1", ms: 1200, timeout: short },
      { do: "outro", ms: 4000 },
    ],
  };
}

export const showcaseScreenplay = (locale: Locale): Screenplay => showcase(locale);

/** The pauses between decisions are a third of what they were written at: the show moves, the app still gets time to paint. */
const BREATH = 0.35;

/** A demo's screenplay as written: the pauses a person would take (the showcase plays it at this pace). */
export function rawScreenplayFor(id: DemoId, locale: Locale): Screenplay {
  return id === "clinician" ? clinician() : id === "control" ? control(locale) : researcher(locale);
}

export function screenplayFor(id: DemoId, locale: Locale): Screenplay {
  const play = rawScreenplayFor(id, locale);
  return {
    ...play,
    beats: play.beats.map((b) =>
      b.do === "think" ? { ...b, ms: Math.max(60, b.ms * BREATH) } : b.do === "look" ? { ...b, ms: (b.ms ?? 1000) * 0.5 } : b,
    ),
  };
}
