import type { Alert } from "@aei/contract";
import { ANTIBIOTICS } from "@aei/domain";
import { antibioticName, type Locale, phenotypeName, t, wardName } from "@aei/i18n";
import type { SignalKind } from "../board.ts";
import type { Incident } from "./model.ts";

// One voice for a signal (signals-redesign.md §2.1): the strip tile, the list row and the
// card all show `signalTitle`, "{kind in plain words} · {what} · {unit}", and under it
// `measureLine`, the one measure in the alert's own unit. The engine's kind ids stay in code.

const KIND_LABEL = {
  sentinel: "feedKindSentinel",
  cluster: "feedKindCluster",
  trend: "feedKindTrend",
  divergence: "feedKindDivergence",
  data: "feedKindData",
} as const;

/** The kind in plain words: "Cluster", "New carrier", "Rising", "Sampling gap". */
export const kindLabel = (locale: Locale, kind: SignalKind) => t(locale, KIND_LABEL[kind]);

export function unitLabel(locale: Locale, ward: string | null): string {
  return ward ? wardName(locale, ward as never) : t(locale, "hospitalWide");
}

/** The unit as the title's last part: the ward's name, or "hospital" for a hospital-wide signal. */
const unitPart = (locale: Locale, ward: string | null) => (ward ? wardName(locale, ward as never) : t(locale, "feedUnitHospital"));

/** What the alert is about, without the kind and the unit: "ESBL", "MRSA", "rare Escherichia coli profile"; empty for a sampling gap. */
export function shortTitle(locale: Locale, a: Alert): string {
  switch (a.kind) {
    case "cpe":
      return `CPE ${a.organism}`;
    case "new-in-unit":
      // MRSA names its organism; VRE and the rest do not.
      return a.phenotype === "mrsa" ? phenotypeName(a.phenotype) : `${phenotypeName(a.phenotype)} ${a.organism}`;
    case "carrier":
      return "";
    case "detector":
      if (a.detector === "sampling-drop" || a.detector === "volume-jump" || a.detector === "empty-run") return "";
      if (a.detector === "rising-trend" || a.detector === "resistance-shift")
        return t(locale, "feedTrendWhat", {
          antibiotic: a.antibiotic ? antibioticName(locale, a.antibiotic) : "",
          organism: a.organism ?? "",
        });
      if (a.phenotype) return [phenotypeName(a.phenotype), a.organism].filter(Boolean).join(" ");
      return a.profile ? t(locale, "feedRareProfile", { organism: a.organism ?? "" }) : (a.organism ?? "");
  }
}

/** The one title every surface shows: "Cluster · ESBL · Internal medicine A", "Sampling gap · Health centre South". */
export function signalTitle(locale: Locale, kind: SignalKind, a: Alert): string {
  return [kindLabel(locale, kind), shortTitle(locale, a), unitPart(locale, a.ward)].filter(Boolean).join(" · ");
}

/** The one measure under the title, in the alert's own unit: "7 patients · usual 1.4", "0 cultures · usual 52", "1 patient", "15 % → 20 %". */
export function measureLine(locale: Locale, a: Alert): string {
  if (a.kind !== "detector") return t(locale, "feedEvidenceOne");
  const pct = (x: number) => `${Math.round(x * 100)} %`;
  const usual = a.expected === undefined ? "" : atMostOneDecimal(locale, a.expected);
  switch (a.detector) {
    case "rising-trend":
      return a.expected === undefined ? pct(a.observed) : `${pct(a.expected)} → ${pct(a.observed)}`;
    case "sampling-drop":
    case "volume-jump":
      return t(locale, "feedMeasureCultures", { observed: a.observed, expected: usual });
    case "resistance-shift":
      return t(locale, "detMeasureShift", { observed: a.observed, expected: usual });
    case "empty-run":
      return t(locale, "feedMeasureEmptyRun", { observed: a.observed, expected: usual });
    default:
      return a.observed === 1 && a.expected === undefined
        ? t(locale, "feedEvidenceOne")
        : t(locale, "feedEvidenceShort", { observed: a.observed, expected: usual });
  }
}

/** "52", "1.4", "0.2": whole numbers stay whole, the rest keep one decimal. */
const atMostOneDecimal = (locale: Locale, n: number) =>
  new Intl.NumberFormat(locale === "fi" ? "fi-FI" : "en-GB", { maximumFractionDigits: 1 }).format(n);

/** −log10 p of a detector alert; null for rules (no p). A p of 0 reads as the cap. */
export function surpriseOf(a: Alert): number | null {
  if (a.kind !== "detector" || a.p === undefined) return null;
  return a.p <= 0 ? 6 : -Math.log10(a.p);
}

/** The incident's bar: 1 for sentinels, else the strongest member's −log10 p over 6; null if none. */
export function surpriseShare(i: Incident): number | null {
  if (i.kind === "sentinel") return 1;
  const s = i.members.map(surpriseOf).filter((x): x is number => x !== null);
  return s.length === 0 ? null : Math.min(Math.max(...s), 6) / 6;
}

/** The drugs a profile string ("RSS.RR.SRRS..", one character per antibiotic in the domain's order) marks resistant. */
export function resistantFromProfile(locale: Locale, profile: string): string[] {
  return ANTIBIOTICS.filter((_, i) => profile[i] === "R").map((a) => antibioticName(locale, a.code));
}
