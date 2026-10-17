import type { AntibioticCode, IsolateRecord } from "@aei/domain";
import type { ExportColumn, ExportTable } from "./bundle.ts";

// Structural header: accepts the contract's Alert without coupling exports to the API client.
type AlertRow = { id: string; kind: string; date: string; ward: string | null; incident?: string };

const isolateColumns: ExportColumn[] = [
  { key: "isolateId", label: "Isolate ID", description: "Laboratory isolate identifier." },
  { key: "cultureId", label: "Culture ID", description: "Culture containing the isolate." },
  { key: "patientId", label: "Patient ID", description: "Pseudonymous patient identifier." },
  { key: "sampleDate", type: "date", label: "Sample date", description: "Sample collection date, YYYY-MM-DD." },
  { key: "admissionDate", type: "date", label: "Admission date", description: "Admission date, YYYY-MM-DD; null when unavailable." },
  { key: "ward", label: "Unit", description: "Hospital unit code." },
  { key: "specimen", label: "Specimen", description: "Reported specimen type." },
  { key: "organism", label: "Organism", description: "Reported organism." },
  { key: "sex", label: "Sex", description: "Recorded sex." },
  { key: "ageYears", type: "integer", label: "Age", description: "Age in completed years.", unit: "years" },
  { key: "homeArea", label: "Home area", description: "Patient home area code." },
  { key: "phenotypes", label: "Phenotypes", description: "Resistance phenotype codes separated by semicolons." },
];

export function isolateTable(records: IsolateRecord[], antibiotics: string[]): ExportTable {
  return {
    name: "isolates",
    title: "Isolates",
    columns: [
      ...isolateColumns.map((c) => ({ ...c })),
      ...antibiotics.map((key) => ({
        key,
        label: key,
        role: "result" as const,
        description: `Susceptibility to ${key}: S = susceptible, R = resistant, blank = not tested.`,
      })),
    ],
    rows: records.map(
      (record) =>
        Object.fromEntries([
          ...isolateColumns.map(({ key }) => [
            key,
            key === "phenotypes" ? record.phenotypes.join(";") : record[key as keyof IsolateRecord],
          ]),
          ...antibiotics.map((code) => [code, record.results[code as AntibioticCode] ?? ""]),
        ]) as ExportTable["rows"][number],
    ),
  };
}

const alertColumns: ExportColumn[] = [
  { key: "id", label: "Alert ID", description: "Unique alert identifier; one row per alert, not per incident." },
  { key: "incident", label: "Incident ID", description: "Shared event identifier when assigned." },
  { key: "kind", label: "Kind", description: "cpe, carrier, new-in-unit or detector." },
  { key: "date", type: "date", label: "Date", description: "Alert date, YYYY-MM-DD." },
  { key: "ward", label: "Unit", description: "Unit code; null for hospital-wide signals." },
  { key: "site", label: "Hospital", description: "Explicit hospital code for hospital-wide signals, when supplied." },
  { key: "patientId", label: "Patient ID", description: "Pseudonymous patient identifier for patient-level alerts." },
  { key: "isolateId", label: "Isolate ID", description: "Triggering isolate identifier when supplied." },
  { key: "cultureId", label: "Culture ID", description: "Triggering carrier culture identifier." },
  { key: "organism", label: "Organism", description: "Organism associated with the alert." },
  { key: "specimen", label: "Specimen", description: "Specimen type when supplied." },
  { key: "phenotype", label: "Phenotype", description: "Resistance phenotype code when supplied." },
  { key: "from", label: "Previous unit", description: "Carrier's previous unit code." },
  { key: "foundOn", type: "date", label: "First found", description: "Carrier finding date, YYYY-MM-DD." },
  { key: "confirmed", type: "boolean", label: "Confirmed", description: "Whether the carrier finding is confirmed." },
  {
    key: "previous",
    type: "date",
    label: "Previous finding",
    description: "Previous phenotype finding date in this unit; null if unknown.",
  },
  { key: "detector", label: "Detector", description: "Statistical detector name." },
  { key: "antibiotic", label: "Antibiotic", description: "Antibiotic code for a resistance trend." },
  { key: "profile", label: "Profile", description: "S/R profile in dataset antibiotic order; dot means not tested." },
  { key: "observed", type: "number", label: "Observed", description: "Observed detector count, or proportion for trends." },
  { key: "expected", type: "number", label: "Expected", description: "Expected detector value when supplied." },
  { key: "p", type: "number", label: "P value", description: "Detector p value when supplied; not a new test computed by export." },
];

/** Union fields not applicable to an alert are null; false and zero are preserved. */
export function alertTable(alerts: AlertRow[]): ExportTable {
  return {
    name: "alerts",
    title: "Alerts",
    columns: alertColumns.map((c) => ({ ...c })),
    rows: alerts.map((alert) =>
      Object.fromEntries(alertColumns.map(({ key }) => [key, (alert as unknown as ExportTable["rows"][number])[key] ?? null])),
    ),
  };
}
