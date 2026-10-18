import type { MessageKey } from "@aei/i18n";
import { WIN_IDS } from "../../components/research/workspace/layout.ts";

// What each kind of window is: the one source for the adaptive tour and the Docs page. A title (the window's own
// name), one sentence on what it shows, and up to two things to try. `at` is a selector inside the window; the
// tour's cursor points at it and a target that has not appeared just leaves the caption (see steps.ts).

/** Every kind of window, the chart windows (which have no fixed id) included. */
export const GUIDE_KINDS = [...WIN_IDS, "chart"] as const;
export type GuideKind = (typeof GUIDE_KINDS)[number];

type Key<P extends string> = Extract<MessageKey, `${P}${string}`>;
export interface GuideAction {
  say: Key<"tourGdTry_">;
  /** A selector inside the window. */
  at: string;
}
export interface WindowGuide {
  title: MessageKey;
  what: Key<"tourGdWhat_">;
  tries: readonly GuideAction[];
}

export const GUIDE: Record<GuideKind, WindowGuide> = {
  timeline: {
    title: "boardTimeline",
    what: "tourGdWhat_timeline",
    tries: [
      { say: "tourGdTry_timeline_1", at: ".hs-pill" },
      { say: "tourGdTry_timeline_2", at: ".hs-lane-label" },
    ],
  },
  signals: {
    title: "boardFeed",
    what: "tourGdWhat_signals",
    tries: [
      { say: "tourGdTry_signals_1", at: ".feed-row" },
      { say: "tourGdTry_signals_2", at: ".feed-header" },
    ],
  },
  history: {
    title: "boardHistory",
    what: "tourGdWhat_history",
    tries: [{ say: "tourGdTry_history_1", at: ".history .feed-row" }],
  },
  map: {
    title: "boardGeo",
    what: "tourGdWhat_map",
    tries: [
      { say: "tourGdTry_map_1", at: ".geo-field select" },
      { say: "tourGdTry_map_2", at: ".geo-county" },
    ],
  },
  graph: { title: "boardGraph", what: "tourGdWhat_graph", tries: [{ say: "tourGdTry_graph_1", at: ".ug-node" }] },
  math: { title: "boardMath", what: "tourGdWhat_math", tries: [{ say: "tourGdTry_math_1", at: ".sig" }] },
  assistant: { title: "boardAssistant", what: "tourGdWhat_assistant", tries: [{ say: "tourGdTry_assistant_1", at: ".assist" }] },
  grid: { title: "boardGrid", what: "tourGdWhat_grid", tries: [{ say: "tourGdTry_grid_1", at: ".ugrid-segbtn" }] },
  reproduce: {
    title: "boardReproduce",
    what: "tourGdWhat_reproduce",
    tries: [{ say: "tourGdTry_reproduce_1", at: ".reproduce-languages" }],
  },
  notebook: {
    title: "notebookWindow",
    what: "tourGdWhat_notebook",
    tries: [
      { say: "tourGdTry_notebook_1", at: ".nb-plus" },
      { say: "tourGdTry_notebook_2", at: ".nb-cell" },
    ],
  },
  coverage: {
    title: "boardCoverage",
    what: "tourGdWhat_coverage",
    tries: [
      { say: "tourGdTry_coverage_1", at: ".cl-row" },
      { say: "tourGdTry_coverage_2", at: ".dr-answer-change" },
    ],
  },
  answer: { title: "boardAnswer", what: "tourGdWhat_answer", tries: [{ say: "tourGdTry_answer_1", at: ".answer-primary" }] },
  chart: { title: "tourGdTitle_chart", what: "tourGdWhat_chart", tries: [{ say: "tourGdTry_chart_1", at: ".ch-foot" }] },
};

/** The guide kind of a window id on the board: `signals`, a copy `win:<kind>:<n>`, or a chart `chart:<n>`; null if unknown. */
export function kindOfWindow(id: string): GuideKind | null {
  const kind = id.startsWith("chart:") ? "chart" : id.startsWith("win:") ? id.split(":")[1] : id;
  return (GUIDE_KINDS as readonly string[]).includes(kind ?? "") ? (kind as GuideKind) : null;
}
