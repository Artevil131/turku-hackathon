import type { Alert } from "@aei/contract";
import { ANTIBIOTICS, type IsolateRecord, type Phenotype, type WardCode } from "@aei/domain";
import type { Locale } from "@aei/i18n";
import { kindOf, type SignalKind } from "../board.ts";

// Pure helpers of the signal feed: grouping alerts into incidents, filtering,
// matching isolates to an incident (spec-research.md, "SignalFeed").

export interface Incident {
  /** `alert.incident`, or the alert id when the alert has none. */
  key: string;
  kind: SignalKind;
  /** Members, newest first. */
  members: Alert[];
  /** The newest member; names the incident. */
  lead: Alert;
  date: string;
  firstDate: string;
  ward: WardCode | null;
  phenotypes: Phenotype[];
}

export const DAY = 86_400_000;
export const shift = (iso: string, days: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / DAY);

function phenotypesOf(alert: Alert): Phenotype[] {
  if (alert.kind === "cpe") return ["cpe"];
  if ("phenotype" in alert && alert.phenotype) return [alert.phenotype];
  return [];
}

/** Incidents newest first. Carriers are never pushed (D-034). */
export function groupIncidents(alerts: readonly Alert[]): Incident[] {
  const groups = new Map<string, Alert[]>();
  for (const a of alerts) {
    if (kindOf(a) === null) continue;
    const key = a.incident ?? a.id;
    groups.set(key, [...(groups.get(key) ?? []), a]);
  }
  const out: Incident[] = [];
  for (const [key, list] of groups) {
    const members = [...list].sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
    const lead = members[0] as Alert;
    const kind = kindOf(lead);
    if (!kind) continue;
    const phenotypes = [...new Set(members.flatMap(phenotypesOf))];
    out.push({
      key,
      kind,
      members,
      lead,
      date: lead.date,
      firstDate: (members[members.length - 1] as Alert).date,
      ward: lead.ward,
      phenotypes,
    });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date) || a.key.localeCompare(b.key));
}

export interface Filters {
  unit: WardCode | null;
  kinds: readonly SignalKind[];
  phenotype: Phenotype | null;
}

/** Which dimensions to apply; the chip counts leave out their own dimension. */
export function applyFilters(incidents: readonly Incident[], f: Filters, skip?: "unit" | "kind" | "phenotype"): Incident[] {
  return incidents.filter(
    (i) =>
      (skip === "unit" || !f.unit || i.ward === f.unit) &&
      (skip === "kind" || f.kinds.length === 0 || f.kinds.includes(i.kind)) &&
      (skip === "phenotype" || !f.phenotype || i.phenotypes.includes(f.phenotype)),
  );
}

/** 28 days before the oldest member up to the newest, the window of the isolates behind an incident. */
export function windowOf(i: Incident): { from: string; to: string } {
  return { from: shift(i.firstDate, -28), to: i.date };
}

const LETTERS = ANTIBIOTICS.map((a) => a.code);

/** True when the record's S/R results equal the profile string ("." = untested). */
export function matchesProfile(r: IsolateRecord, profile: string): boolean {
  if (profile.length !== LETTERS.length) return false;
  return LETTERS.every((code, k) => {
    const c = profile[k];
    const got = r.results[code];
    return c === "." ? got === undefined : got === c;
  });
}

export function isolatesBehind(i: Incident, records: readonly IsolateRecord[]): IsolateRecord[] {
  return records
    .filter((r) =>
      i.members.some((a) => {
        if ("isolateId" in a && a.isolateId === r.isolateId) return true;
        if (a.kind === "detector") {
          if (a.profile) return (!a.organism || a.organism === r.organism) && matchesProfile(r, a.profile);
          if (a.phenotype) return r.phenotypes.includes(a.phenotype);
        }
        return false;
      }),
    )
    .sort((a, b) => b.sampleDate.localeCompare(a.sampleDate) || a.isolateId.localeCompare(b.isolateId));
}

export function resultString(r: IsolateRecord): string {
  return LETTERS.map((c) => r.results[c] ?? ".").join("");
}

export function stayDay(r: IsolateRecord): number | null {
  return r.admissionDate ? daysBetween(r.admissionDate, r.sampleDate) + 1 : null;
}

/** "< 0,001" under a thousandth, else three significant figures in plain decimal, in the locale's separator. */
export function formatP(locale: Locale, p: number): string {
  if (p < 0.001) return `< ${numberFormat(locale, { minimumFractionDigits: 3 }).format(0.001)}`;
  return `= ${numberFormat(locale, { maximumSignificantDigits: 3 }).format(p)}`;
}

const numberFormat = (locale: Locale, o: Intl.NumberFormatOptions) => new Intl.NumberFormat(locale === "fi" ? "fi-FI" : "en-GB", o);

/** One decimal, with the locale's decimal sign. */
export const oneDecimal = (locale: Locale, n: number): string =>
  numberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n);
