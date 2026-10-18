import {
  ANTIBIOTICS,
  type AntibioticCode,
  bareWardCode,
  HOME_AREAS,
  HOME_SITE,
  type Phenotype,
  type Site,
  type SiteId,
  SPECIMENS,
  type Specimen,
  WARDS,
  type Ward,
  type WardCode,
} from "@aei/domain";
import { en } from "./en.ts";
import { fi } from "./fi.ts";

export { alertEvidence, alertEvidenceShort, alertPriority, incidentPriority, incidentResponsibility, openIncidents } from "./incidents.ts";
export { GLOSS_TERMS, GLOSSARY, type GlossEntry, type GlossTerm } from "./surfaces/glossary.ts";

// UI copy in Finnish and English, plus the dataset's own names for wards,
// antibiotics and specimens. Shared by every app so wording stays the same.

export type Locale = "fi" | "en";
export type MessageKey = keyof typeof en;
export type Messages = Record<MessageKey, string>;

export const LOCALES: readonly Locale[] = ["fi", "en"];
const catalogs: Record<Locale, Messages> = { en, fi };

/** Looks up a message and fills `{name}` placeholders. */
export function t(locale: Locale, key: MessageKey, vars?: Record<string, string | number>): string {
  const template = catalogs[locale][key] ?? en[key];
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`));
}

// The ward registry names and types come from (D-051): the dataset's units until an app
// registers the server's list (`/api/meta` wards in the web, the sites file on the server).
let registry = new Map<WardCode, Ward>(WARDS.map((w) => [w.code, w]));

/** Replaces the units `wardName` and `alertPriority` know with the server's ward registry; the dataset's units stay. */
export function registerWards(wards: readonly Ward[]): void {
  registry = new Map<WardCode, Ward>([...WARDS, ...wards].map((w) => [w.code, w]));
}

let sites = new Map<SiteId, Site>([[HOME_SITE.id, HOME_SITE]]);

/** Replaces the sites `siteName` knows (the server's `/api/meta` sites); the home site stays. */
export function registerSites(list: readonly Site[]): void {
  sites = new Map<SiteId, Site>([HOME_SITE, ...list].map((s) => [s.id, s]));
}

/** A site's name, or its id when unknown. */
export function siteName(locale: Locale, id: SiteId): string {
  return sites.get(id)?.[locale] ?? id;
}

/** A registered unit, or undefined. */
export function wardInfo(code: WardCode): Ward | undefined {
  return registry.get(code);
}

/** A unit's name; an unknown unit falls back to its code without the site ("sata/CARD" is "CARD"). */
export function wardName(locale: Locale, code: WardCode): string {
  const ward = registry.get(code);
  return ward ? ward[locale] : bareWardCode(code);
}

// THL names each wellbeing services county in the genitive plus a suffix
// ("Lapin hyvinvointialue"). The table is keyed by that stem, so the full THL
// string and the bare genitive both resolve; data lookups keep the raw THL
// string and only the displayed name goes through this.
const COUNTY_NAMES: Record<string, { fi: string; en: string }> = {
  "Varsinais-Suomen": { fi: "Varsinais-Suomi", en: "Southwest Finland" },
  Satakunnan: { fi: "Satakunta", en: "Satakunta" },
  Pirkanmaan: { fi: "Pirkanmaa", en: "Pirkanmaa" },
  "Kanta-Hämeen": { fi: "Kanta-Häme", en: "Kanta-Häme" },
  "Päijät-Hämeen": { fi: "Päijät-Häme", en: "Päijät-Häme" },
  Kymenlaakson: { fi: "Kymenlaakso", en: "Kymenlaakso" },
  "Etelä-Karjalan": { fi: "Etelä-Karjala", en: "South Karelia" },
  "Etelä-Savon": { fi: "Etelä-Savo", en: "South Savo" },
  "Pohjois-Savon": { fi: "Pohjois-Savo", en: "North Savo" },
  "Pohjois-Karjalan": { fi: "Pohjois-Karjala", en: "North Karelia" },
  "Keski-Suomen": { fi: "Keski-Suomi", en: "Central Finland" },
  "Etelä-Pohjanmaan": { fi: "Etelä-Pohjanmaa", en: "South Ostrobothnia" },
  Pohjanmaan: { fi: "Pohjanmaa", en: "Ostrobothnia" },
  "Keski-Pohjanmaan": { fi: "Keski-Pohjanmaa", en: "Central Ostrobothnia" },
  "Pohjois-Pohjanmaan": { fi: "Pohjois-Pohjanmaa", en: "North Ostrobothnia" },
  Kainuun: { fi: "Kainuu", en: "Kainuu" },
  Lapin: { fi: "Lappi", en: "Lapland" },
  "Länsi-Uudenmaan": { fi: "Länsi-Uusimaa", en: "Western Uusimaa" },
  "Keski-Uudenmaan": { fi: "Keski-Uusimaa", en: "Central Uusimaa" },
  "Itä-Uudenmaan": { fi: "Itä-Uusimaa", en: "Eastern Uusimaa" },
  "Vantaan ja Keravan": { fi: "Vantaa ja Kerava", en: "Vantaa and Kerava" },
  Helsinki: { fi: "Helsinki", en: "Helsinki" },
  "Helsingin kaupunki": { fi: "Helsinki", en: "Helsinki" },
  "City of Helsinki": { fi: "Helsinki", en: "Helsinki" },
  Ahvenanmaa: { fi: "Ahvenanmaa", en: "Åland" },
  "Finland (all counties)": { fi: "Suomi (kaikki alueet)", en: "Finland (all counties)" },
};

/** A THL region string as a county name in the reader's language (nominative). Unknown strings lose the suffix only. */
export function countyName(locale: Locale, region: string): string {
  const stem = region.replace(/ hyvinvointialue$/, "");
  const known = COUNTY_NAMES[stem];
  return known ? known[locale] : stem;
}

export function antibioticName(locale: Locale, code: AntibioticCode): string {
  const ab = ANTIBIOTICS.find((a) => a.code === code);
  return ab ? ab[locale] : code;
}

export function specimenName(locale: Locale, code: Specimen): string {
  const s = SPECIMENS.find((x) => x.code === code);
  return s ? s[locale] : code;
}

export function homeAreaName(locale: Locale, code: string): string {
  const area = HOME_AREAS.find((a) => a.code === code);
  return area ? area[locale] : code;
}

export function phenotypeName(code: Phenotype): string {
  return code.toUpperCase();
}

// Building an Intl formatter costs far more than using one, and lists and charts format hundreds of values per
// render, so each formatter is made once per locale and style.
const formatters = new Map<string, Intl.DateTimeFormat | Intl.NumberFormat>();
function cached<F extends Intl.DateTimeFormat | Intl.NumberFormat>(key: string, make: () => F): F {
  let f = formatters.get(key);
  if (!f) {
    f = make();
    formatters.set(key, f);
  }
  return f as F;
}

export function formatDate(locale: Locale, iso: string, style: "short" | "long" = "short"): string {
  const date = new Date(`${iso}T00:00:00Z`);
  return cached(
    `date:${locale}:${style}`,
    () =>
      new Intl.DateTimeFormat(locale === "fi" ? "fi-FI" : "en-GB", {
        timeZone: "UTC",
        day: "numeric",
        month: style === "long" ? "long" : "short",
        ...(style === "long" ? { year: "numeric" } : {}),
      }),
  ).format(date);
}

/** The numeric date used in panel headers and figures: 12.5.2025 (day.month.year, no leading zeros). */
export function formatDateNumeric(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d}.${m}.${y}`;
}

export function formatPercent(locale: Locale, value: number): string {
  return cached(`percent:${locale}`, () => new Intl.NumberFormat(locale === "fi" ? "fi-FI" : "en-GB", { maximumFractionDigits: 0 })).format(
    value,
  );
}

export function formatMonth(locale: Locale, iso: string, withYear = false): string {
  return cached(
    `month:${locale}:${withYear}`,
    () =>
      new Intl.DateTimeFormat(locale === "fi" ? "fi-FI" : "en-GB", {
        timeZone: "UTC",
        month: withYear ? "long" : "short",
        ...(withYear ? { year: "numeric" } : {}),
      }),
  ).format(new Date(`${iso}T00:00:00Z`));
}
