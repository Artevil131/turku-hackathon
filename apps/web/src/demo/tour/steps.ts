import type { Locale } from "@aei/i18n";
import type { DemoId } from "../demos.ts";

// The guided tours (one per demo file): what the cursor points at, what it does there, and the caption it shows.
// Targets are the app's own DOM, so a tour drives the real tool; a step whose target never appears just shows
// its caption, so a changed screen degrades to a narrated slideshow instead of breaking.

export type TourKey = `tour${string}`;
export type Target = string | (() => Element | null);

export interface TourStep {
  say: TourKey;
  /** What the cursor points at and the spotlight rings. None: the caption alone, cursor parked. */
  at?: Target;
  /** What the cursor does there: point (default), click, or type `text` into it. */
  act?: "point" | "click" | "type";
  text?: string;
  /** After acting, wait for this to appear (up to `wait` ms) before the caption's reading time starts. */
  waitFor?: Target;
  wait?: number;
  /** Ring this after acting instead of `at` (the window that just opened, say). */
  show?: Target;
}

const first = (sel: string) => () => document.querySelector(sel);
const last = (sel: string) => () => {
  const all = document.querySelectorAll(sel);
  return all[all.length - 1] ?? null;
};
const nth = (sel: string, n: number) => () => document.querySelectorAll(sel)[n] ?? null;
const win = (id: string) => `.ws-win[data-win="${id}"]`;

/** The band at the top of every project: the whole strip, its unit lanes, and one ordinary signal pill. */
const band = (): TourStep[] => [
  { say: "tourBand", at: () => document.querySelector(".hs-base")?.closest("svg") ?? null },
  { say: "tourLanes", at: () => document.querySelector(".hs-lane-label")?.closest("g")?.parentElement ?? null },
  {
    say: "tourPills",
    at: () => document.querySelector('.hs-pill:not([data-kind="sentinel"]):not([data-kind="data"])') ?? document.querySelector(".hs-pill"),
  },
];

/** Remembers which notebook cells exist, so a later step can find the one the tour just added. */
function cellTracker() {
  let before = new Set<string>();
  return {
    mark: () => {
      before = new Set([...document.querySelectorAll<HTMLElement>(".nb-cell")].map((c) => c.dataset.cell ?? ""));
    },
    added:
      (inner = "") =>
      () => {
        const fresh = [...document.querySelectorAll<HTMLElement>(".nb-cell")].find((c) => !before.has(c.dataset.cell ?? ""));
        return fresh ? (inner ? fresh.querySelector(inner) : fresh) : null;
      },
  };
}

/** A step with no target that runs a side effect first (marking cells), for the steps that add cells. */
const markThen = (mark: () => void, step: TourStep): TourStep => {
  const at = step.at;
  return {
    ...step,
    at: () => {
      mark();
      return typeof at === "function" ? at() : at ? document.querySelector(at) : null;
    },
  };
};

function clinician(): TourStep[] {
  return [
    { say: "tourClinIntro", at: win("coverage") },
    // The coverage list's own source line: synthetic demo data, and the data checks it passed.
    { say: "tourYourData", at: first(`${win("coverage")} .data-quality`) },
    ...band(),
    { say: "tourClinRecord", at: first(".rs") },
    { say: "tourClinRow", at: first(".cl-row .cl-num") },
    { say: "tourClinPlot", at: first(".cl-row .cl-plot") },
    { say: "tourClinN", at: first(".cl-row .cl-n") },
    // Severe before the details: in a narrow window the details cover the list and its record strip.
    { say: "tourClinSevere", at: first('.rs-choice[data-value="severe"]'), act: "click", show: "#dr-list" },
    { say: "tourClinDetails", at: first(".cl-row"), act: "click", waitFor: "#dr-details", show: "#dr-details" },
    { say: "tourClinSignals", at: win("signals") },
    { say: "tourClinSignalOpen", at: first(`${win("signals")} .feed-row-main`), act: "click", show: win("signals") },
    { say: "tourClinAdd", at: "[data-add-window]", act: "click", waitFor: ".ws-picker" },
    { say: "tourClinMath", at: '.ws-picker [data-add="math"]', act: "click", waitFor: win("math"), show: win("math") },
    { say: "tourClinTools", at: '.ws-rail-btn[data-tool="stats"]', act: "click", waitFor: "#ws-rail-menu" },
    { say: "tourClinRate", at: '#ws-rail-menu [data-tool="rate"]', act: "click", waitFor: "#ws-inspector", show: "#ws-inspector" },
    { say: "tourClinInfer" },
    { say: "tourClinOutro" },
  ];
}

function control(): TourStep[] {
  const cells = cellTracker();
  return [
    { say: "tourCtrlIntro" },
    { say: "tourYourData", at: first(".q-status") },
    ...band(),
    { say: "tourCtrlSlice", at: first('.nb-cell[data-kind="slice"]') },
    { say: "tourCtrlSignals", at: win("signals") },
    { say: "tourCtrlNote", at: first('.nb-cell[data-kind="note"]') },
    { say: "tourCtrlShares", at: nth('.nb-cell[data-kind="analysis"]', 0) },
    { say: "tourCtrlDetector", at: nth('.nb-cell[data-kind="analysis"]', 1) },
    { say: "tourCtrlGraph", at: win("graph") },
    { say: "tourCtrlMap", at: win("map") },
    markThen(cells.mark, {
      say: "tourCtrlAdd",
      at: last(".nb-slot:has(.nb-cell[data-kind='analysis']) .nb-plus"),
      act: "click",
      waitFor: ".nb-menu",
    }),
    { say: "tourCtrlCompare", at: '.nb-menu [data-add="compare"]', act: "click", waitFor: cells.added(), show: cells.added() },
    {
      say: "tourCtrlCompare",
      at: cells.added(".nb-run"),
      act: "click",
      waitFor: cells.added(".nb-method"),
      wait: 8000,
    },
    { say: "tourCtrlCompareRead", at: cells.added() },
    { say: "tourCtrlWindow", at: "[data-add-window]", act: "click", waitFor: ".ws-picker" },
    { say: "tourCtrlWindow", at: '.ws-picker [data-add="grid"]', act: "click", waitFor: win("grid"), show: win("grid") },
    { say: "tourCtrlInfer" },
    { say: "tourCtrlOutro" },
  ];
}

function researcher(): TourStep[] {
  const codeCell = first('.nb-cell[data-kind="code"]');
  return [
    { say: "tourResIntro", at: first(".project-frozen") },
    { say: "tourYourData", at: first(".q-status") },
    ...band(),
    { say: "tourResQuestion", at: first('.nb-cell[data-kind="slice"]') },
    { say: "tourResRate", at: nth('.nb-cell[data-kind="analysis"]', 0) },
    { say: "tourResCompare", at: nth('.nb-cell[data-kind="analysis"]', 1) },
    { say: "tourResBeta", at: nth('.nb-cell[data-kind="analysis"]', 2) },
    { say: "tourResDetector", at: nth('.nb-cell[data-kind="analysis"]', 3) },
    // Python in the page (Pyodide) and the embedded notebook are off for now to keep the site quick: the tour shows
    // the code and where Reproduce opens it, and runs nothing.
    { say: "tourResCode", at: codeCell },
    { say: "tourResReproduce", at: first('.nb-cell[data-kind="code"] [data-open-reproduce]') },
    { say: "tourResInfer" },
    { say: "tourResOutro" },
  ];
}

export function tourFor(id: DemoId, _locale: Locale): TourStep[] {
  return id === "clinician" ? clinician() : id === "control" ? control() : researcher();
}
