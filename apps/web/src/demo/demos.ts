import { type Locale, t } from "@aei/i18n";
import { defaultSpec } from "../components/research/charts/spec.ts";
import { defaultParams, type NbCell, newId, PAGE_VERSION, type Page } from "../components/research/notebook/model.ts";
import type { Slice } from "../components/research/tools/model.ts";
import type { Layout } from "../components/research/workspace/layout.ts";
import { gridLayout } from "../components/research/workspace/templates.ts";

// The demo files (D-065 projects, filled in as if used): one per kind of user, so a visitor sees what the tool does
// for each. A demo is only a project spec plus a notebook page; opening one creates the project once (openDemo.ts).
// The slices use fixed dates, so a demo reads the same whenever it is opened.

export type DemoId = "clinician" | "control" | "researcher";
/** A tour: one per demo file, and the full presentation. */
export type TourId = DemoId | "overview";

export interface DemoSpec {
  id: DemoId;
  /** The role label, shown as a tag. */
  roleKey: "demoRoleClinician" | "demoRoleControl" | "demoRoleResearcher";
  titleKey: "demoClinicianTitle" | "demoControlTitle" | "demoResearcherTitle";
  blurbKey: "demoClinicianBlurb" | "demoControlBlurb" | "demoResearcherBlurb";
  mode: "continuous" | "frozen";
  /** A frozen cut's date (before the replay clock's start of 12 May 2025, so it is always released). */
  asOf?: string;
  /** The replay clock's date this story is told at: opening the demo pauses the clock there (the live clock runs on and would leave the story's signals behind). */
  clockAt?: string;
  /** The board's hash query: the unit and filters the project opens with. */
  board: string;
  layout: Layout;
  /** The notebook page, without results (openDemo runs the analyses). Null: no notebook in this demo. */
  page: ((locale: Locale, site: Slice["site"]) => Page) | null;
}

const slice = (site: Slice["site"], patch: Partial<Slice> & { from: string; to: string }): Slice => ({
  ...(site ? { site } : {}),
  unit: "",
  organism: "",
  specimen: "",
  phenotype: "",
  firstOnly: true,
  ...patch,
});

const page = (cells: NbCell[]): Page => ({ v: PAGE_VERSION, cells });
const note = (text: string): NbCell => ({ id: newId(), kind: "note", text });
const sliceCell = (s: Slice): NbCell => ({ id: newId(), kind: "slice", slice: s });
const analysis = (
  tool: "rate" | "compare" | "shares" | "beta" | "detector",
  s: Slice,
  patch: Partial<ReturnType<typeof defaultParams>> = {},
): NbCell => ({
  id: newId(),
  kind: "analysis",
  tool,
  params: { ...defaultParams(s), ...patch },
  result: null,
});

/**
 * The signal's evidence opens beside the Summary and the timeline when "Show the evidence" is pressed. Its closed place is
 * reserved at the top right in the same columns as the signal list and the patient flow below it (7 to 12), so it opens as
 * the head of that column: the notebook keeps its columns and no hole opens between them. Left as it was, it opened as a
 * narrow column that pushed the signal list far down.
 */
function reserveEvidence(layout: Layout): Layout {
  const top = layout.wins.answer;
  const band = layout.wins.timeline.y + layout.wins.timeline.h - top.y;
  return { ...layout, wins: { ...layout.wins, math: { x: 7, y: top.y, w: 5, h: band, open: false } } };
}

export const DEMOS: readonly DemoSpec[] = [
  {
    id: "researcher",
    roleKey: "demoRoleResearcher",
    titleKey: "demoResearcherTitle",
    blurbKey: "demoResearcherBlurb",
    clockAt: "2025-05-12",
    mode: "frozen",
    asOf: "2025-04-30",
    board: "unit=MED-A&ph=esbl",
    // A researcher's basic desk: the timeline to cut a period from, the notebook to write in, the signals beside it.
    layout: gridLayout({
      notebook: { x: 0, y: 0, w: 8, h: 56 },
      signals: { x: 8, y: 0, w: 4, h: 56 },
    }),
    page: (locale, site) => {
      const s = slice(site, { from: "2025-03-01", to: "2025-04-30", unit: "MED-A", phenotype: "esbl" });
      return page([
        note(t(locale, "demoNoteResearcherQuestion")),
        sliceCell(s),
        { id: newId(), kind: "timeline", window: { from: "2024-10-01", to: "2025-04-30" }, collapsed: true },
        analysis("rate", s),
        analysis("compare", s, { bMode: "previous" }),
        analysis("beta", s),
        analysis("detector", s, { detector: "phenotype" }),
        { id: newId(), kind: "code", lang: "python", code: "", edited: false },
        {
          id: newId(),
          kind: "chart",
          spec: defaultSpec({ unit: "MED-A", window: { from: "2024-11-01", to: "2025-04-30" }, event: "phenotype:esbl", periodDays: 14 }),
        },
        note(t(locale, "demoNoteResearcherRead")),
      ]);
    },
  },
  {
    id: "clinician",
    roleKey: "demoRoleClinician",
    titleKey: "demoClinicianTitle",
    blurbKey: "demoClinicianBlurb",
    mode: "continuous",
    clockAt: "2025-05-12",
    board: "unit=MED-A&cov.unit=MED-A&cov.site=urine&cov.sev=mild",
    layout: gridLayout({ coverage: { x: 0, y: 0, w: 12, h: 40 } }, "none"),
    page: null,
  },
  {
    id: "control",
    roleKey: "demoRoleControl",
    titleKey: "demoControlTitle",
    blurbKey: "demoControlBlurb",
    mode: "continuous",
    // The planted Urology ESBL cluster is caught on the 4 June batch: the demo opens on that signal.
    clockAt: "2025-06-04",
    board: "unit=URO",
    layout: reserveEvidence(
      gridLayout({
        answer: { x: 0, y: 0, w: 12, h: 9 },
        // The notebook is where you write, so it is the widest and sits first; the evidence stacks beside it.
        notebook: { x: 0, y: 9, w: 7, h: 56 },
        signals: { x: 7, y: 9, w: 5, h: 28 },
        graph: { x: 7, y: 37, w: 5, h: 28 },
      }),
    ),
    page: (locale, site) => {
      const s = slice(site, { from: "2025-03-12", to: "2025-06-03", unit: "URO", phenotype: "esbl" });
      return page([
        note(t(locale, "demoNoteControlHead")),
        sliceCell(s),
        { id: newId(), kind: "timeline", window: { from: "2024-12-01", to: "2025-06-03" }, collapsed: true },
        analysis("shares", s, { period: 7 }),
        analysis("detector", s, { detector: "phenotype" }),
        note(t(locale, "demoNoteControlNext")),
      ]);
    },
  },
];
