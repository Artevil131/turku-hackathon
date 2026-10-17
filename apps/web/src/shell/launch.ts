import type { AeiClient, Project } from "@aei/contract";
import { type Locale, t } from "@aei/i18n";
import { nextName, TEMPLATE_KEYS, type Template, templateJson } from "../components/research/workspace/templates.ts";
import { currentSite } from "../sites.ts";

/**
 * Creates a project from a template with the defaults, without asking: the template's name numbered
 * ("Outbreak investigation 2"), continuous data, the selected hospital, every unit and phenotype.
 * Blank is named "Project 1". The details stay editable later (Project ▸ Rename, Save as frozen version).
 */
export async function launchTemplate(client: AeiClient, locale: Locale, template: Template): Promise<Project> {
  const { projects } = await client.projects().catch(() => ({ projects: [] as Project[] }));
  const base = t(locale, template === "blank" ? "startNewBlank" : TEMPLATE_KEYS[template][0]);
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
    layout: templateJson(template),
  });
  return project;
}
