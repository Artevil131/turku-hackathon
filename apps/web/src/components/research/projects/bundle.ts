import type { AeiClient, Alert } from "@aei/contract";
import { ANTIBIOTICS } from "@aei/domain";
import type { ExportBundle, ExportFigure } from "@aei/export";
import { type Locale, t } from "@aei/i18n";
import { matchesScope, type Project, type ProjectScope } from "@aei/projects";
import { alertSiteOf, currentSite } from "../../../sites.ts";
import { type BoardState, boardToParams, kindOf } from "../board.ts";

export function workspaceScope(board: BoardState, clock: string): ProjectScope {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(boardToParams(board))) if (value) params.set(key, value);
  return {
    site: currentSite() ?? undefined,
    from: new Date(Date.parse(`${clock}T00:00:00Z`) - board.weeks * 7 * 86_400_000).toISOString().slice(0, 10),
    units: board.unit ? [board.unit] : [],
    organisms: [],
    phenotypes: board.phenotype ? [board.phenotype] : [],
    kinds: [...board.kinds],
    board: params.toString(),
  };
}

export function alertInScope(alert: Alert, scope: ProjectScope, asOf: string): boolean {
  const phenotype = "phenotype" in alert ? alert.phenotype : alert.kind === "cpe" ? "cpe" : undefined;
  const organism = "organism" in alert ? alert.organism : undefined;
  const kind = kindOf(alert);
  return (
    (!scope.from || alert.date >= scope.from) &&
    alert.date <= asOf &&
    (!scope.to || alert.date <= scope.to) &&
    (!scope.site || alertSiteOf(alert) === scope.site) &&
    (!scope.units.length || (alert.ward !== null && scope.units.includes(alert.ward))) &&
    (!scope.organisms.length || (organism !== undefined && scope.organisms.includes(organism))) &&
    (!scope.phenotypes.length || (phenotype !== undefined && scope.phenotypes.includes(phenotype))) &&
    (!scope.kinds.length || (kind !== null && scope.kinds.includes(kind)))
  );
}

export async function workspaceFigures(root: HTMLElement, png: boolean, locale: Locale): Promise<ExportFigure[]> {
  // The export gear (docx, jszip) loads when an export is asked for, not with the research page.
  const { rasterizeSvg, serializeSvg } = await import("@aei/export/dom");
  const figures: ExportFigure[] = [];
  for (const win of root.querySelectorAll<HTMLElement>(".ws-win")) {
    if (win.hidden || win.closest("[hidden]") || !win.getClientRects().length) continue;
    const title = win.querySelector(".ws-title span")?.textContent?.trim() ?? win.id;
    const svgs = [...win.querySelectorAll<SVGSVGElement>(".ws-body svg")].filter(
      (svg) =>
        !svg.parentElement?.closest("svg") &&
        svg.getAttribute("aria-hidden") !== "true" &&
        svg.getBoundingClientRect().width > 0 &&
        svg.getBoundingClientRect().height > 0,
    );
    for (const [index, svg] of svgs.entries()) {
      const text = serializeSvg(svg);
      const bounds = svg.getBoundingClientRect();
      figures.push({
        name: `${win.id || "figure"}-${index + 1}`,
        title: svgs.length > 1 ? `${title} ${index + 1}` : title,
        caption: t(locale, "exportFigureNote"),
        svg: text,
        png: png ? await rasterizeSvg(text, bounds.width, bounds.height) : undefined,
      });
    }
  }
  return figures;
}

export async function workspaceBundle({
  client,
  board,
  clock,
  project,
  root,
  png,
  locale,
}: {
  client: AeiClient;
  board: BoardState;
  clock: string;
  project?: Project;
  root: HTMLElement;
  png: boolean;
  locale: Locale;
}): Promise<ExportBundle> {
  const { alertTable, isolateTable } = await import("@aei/export");
  const asOf = project?.mode === "frozen" ? (project.asOf ?? clock) : clock;
  const scope = workspaceScope(board, clock);
  // Keep a frozen window fixed as the replay moves on; choosing another window length changes it.
  if (
    project?.mode === "frozen" &&
    new URLSearchParams(project.scope.board).get("weeks") === new URLSearchParams(scope.board).get("weeks") &&
    project.scope.site === scope.site
  ) {
    scope.from = project.scope.from;
    scope.to = project.scope.to;
  }
  const [isolates, alerts] = await Promise.all([
    client.isolates({ from: scope.from, to: asOf, ward: scope.units.length === 1 ? scope.units[0] : undefined, site: scope.site }),
    client.alerts({ from: scope.from, site: scope.site }),
  ]);
  const records = isolates.records.filter((r) => matchesScope(r, scope, asOf));
  const selectedAlerts = alerts.alerts.filter((a) => alertInScope(a, scope, asOf));
  const exportScope: ExportBundle["scope"] = {};
  for (const [key, value] of Object.entries(scope)) if (value !== undefined) exportScope[key] = value;
  return {
    title: project?.name ?? t(locale, "exportDefaultTitle", { date: asOf }),
    generatedAt: new Date().toISOString(),
    asOf,
    mode: project?.mode ?? "continuous",
    scope: exportScope,
    sourceNote: project?.mode === "frozen" ? t(locale, "exportFrozenNote") : undefined,
    fingerprint: project?.mode === "frozen" ? project.fingerprint : undefined,
    tables: [
      isolateTable(
        records,
        ANTIBIOTICS.map((a) => a.code),
      ),
      alertTable(selectedAlerts),
    ],
    figures: await workspaceFigures(root, png, locale),
    numbers: [
      { label: t(locale, "exportIsolates"), value: records.length, method: t(locale, "exportIsolateMethod") },
      {
        label: t(locale, "exportPatients"),
        value: new Set(records.map((r) => r.patientId)).size,
        method: t(locale, "exportPatientMethod"),
      },
      { label: t(locale, "exportAlerts"), value: selectedAlerts.length, method: t(locale, "exportAlertMethod") },
    ],
    locale,
  };
}
