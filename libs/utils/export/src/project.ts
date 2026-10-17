import type { Alert } from "@aei/contract";
import { HOME_SITE, type IsolateRecord, siteOfWard } from "@aei/domain";
import { matchesScope, type Project, type ProjectScope } from "@aei/projects";
import type { ExportBundle } from "./bundle.ts";
import { alertTable, isolateTable } from "./tables.ts";

function signalKind(alert: Alert): string | null {
  if (alert.kind === "cpe" || alert.kind === "new-in-unit") return "sentinel";
  if (alert.kind === "carrier") return null;
  switch (alert.detector) {
    case "profile-excess":
    case "phenotype-excess":
      return "cluster";
    case "rising-trend":
      return "trend";
    case "sampling-drop":
    case "empty-run":
      return "data";
  }
}

/** Same alert cut as the research board; callers may supply their registered unit-to-site lookup. */
export function alertInScope(alert: Alert, scope: ProjectScope, asOf: string, siteOf: (ward: string) => string = siteOfWard): boolean {
  const phenotype = "phenotype" in alert ? alert.phenotype : alert.kind === "cpe" ? "cpe" : undefined;
  const organism = "organism" in alert ? alert.organism : undefined;
  const kind = signalKind(alert);
  const site = alert.ward !== null ? siteOf(alert.ward) : ((alert as { site?: string }).site ?? HOME_SITE.id);
  return (
    (!scope.from || alert.date >= scope.from) &&
    alert.date <= asOf &&
    (!scope.to || alert.date <= scope.to) &&
    (!scope.site || site === scope.site) &&
    (!scope.units.length || (alert.ward !== null && scope.units.includes(alert.ward))) &&
    (!scope.organisms.length || (organism !== undefined && scope.organisms.includes(organism))) &&
    (!scope.phenotypes.length || (phenotype !== undefined && scope.phenotypes.includes(phenotype))) &&
    (!scope.kinds.length || (kind !== null && scope.kinds.includes(kind)))
  );
}

export interface ProjectBundleLabels {
  isolates: string;
  patients: string;
  alerts: string;
  isolateMethod: string;
  patientMethod: string;
  alertMethod: string;
  frozenNote: string;
}

/** Export the saved scope, never a transient board selection. Site-filter records before calling. */
export function projectBundle({
  project,
  records,
  alerts,
  antibiotics,
  labels,
  clock,
  appVersion,
}: {
  project: Project;
  records: IsolateRecord[];
  alerts: Alert[];
  antibiotics: string[];
  labels: ProjectBundleLabels;
  clock: string;
  appVersion?: string;
}): ExportBundle {
  const asOf = project.mode === "frozen" ? (project.asOf ?? clock) : clock;
  const scope: ExportBundle["scope"] = {};
  for (const [key, value] of Object.entries(project.scope)) if (value !== undefined) scope[key] = value;
  const selectedRecords = records.filter((record) => matchesScope(record, project.scope, asOf));
  const selectedAlerts = alerts.filter((alert) => alertInScope(alert, project.scope, asOf));
  return {
    title: project.name,
    generatedAt: new Date().toISOString(),
    appVersion,
    asOf,
    mode: project.mode,
    scope,
    fingerprint: project.mode === "frozen" ? project.fingerprint : undefined,
    sourceNote: project.mode === "frozen" ? labels.frozenNote : undefined,
    tables: [isolateTable(selectedRecords, antibiotics), alertTable(selectedAlerts)],
    figures: [],
    numbers: [
      {
        id: "isolates",
        label: labels.isolates,
        value: selectedRecords.length,
        method: labels.isolateMethod,
        recipe: { op: "count", table: "isolates" },
      },
      {
        id: "patients",
        label: labels.patients,
        value: new Set(selectedRecords.map((record) => record.patientId)).size,
        method: labels.patientMethod,
        recipe: { op: "distinct", table: "isolates", column: "patientId" },
      },
      {
        id: "alerts",
        label: labels.alerts,
        value: selectedAlerts.length,
        method: labels.alertMethod,
        recipe: { op: "count", table: "alerts" },
      },
    ],
  };
}
