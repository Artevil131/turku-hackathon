import type { Alert } from "@aei/contract";
import type { WardCode } from "@aei/domain";
import { formatDate, type Locale, phenotypeName, t } from "@aei/i18n";

/** A released alert that bears on the doctor's unit: in it, or in one of the units that send it patients. */
export interface UnitSignal {
  alert: Alert;
  /** The unit it was raised in, when that is a feeding unit rather than the doctor's own. */
  feeder: WardCode | null;
  label: string;
}

const DETECTOR_LABELS = {
  "profile-excess": "alertProfileExcess",
  "phenotype-excess": "alertPhenotypeExcess",
  "sampling-drop": "alertSamplingDrop",
  "empty-run": "alertEmptyRun",
  "rising-trend": "alertRisingTrend",
} as const;

export function signalLabel(alert: Alert, locale: Locale): string {
  switch (alert.kind) {
    case "cpe":
      return t(locale, "alertCpe");
    case "carrier":
      return t(locale, "alertCarrier", { phenotype: phenotypeName(alert.phenotype) });
    case "new-in-unit":
      return t(locale, "alertNewInUnit", { phenotype: phenotypeName(alert.phenotype) });
    case "detector": {
      const key = DETECTOR_LABELS[alert.detector as keyof typeof DETECTOR_LABELS] ?? "alertDetector";
      const what = alert.phenotype ? phenotypeName(alert.phenotype) : (alert.organism ?? "");
      const label = t(locale, key, { phenotype: what });
      return alert.organism && key !== "alertPhenotypeExcess" ? `${label} · ${alert.organism}` : label;
    }
    default:
      return (alert as { kind: string }).kind;
  }
}

export function unitSignals(alerts: Alert[], unit: WardCode, feeders: readonly WardCode[], locale: Locale): UnitSignal[] {
  return alerts
    .filter((a) => a.ward === unit || (a.ward !== null && feeders.includes(a.ward)))
    .map((alert) => ({ alert, feeder: alert.ward === unit ? null : alert.ward, label: signalLabel(alert, locale) }));
}

export const signalDate = (locale: Locale, s: UnitSignal): string => formatDate(locale, s.alert.date);
