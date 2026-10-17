import type { AeiClient, Project } from "@aei/contract";
import { type Locale, t } from "@aei/i18n";
import { codeFor, loadPage, type NbCell, pageSlot, runInputs, savePage, sliceAbove } from "../components/research/notebook/model.ts";
import { runTool } from "../components/research/tools/run.ts";
import { serializeLayout } from "../components/research/workspace/layout.ts";
import { currentSite, homeSite, siteWards } from "../sites.ts";
import type { DemoSpec } from "./demos.ts";

/** Runs a demo page's analyses on the live data and fills the code cell from the result above it, so the page reads as used before. */
async function runPage(client: AeiClient, cells: NbCell[]): Promise<NbCell[]> {
  const done: NbCell[] = [];
  for (const cell of cells) {
    if (cell.kind === "analysis") {
      const above = sliceAbove(done, done.length);
      if (above) {
        const wards = siteWards(above.slice.site ?? null).map((w) => w.code as string);
        const result = await runTool(client, cell.tool, above.slice, runInputs(above.slice, cell.params, wards)).catch(() => null);
        done.push({ ...cell, result });
        continue;
      }
    }
    if (cell.kind === "code" && !cell.edited) {
      const result = [...done].reverse().find((c) => c.kind === "analysis" && c.result);
      done.push(result && result.kind === "analysis" && result.result ? { ...cell, code: codeFor(result.result, cell.lang) } : cell);
      continue;
    }
    done.push(cell);
  }
  return done;
}

/**
 * Bump when a demo's layout, notes or analyses change: a demo opened before is then rebuilt once (its layout, board and
 * notebook reset to the new version), so everyone sees the current demo, not the one first created in their browser.
 */
const DEMO_VERSION = "8";
const versionKey = (projectId: string) => `yl.demo.${projectId}`;
const storedVersion = (projectId: string) => {
  try {
    return localStorage.getItem(versionKey(projectId));
  } catch {
    return null;
  }
};
const storeVersion = (projectId: string) => {
  try {
    localStorage.setItem(versionKey(projectId), DEMO_VERSION);
  } catch {
    // Private mode: the demo is simply rebuilt on the next open.
  }
};

/**
 * Opens a demo file as an ordinary project: the first time it creates the project (layout, board, frozen cut) and
 * fills its notebook; afterwards it just returns the project it made, so the visitor's edits are kept.
 */
export interface FillPlan {
  slot: string;
  /** The whole notebook, results included; it is handed over one cell at a time. */
  cells: NbCell[];
  /** The windows in the order they appear. */
  windows: string[];
}

/** The open windows of a demo's layout, in reading order. */
const windowOrder = (demo: DemoSpec): string[] =>
  Object.entries(demo.layout.wins)
    .filter(([, w]) => w.open)
    .sort(([, a], [, b]) => a.y - b.y || a.x - b.x)
    .map(([id]) => id);

export async function openDemo(
  client: AeiClient,
  locale: Locale,
  demo: DemoSpec,
  opts: { fill?: boolean } = {},
): Promise<{ project: Project; plan: FillPlan | null }> {
  const name = t(locale, demo.titleKey);
  const description = t(locale, demo.blurbKey);
  const { projects } = await client.projects();
  const existing = projects.find((p) => p.name === name && p.description === description);
  const site = currentSite() ?? homeSite().id;
  // Fills the notebook: at once, or (with `fill`) left empty and handed back as a plan the screen plays out.
  const seed = async (projectId: string): Promise<FillPlan | null> => {
    const slot = pageSlot(currentSite(), projectId);
    const built = demo.page ? demo.page(locale, site) : null;
    const cells = built ? await runPage(client, built.cells) : [];
    if (opts.fill) {
      if (built) savePage(slot, { ...built, cells: [] });
      return { slot, cells, windows: windowOrder(demo) };
    }
    if (built) savePage(slot, { ...built, cells });
    return null;
  };
  if (existing) {
    if (storedVersion(existing.id) === DEMO_VERSION) return { project: existing, plan: null };
    // An older demo: bring it to the current version once.
    const fresh = (await client.project(existing.id)).project;
    const updated = await client.updateProject(existing.id, {
      ...fresh,
      layout: JSON.parse(serializeLayout(demo.layout)) as Record<string, unknown>,
      scope: { ...fresh.scope, board: demo.board },
    });
    const plan = await seed(existing.id);
    storeVersion(existing.id);
    return { project: updated.project, plan };
  }
  const input = {
    name,
    description,
    scope: { site, units: [], organisms: [], phenotypes: [], kinds: [], board: demo.board },
    layout: JSON.parse(serializeLayout(demo.layout)) as Record<string, unknown>,
  };
  // A frozen cut is refused when its date is after the replay clock; the demo then stays continuous.
  const created = await (demo.mode === "frozen" && demo.asOf
    ? client
        .createProject({ ...input, mode: "frozen", asOf: demo.asOf })
        .catch(() => client.createProject({ ...input, mode: "continuous" }))
    : client.createProject({ ...input, mode: "continuous" }));
  const project = created.project;
  const slot = pageSlot(currentSite(), project.id);
  const plan = demo.page && loadPage(slot).cells.length > 0 ? null : await seed(project.id);
  storeVersion(project.id);
  return { project, plan };
}
