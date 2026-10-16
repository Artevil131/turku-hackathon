import type { Alert } from "@aei/contract";
import { shortOrganism, type WardCode } from "@aei/domain";
import type { Locale, MessageKey } from "@aei/i18n";
import { t } from "@aei/i18n";
import { kindOf, type SignalKind } from "../board.ts";

// What the network panel needs from the alerts: one badge per unit, kind and
// phenotype or organism, with a count. Pure functions.

const KIND_KEY: Record<SignalKind, MessageKey> = {
  sentinel: "netKindSentinel",
  cluster: "netKindCluster",
  trend: "netKindTrend",
  divergence: "netKindDivergence",
  data: "netKindData",
};

export const kindWord = (locale: Locale, kind: SignalKind) => t(locale, KIND_KEY[kind]);

export const KIND_GLYPH: Record<SignalKind, string> = { sentinel: "▲", cluster: "●", trend: "↗", divergence: "◆", data: "!" };

/** The phenotype or organism an alert is about, or for a data problem its detector. */
export function whatOf(locale: Locale, alert: Alert): string | null {
  if (alert.kind === "carrier") return null;
  if (alert.kind === "detector" && kindOf(alert) === "data") {
    return t(locale, alert.detector === "empty-run" ? "netDetEmpty" : "netDetSampling");
  }
  if (alert.kind === "cpe") return `CPE ${shortOrganism(alert.organism)}`;
  if ("phenotype" in alert && alert.phenotype) return alert.phenotype.toUpperCase();
  if ("organism" in alert && alert.organism) return shortOrganism(alert.organism);
  return null;
}

export interface Badge {
  key: string;
  kind: SignalKind;
  text: string;
  count: number;
}

export interface UnitSignals {
  badges: Badge[];
  alerts: Alert[];
  /** At least one resistance (non-data) signal. */
  resistance: boolean;
  data: boolean;
}

export interface SignalModel {
  byUnit: Map<WardCode, UnitSignals>;
  /** Alerts with no unit (hospital-wide trends). */
  hospitalWide: number;
}

export function signalsOf(locale: Locale, alerts: readonly Alert[]): SignalModel {
  const byUnit = new Map<WardCode, UnitSignals>();
  let hospitalWide = 0;
  for (const a of alerts) {
    const kind = kindOf(a);
    if (!kind) continue;
    if (!a.ward) {
      hospitalWide++;
      continue;
    }
    const unit = byUnit.get(a.ward) ?? { badges: [], alerts: [], resistance: false, data: false };
    byUnit.set(a.ward, unit);
    unit.alerts.push(a);
    if (kind === "data") unit.data = true;
    else unit.resistance = true;
    const what = whatOf(locale, a);
    const key = `${kind}|${what ?? ""}`;
    const hit = unit.badges.find((b) => b.key === key);
    if (hit) hit.count++;
    else unit.badges.push({ key, kind, text: [kindWord(locale, kind), what].filter(Boolean).join(" · "), count: 1 });
  }
  for (const u of byUnit.values()) {
    // Resistance badges first, data problems last; stable otherwise.
    u.badges.sort((x, y) => Number(x.kind === "data") - Number(y.kind === "data"));
    u.alerts.sort((x, y) => (x.date < y.date ? 1 : x.date > y.date ? -1 : 0));
  }
  return { byUnit, hospitalWide };
}

export const badgeText = (b: Badge) => (b.count > 1 ? `${b.text} ×${b.count}` : b.text);

const round = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** One line for an alert in the focus card: kind, what, counts. */
export function alertLine(locale: Locale, a: Alert): string {
  const kind = kindOf(a);
  const head = [kind ? kindWord(locale, kind) : null, whatOf(locale, a)].filter(Boolean).join(" · ");
  if (a.kind !== "detector" || kind === "trend") return head;
  const counts =
    a.expected !== undefined
      ? t(locale, "netSignalCounts", { observed: round(a.observed), expected: round(a.expected) })
      : t(locale, "netSignalObserved", { observed: round(a.observed) });
  return `${head}: ${counts}`;
}

export const shiftDays = (iso: string, days: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
