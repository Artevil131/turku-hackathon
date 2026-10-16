import type { Alert } from "@aei/contract";
import { ANTIBIOTICS, ORGANISMS, PHENOTYPES, WARDS } from "@aei/domain";
import { formatDate, type Locale, type MessageKey, phenotypeName, t, wardName } from "@aei/i18n";
import { signalLabel } from "../doctor/signals.ts";

// What the search field can reach, and how a typed query ranks it. Pure: no
// DOM, no state. Matching ignores case and diacritics ("paivystys" finds
// "Päivystys") and searches both languages and the codes at once.

export type Group = "units" | "antibiotics" | "organisms" | "phenotypes" | "alerts" | "pages";

export interface Entry {
  id: string;
  group: Group;
  label: string;
  sub: string;
  /** The hash to go to, with the leading `#`. */
  href: string;
  /** Normalised strings the query is matched against. */
  terms: string[];
}

export interface Result extends Entry {
  score: number;
}

export const ALERT_DAYS = 28;
export const MAX_RESULTS = 8;
const GROUP_CAP: Record<Group, number> = { units: 4, antibiotics: 3, organisms: 3, phenotypes: 2, alerts: 4, pages: 4 };
const LOCALES: readonly Locale[] = ["fi", "en"];

/** Lower case, accents and other combining marks removed (NFD, then drop the marks). */
export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .trim();
}

const norm = (list: string[]) => list.map(normalize);

function shiftDay(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const both = (key: MessageKey, vars?: Record<string, string | number>) => LOCALES.map((l) => t(l, key, vars));

const PH_NAME: Record<(typeof PHENOTYPES)[number], MessageKey> = { esbl: "cmdPhEsbl", mrsa: "cmdPhMrsa", vre: "cmdPhVre", cpe: "cmdPhCpe" };

/** Pages and panels the field can open. Home is the logo's job. */
const PAGES: { id: string; label: MessageKey; href: string; also?: MessageKey }[] = [
  { id: "doctor", label: "roleDoctor", href: "#doctor" },
  { id: "research", label: "roleResearch", href: "#research" },
  { id: "map", label: "boardMap", href: "#research?panel=map" },
  { id: "network", label: "boardNetwork", href: "#research?panel=network", also: "network" },
  { id: "grid", label: "boardGrid", href: "#research?panel=grid" },
  { id: "intro", label: "cmdPageIntro", href: "#intro" },
  { id: "settings", label: "settings", href: "#settings" },
];

/** Alerts of the last 28 days up to the as-of date, one per incident (its newest), newest first. */
export function recentAlerts(alerts: readonly Alert[], asOf: string | null): Alert[] {
  if (!asOf) return [];
  const from = shiftDay(asOf, 1 - ALERT_DAYS);
  const byIncident = new Map<string, Alert>();
  for (const a of alerts) {
    if (a.date < from || a.date > asOf) continue;
    const key = a.incident ?? a.id;
    const seen = byIncident.get(key);
    if (!seen || a.date > seen.date) byIncident.set(key, a);
  }
  return [...byIncident.values()].sort((a, b) => (a.date === b.date ? a.id.localeCompare(b.id) : a.date < b.date ? 1 : -1));
}

export function buildEntries(locale: Locale, alerts: readonly Alert[], asOf: string | null): Entry[] {
  const out: Entry[] = [];

  for (const w of WARDS) {
    const unit = wardName(locale, w.code);
    const names = [w.code, w.fi, w.en];
    out.push({
      id: `doctor:${w.code}`,
      group: "units",
      label: t(locale, "cmdDoctorFor", { unit }),
      sub: t(locale, "cmdDoctorForSub"),
      href: `#doctor?unit=${w.code}`,
      terms: norm([...names, t("fi", "cmdDoctorFor", { unit: w.fi }), t("en", "cmdDoctorFor", { unit: w.en })]),
    });
    out.push({
      id: `signals:${w.code}`,
      group: "units",
      label: t(locale, "cmdSignalsIn", { unit }),
      sub: t(locale, "cmdSignalsInSub"),
      href: `#research?unit=${w.code}`,
      terms: norm([...names, t("fi", "cmdSignalsIn", { unit: w.fi }), t("en", "cmdSignalsIn", { unit: w.en })]),
    });
  }

  for (const a of ANTIBIOTICS) {
    out.push({
      id: `ab:${a.code}`,
      group: "antibiotics",
      label: `${a[locale]} (${a.code})`,
      sub: t(locale, "cmdAbSub"),
      href: "#doctor",
      terms: norm([a.code, a.fi, a.en, a.class]),
    });
  }

  for (const o of ORGANISMS) {
    const [genus = "", species = ""] = o.split(" ");
    const initial = genus.charAt(0);
    out.push({
      id: `org:${o}`,
      group: "organisms",
      label: o,
      sub: t(locale, "cmdOrgSub"),
      href: "#doctor",
      terms: norm([o, `${initial}. ${species}`, `${initial}.${species}`, `${initial}${species}`]),
    });
  }

  for (const p of PHENOTYPES) {
    out.push({
      id: `ph:${p}`,
      group: "phenotypes",
      label: `${phenotypeName(p)}, ${t(locale, PH_NAME[p])}`,
      sub: t(locale, "cmdPhSub"),
      href: `#research?ph=${p}`,
      terms: norm([p, ...both(PH_NAME[p])]),
    });
  }

  for (const a of recentAlerts(alerts, asOf)) {
    const unit = a.ward ? wardName(locale, a.ward) : t(locale, "hospitalWide");
    out.push({
      id: `alert:${a.id}`,
      group: "alerts",
      label: t(locale, "cmdAlertTitle", { kind: signalLabel(a, locale), unit, date: formatDate(locale, a.date) }),
      sub: t(locale, "cmdAlertSub"),
      href: `#research?inc=${encodeURIComponent(a.incident ?? a.id)}`,
      terms: norm([
        signalLabel(a, "fi"),
        signalLabel(a, "en"),
        a.ward ?? "",
        a.ward ? wardName("fi", a.ward) : "",
        a.ward ? wardName("en", a.ward) : "",
        a.date,
        formatDate("fi", a.date),
        formatDate("en", a.date),
        "alert",
        "hälytys",
        "signal",
        "signaali",
      ]),
    });
  }

  for (const p of PAGES) {
    out.push({
      id: `page:${p.id}`,
      group: "pages",
      label: t(locale, p.label),
      sub: t(locale, "cmdPageSub"),
      href: p.href,
      terms: norm([...both(p.label), ...(p.also ? both(p.also) : [])]),
    });
  }
  return out;
}

const words = (s: string) => s.split(/[^a-z0-9]+/).filter(Boolean);

/** How well one query token fits one term: exact, start of the term, start of a word in it, or inside it. */
function tokenScore(term: string, token: string): number {
  if (term === token) return 100;
  if (term.startsWith(token)) return 80;
  if (words(term).some((w) => w.startsWith(token))) return 60;
  // an infix match is a weak hint: it must never outrank a prefix match
  if (term.includes(token)) return 10;
  return 0;
}

/** Every token must fit some term; the score is the sum of each token's best fit. 0 means no match. */
export function scoreEntry(entry: Entry, tokens: string[]): number {
  let total = 0;
  for (const token of tokens) {
    let best = 0;
    for (const term of entry.terms) best = Math.max(best, tokenScore(term, token));
    if (best === 0) return 0;
    total += best;
  }
  return total;
}

/**
 * The results for a query, grouped (a group per kind, best group first, each
 * group capped), at most `MAX_RESULTS` in all. With no query it offers the
 * newest alerts and the main pages.
 */
export function search(entries: readonly Entry[], query: string, limit = MAX_RESULTS): Result[] {
  const tokens = normalize(query).split(/\s+/).filter(Boolean);
  let scored: Result[];
  if (tokens.length === 0) {
    const alerts = entries.filter((e) => e.group === "alerts").slice(0, 3);
    const pages = entries.filter((e) => e.group === "pages");
    scored = [...alerts, ...pages].map((e) => ({ ...e, score: 1 }));
    const cap = { ...GROUP_CAP, alerts: 3, pages: limit - alerts.length };
    return pick(scored, cap, limit, false);
  }
  scored = [];
  for (const e of entries) {
    const score = scoreEntry(e, tokens);
    if (score > 0) scored.push({ ...e, score });
  }
  return pick(scored, GROUP_CAP, limit, true);
}

function pick(scored: Result[], cap: Record<Group, number>, limit: number, byScore: boolean): Result[] {
  const groups = new Map<Group, Result[]>();
  for (const r of scored) groups.set(r.group, [...(groups.get(r.group) ?? []), r]);
  const ordered = [...groups.entries()].map(([group, list]) => {
    // sort is stable, so equal scores keep their listed order (alerts newest first)
    const sorted = byScore ? [...list].sort((a, b) => b.score - a.score) : list;
    return { group, list: sorted.slice(0, cap[group]), top: sorted[0]?.score ?? 0 };
  });
  if (byScore) ordered.sort((a, b) => b.top - a.top);
  return ordered.flatMap((g) => g.list).slice(0, limit);
}
