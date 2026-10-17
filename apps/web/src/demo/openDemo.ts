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
 * Opens a demo file as an ordinary project: the first time it creates the project (layout, board, frozen cut) and
 * fills its notebook; afterwards it just returns the project it made, so the visitor's edits are kept.
 */
export async function openDemo(client: AeiClient, locale: Locale, demo: DemoSpec): Promise<Project> {
  const name = t(locale, demo.titleKey);
  const description = t(locale, demo.blurbKey);
  const { projects } = await client.projects();
  const existing = projects.find((p) => p.name === name && p.description === description);
  if (existing) return existing;
  const site = currentSite() ?? homeSite().id;
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
  if (demo.page) {
    const slot = pageSlot(currentSite(), project.id);
    if (loadPage(slot).cells.length === 0) {
      const built = demo.page(locale, site);
      savePage(slot, { ...built, cells: await runPage(client, built.cells) });
    }
  }
  return project;
}
