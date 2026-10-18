import type { AeiClient, Project } from "@aei/contract";
import { type Locale, type MessageKey, t } from "@aei/i18n";
import type { WinId } from "../components/research/workspace/layout.ts";
import { nextName, TEMPLATE_KEYS, type Template, templateJson, windowJson } from "../components/research/workspace/templates.ts";
import { currentSite } from "../sites.ts";

/** Projects made here this session and not yet opened: the app offers its short tour once, to what you just made. */
const fresh = new Set<string>();
export const takeFresh = (id: string): boolean => fresh.delete(id);

async function create(client: AeiClient, locale: Locale, baseKey: MessageKey, layout: Record<string, unknown>): Promise<Project> {
  const { projects } = await client.projects().catch(() => ({ projects: [] as Project[] }));
  const base = t(locale, baseKey);
  const name = nextName(
    base,
    projects.map((p) => p.name),
    (n) => t(locale, "startTemplateName", { name: base, n }),
  );
  const { project } = await client.createProject({
    name,
    description: "",
    mode: "continuous",
    scope: { site: currentSite() ?? undefined, units: [], organisms: [], phenotypes: [], kinds: [], board: "" },
    layout,
  });
  fresh.add(project.id);
  return project;
}

/**
 * Creates a project from a template with the defaults, without asking: the template's name numbered
 * ("Outbreak investigation 2"), continuous data, the selected hospital, every unit and phenotype.
 * Blank is named "Project 1". The details stay editable later (Project ▸ Rename, Save as frozen version).
 */
export const launchTemplate = (client: AeiClient, locale: Locale, template: Template): Promise<Project> =>
  create(client, locale, template === "blank" ? "startNewBlank" : TEMPLATE_KEYS[template][0], templateJson(template));

/** A new project with one window of the given kind, named after it (the Docs page's "Show me"). */
export const launchWindow = (client: AeiClient, locale: Locale, kind: WinId, title: MessageKey): Promise<Project> =>
  create(client, locale, title, windowJson(kind));
