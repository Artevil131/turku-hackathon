import { type Locale, t } from "@aei/i18n";
import { defaultSpec } from "../components/research/charts/spec.ts";
import { defaultParams, type NbCell, newId, PAGE_VERSION, type Page } from "../components/research/notebook/model.ts";
import type { Slice } from "../components/research/tools/model.ts";
import type { Layout } from "../components/research/workspace/layout.ts";
import { gridLayout } from "../components/research/workspace/templates.ts";

// The demo files (D-065 projects, filled in as if used): one per kind of user, so a visitor sees what the tool does
// for each. A demo is only a project spec plus a notebook page; opening one creates the project once (openDemo.ts).
// The slices use fixed dates, so a demo reads the same whenever it is opened.

export type DemoId = "clinician" | "control" | "researcher" | "regional" | "steward";

export interface DemoSpec {
  id: DemoId;
  /** The role label, shown as a tag. */
  roleKey: "demoRoleClinician" | "demoRoleControl" | "demoRoleResearcher" | "demoRoleRegional" | "demoRoleSteward";
  titleKey: "demoClinicianTitle" | "demoControlTitle" | "demoResearcherTitle" | "demoRegionalTitle" | "demoStewardTitle";
  blurbKey: "demoClinicianBlurb" | "demoControlBlurb" | "demoResearcherBlurb" | "demoRegionalBlurb" | "demoStewardBlurb";
  mode: "continuous" | "frozen";
  /** A frozen cut's date (before the replay clock's start of 12 May 2025, so it is always released). */
  asOf?: string;
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

export const DEMOS: readonly DemoSpec[] = [
  {
    id: "clinician",
    roleKey: "demoRoleClinician",
    titleKey: "demoClinicianTitle",
    blurbKey: "demoClinicianBlurb",
    mode: "continuous",
    board: "unit=MED-A&cov.unit=MED-A&cov.site=urine&cov.sev=mild",
    layout: gridLayout({ coverage: { x: 0, y: 0, w: 8, h: 38 }, signals: { x: 8, y: 0, w: 4, h: 38 } }),
    page: null,
  },
  {
    id: "control",
    roleKey: "demoRoleControl",
    titleKey: "demoControlTitle",
    blurbKey: "demoControlBlurb",
    mode: "continuous",
    board: "unit=MED-A&ph=esbl",
    layout: gridLayout({
      signals: { x: 0, y: 0, w: 4, h: 40 },
      notebook: { x: 4, y: 0, w: 5, h: 40 },
      graph: { x: 9, y: 0, w: 3, h: 20 },
      map: { x: 9, y: 20, w: 3, h: 20 },
    }),
    page: (locale, site) => {
      const s = slice(site, { from: "2025-02-17", to: "2025-05-11", unit: "MED-A", phenotype: "esbl" });
      return page([
        note(t(locale, "demoNoteControlHead")),
        sliceCell(s),
        { id: newId(), kind: "timeline", window: { from: "2024-11-01", to: "2025-05-11" } },
        analysis("shares", s, { period: 7 }),
        analysis("detector", s, { detector: "phenotype" }),
        note(t(locale, "demoNoteControlNext")),
      ]);
    },
  },
  {
    id: "researcher",
    roleKey: "demoRoleResearcher",
    titleKey: "demoResearcherTitle",
    blurbKey: "demoResearcherBlurb",
    mode: "frozen",
    asOf: "2025-04-30",
    board: "unit=MED-A&ph=esbl",
    layout: gridLayout({
      notebook: { x: 0, y: 0, w: 8, h: 70 },
      reproduce: { x: 8, y: 0, w: 4, h: 30 },
      signals: { x: 8, y: 30, w: 4, h: 40 },
    }),
    page: (locale, site) => {
      const s = slice(site, { from: "2025-03-01", to: "2025-04-30", unit: "MED-A", phenotype: "esbl" });
      return page([
        note(t(locale, "demoNoteResearcherQuestion")),
        sliceCell(s),
        { id: newId(), kind: "timeline", window: { from: "2024-10-01", to: "2025-04-30" } },
        analysis("rate", s),
        analysis("compare", s, { bMode: "previous" }),
        analysis("beta", s),
        analysis("detector", s, { detector: "profile" }),
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
    id: "regional",
    roleKey: "demoRoleRegional",
    titleKey: "demoRegionalTitle",
    blurbKey: "demoRegionalBlurb",
    mode: "continuous",
    board: "ph=esbl",
    layout: gridLayout({ map: { x: 0, y: 0, w: 7, h: 38 }, notebook: { x: 7, y: 0, w: 5, h: 38 } }),
    page: (locale, site) => {
      const s = slice(site, { from: "2024-05-12", to: "2025-05-11", phenotype: "esbl" });
      return page([
        note(t(locale, "demoNoteRegionalHead")),
        sliceCell(s),
        analysis("shares", s, { period: 28 }),
        { id: newId(), kind: "chart", spec: defaultSpec({ window: { weeks: 52 }, event: "phenotype:esbl", periodDays: 28 }) },
      ]);
    },
  },
  {
    id: "steward",
    roleKey: "demoRoleSteward",
    titleKey: "demoStewardTitle",
    blurbKey: "demoStewardBlurb",
    mode: "continuous",
    board: "panel=grid&unit=MED-A&cov.unit=MED-A",
    layout: gridLayout({
      grid: { x: 0, y: 0, w: 12, h: 26 },
      coverage: { x: 0, y: 26, w: 6, h: 32 },
      notebook: { x: 6, y: 26, w: 6, h: 32 },
    }),
    page: (locale, site) => {
      const s = slice(site, { from: "2025-02-11", to: "2025-05-11", unit: "MED-A", phenotype: "esbl" });
      return page([
        note(t(locale, "demoNoteStewardHead")),
        sliceCell(s),
        analysis("compare", s, { bMode: "unit", bUnit: "URO" }),
        { id: newId(), kind: "chart", spec: defaultSpec({ type: "bars", window: { weeks: 12 }, unit: "MED-A", event: "phenotype:esbl" }) },
      ]);
    },
  },
];
