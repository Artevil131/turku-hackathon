import type { FeedMeta, Unit } from "../feed/types.ts";
import type { AgeBand, Onset, SignalKind } from "../engine/types.ts";
import { named, t, type Locale } from "../i18n/index.ts";

/*
  Defaults and labels derived from the feed's own code lists (never hard-coded):
    defaultWard(meta)        first hospital inpatient unit, else the first unit
    defaultSpecimen(meta)    first specimen
    unitByCode(meta, code), specimenByCode(meta, code), antibioticByCode(meta, code)
    unitName / specimenName / antibioticName (locale, meta, code)   via named(); falls back to the code
    sexLabel(locale, code)   "F"/"M" -> Women/Men; any other code is shown as is
    ageLabel(locale, band), onsetLabel(locale, onset)
    signalKindLabel(locale, kind)
*/

export function defaultWard(meta: FeedMeta): string {
  const unit: Unit | undefined = meta.units.find((u) => u.institution === "hospital" && u.type === "in") ?? meta.units[0];
  return unit?.code ?? "";
}

export function defaultSpecimen(meta: FeedMeta): string {
  return meta.specimens[0]?.code ?? "";
}

export const unitByCode = (meta: FeedMeta, code: string | null | undefined) => (code ? meta.units.find((u) => u.code === code) : undefined);
export const specimenByCode = (meta: FeedMeta, code: string | null | undefined) => (code ? meta.specimens.find((s) => s.code === code) : undefined);
export const antibioticByCode = (meta: FeedMeta, code: string | null | undefined) => (code ? meta.antibiotics.find((a) => a.code === code) : undefined);

export const unitName = (locale: Locale, meta: FeedMeta, code: string) => named(locale, unitByCode(meta, code), code);
export const specimenName = (locale: Locale, meta: FeedMeta, code: string) => named(locale, specimenByCode(meta, code), code);
export const antibioticName = (locale: Locale, meta: FeedMeta, code: string) => named(locale, antibioticByCode(meta, code), code);

export function sexLabel(locale: Locale, code: string): string {
  if (code === "F") return t(locale, "common.sex.F");
  if (code === "M") return t(locale, "common.sex.M");
  return code;
}

export const ageLabel = (locale: Locale, band: AgeBand) => t(locale, band === "under65" ? "common.age.under65" : "common.age.65plus");
export const onsetLabel = (locale: Locale, onset: Onset) => t(locale, onset === "hospital" ? "common.onset.hospital" : "common.onset.community");
export const signalKindLabel = (locale: Locale, kind: SignalKind) => t(locale, `common.signal.${kind}`);
