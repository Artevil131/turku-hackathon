import type { Alert } from "@aei/contract";
import { type IsolateRecord, PHENOTYPES, type Phenotype } from "@aei/domain";
import type { Finding } from "../../live.ts";
import { KINDS, kindOf, type SignalKind } from "../research/board.ts";

// What changed on the replay day, and what is open, computed only from the
// data the app already holds. Nothing here estimates or fills a gap.

const DAY = 86_400_000;
const shift = (iso: string, days: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);

/** The id the board opens for an alert: its incident, else its own id (the board's `inc` param). */
export const incidentOf = (a: Alert): string => a.incident ?? a.id;

export interface KindChange {
  kind: SignalKind;
  count: number;
  /** The incident to open for this kind. */
  incident: string;
}

export interface Changes {
  asOf: string;
  /** Isolates dated the as-of day; null when the app has no record list. */
  isolates: number | null;
  finds: { phenotype: Phenotype; count: number }[];
  alerts: KindChange[];
  total: number;
}

export function changesOn(asOf: string, findings: Finding[], alerts: Alert[], records: IsolateRecord[] | undefined): Changes {
  const finds = PHENOTYPES.map((phenotype) => ({
    phenotype,
    count: findings.filter((f) => f.phenotype === phenotype && f.arrivedAt === asOf).length,
  })).filter((f) => f.count > 0);

  const byKind = new Map<SignalKind, { ids: Set<string>; first: string }>();
  for (const a of alerts) {
    if (a.date !== asOf) continue;
    const kind = kindOf(a);
    if (!kind) continue;
    const entry = byKind.get(kind) ?? { ids: new Set<string>(), first: incidentOf(a) };
    entry.ids.add(incidentOf(a));
    byKind.set(kind, entry);
  }
  const kinds = KINDS.filter((k) => byKind.has(k)).map((kind) => {
    const e = byKind.get(kind);
    return { kind, count: e?.ids.size ?? 0, incident: e?.first ?? "" };
  });

  const isolates = records ? records.filter((r) => r.sampleDate === asOf).length : null;
  const total = (isolates ?? 0) + finds.reduce((n, f) => n + f.count, 0) + kinds.reduce((n, k) => n + k.count, 0);
  return { asOf, isolates, finds, alerts: kinds, total };
}

/** Open signals of the last 28 days: distinct incidents of the five kinds (carrier notes are not signals). */
export function openSignals(asOf: string, alerts: Alert[]): number {
  const from = shift(asOf, -27);
  const ids = new Set<string>();
  for (const a of alerts) if (a.date >= from && a.date <= asOf && kindOf(a)) ids.add(incidentOf(a));
  return ids.size;
}
