import type { Named } from "../feed/types.ts";
import { alerts } from "./messages/alerts.ts";
import { common } from "./messages/common.ts";
import { report } from "./messages/report.ts";
import { timeline } from "./messages/timeline.ts";
import { treat } from "./messages/treat.ts";

// Finnish and English. UI copy lives in messages/<area>.ts; names of units,
// antibiotics and specimens come from the feed (Named), never from here.

export type Locale = "fi" | "en";
export const LOCALES: readonly Locale[] = ["fi", "en"];

const en = { ...common.en, ...treat.en, ...alerts.en, ...report.en, ...timeline.en };
const fi = { ...common.fi, ...treat.fi, ...alerts.fi, ...report.fi, ...timeline.fi };
export type MessageKey = keyof typeof en;
const catalogs: Record<Locale, Record<MessageKey, string>> = { en, fi };

/** A message with `{name}` placeholders filled. */
export function t(locale: Locale, key: MessageKey, vars?: Record<string, string | number>): string {
  const template: string = catalogs[locale][key] ?? en[key] ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`));
}

/** The name of a unit, antibiotic or specimen from the feed, in the chosen language. */
export function named(locale: Locale, item: Named | undefined, fallback = ""): string {
  return item ? item[locale] || item.en || item.code : fallback;
}

const tag = (locale: Locale) => (locale === "fi" ? "fi-FI" : "en-GB");

export function formatDate(locale: Locale, iso: string, style: "short" | "long" = "short"): string {
  return new Intl.DateTimeFormat(tag(locale), {
    timeZone: "UTC",
    day: "numeric",
    month: style === "long" ? "long" : "short",
    ...(style === "long" ? { year: "numeric" } : {}),
  }).format(new Date(`${iso}T00:00:00Z`));
}

export function formatMonth(locale: Locale, iso: string, withYear = true): string {
  return new Intl.DateTimeFormat(tag(locale), { timeZone: "UTC", month: "short", ...(withYear ? { year: "numeric" } : {}) }).format(
    new Date(`${iso}T00:00:00Z`),
  );
}

export function formatNumber(locale: Locale, value: number, digits = 0): string {
  return new Intl.NumberFormat(tag(locale), { maximumFractionDigits: digits }).format(value);
}

/** 0.873 -> "87 %" (fi) / "87%" (en). */
export function formatShare(locale: Locale, share: number): string {
  return new Intl.NumberFormat(tag(locale), { style: "percent", maximumFractionDigits: 0 }).format(share);
}
