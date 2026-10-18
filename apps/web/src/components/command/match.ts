import type { Alert } from "@aei/contract";
import { ANTIBIOTICS, ORGANISMS, PHENOTYPES, SPECIMENS } from "@aei/domain";
import { guide, syndromeDefaults } from "@aei/guideline";
import { formatDate, type Locale, type MessageKey, phenotypeName, specimenName, t, wardName } from "@aei/i18n";
import { allWards, inSite, isMulti } from "../../sites.ts";
import { hashParams } from "../../url.ts";
import { signalLabel } from "../doctor/signals.ts";

// What the search field can reach, and how a typed query ranks it. Pure: no
// DOM, no state. Matching ignores case and diacritics ("paivystys" finds
// "Päivystys") and searches both languages and the codes at once.

export type Group = "units" | "antibiotics" | "organisms" | "phenotypes" | "alerts" | "pages" | "queries";

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
const GROUP_CAP: Record<Group, number> = { units: 4, antibiotics: 3, organisms: 3, phenotypes: 2, alerts: 4, pages: 4, queries: 2 };
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

  for (const w of allWards()) {
    const unit = wardName(locale, w.code);
    const names = [w.code, w.fi, w.en];
    out.push({
      id: `doctor:${w.code}`,
      group: "units",
      label: t(locale, "cmdDoctorFor", { unit }),
      sub: t(locale, "cmdDoctorForSub"),
      href: `#doctor?unit=${encodeURIComponent(w.code)}${isMulti() ? `&hospital=${w.site}` : ""}`,
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
      href: `#doctor?ab=${a.code}`,
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
      href: `#doctor?org=${encodeURIComponent(o)}`,
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
  // "in" must not read as "infection": a word inside a term needs three letters of the token
  if (token.length >= 3 && words(term).some((w) => w.startsWith(token))) return 60;
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
/** Words a question carries that name nothing: "e. coli in urology", "what works for icu sepsis". Dropped before matching when anything else remains. */
const CONNECTORS = new Set([
  ...["in", "on", "at", "for", "with", "from", "and", "or", "vs", "of", "the", "a", "an", "to", "is", "my"],
  ...["ward", "unit", "patient", "what", "works", "best", "drug", "treat", "treatment", "cases", "rising"],
  ...["ja", "tai", "osasto", "osastolla", "osastolle", "potilas", "potilaalle", "mikä", "mitä", "toimii", "paras", "lääke", "hoito"],
]);

export function search(entries: readonly Entry[], query: string, limit = MAX_RESULTS, locale: Locale = "en"): Result[] {
  const typed = normalize(query).split(/\s+/).filter(Boolean);
  const meaningful = typed.filter((tok) => !CONNECTORS.has(tok));
  const tokens = meaningful.length > 0 ? meaningful : typed;
  let scored: Result[];
  if (tokens.length === 0) {
    const alerts = entries.filter((e) => e.group === "alerts").slice(0, 3);
    const pages = entries.filter((e) => e.group === "pages");
    scored = [...alerts, ...pages].map((e) => ({ ...e, score: 1 }));
    const cap = { ...GROUP_CAP, alerts: 3, pages: limit - alerts.length };
    return pick(scored, cap, limit, false);
  }
  scored = [];
  for (const q of compoundQueries(tokens, locale)) scored.push(q);
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

// Compound queries: "urology e. coli", "icu blood severe". Each token is
// classified on its own (unit, specimen, syndrome, severity, phenotype,
// organism, antibiotic); when all are understood the field offers a deep link
// that opens the right view pre-filled.

export type Facet = "unit" | "site" | "syn" | "sev" | "ph" | "org" | "ab";

export interface Classified {
  facet: Facet;
  value: string;
  score: number;
}

/** A token must fit at least the start of a word to count as understood. */
const MIN_CLASS_SCORE = 60;
const SEVERE_WORDS = ["severe", "sepsis", "vaikea"];
const QUERY_SCORE = 1000;

interface Candidate {
  value: string;
  terms: string[];
  /** Ties are broken in favour of the lowest rank; equal ranks make the token ambiguous. */
  rank?: number;
}

function bestOf(token: string, list: readonly Candidate[]): { value: string; score: number } | null {
  let best = 0;
  let winners: Candidate[] = [];
  for (const c of list) {
    const score = Math.max(0, ...c.terms.map((term) => tokenScore(term, token)));
    if (score > best) {
      best = score;
      winners = [c];
    } else if (score === best && score > 0) winners.push(c);
  }
  if (best < MIN_CLASS_SCORE) return null;
  const rank = Math.min(...winners.map((w) => w.rank ?? 0));
  const top = winners.filter((w) => (w.rank ?? 0) === rank);
  const first = top[0];
  return top.length === 1 && first ? { value: first.value, score: best } : null;
}

let tables: Record<Exclude<Facet, "sev">, Candidate[]> | null = null;
function lookup() {
  tables ??= {
    unit: [],
    site: SPECIMENS.map((x) => ({ value: x.code, terms: norm([x.code, x.fi, x.en]) })),
    syn: guide().syndromes.map((x) => ({ value: x.id, terms: norm([x.id, x.name.fi, x.name.en]), rank: x.id.length })),
    ph: PHENOTYPES.map((p) => ({ value: p, terms: norm([p, ...both(PH_NAME[p])]) })),
    org: ORGANISMS.map((o, rank) => {
      const [genus = "", species = ""] = o.split(" ");
      const i = genus.charAt(0);
      return { value: o, terms: norm([o, `${i}.${species}`, `${i}${species}`]), rank };
    }),
    ab: ANTIBIOTICS.map((a) => ({ value: a.code, terms: norm([a.code, a.fi, a.en, a.class]) })),
  };
  // Units are read on every query: with several hospitals two wards share a name ("Urology"), and the selected
  // hospital's ward wins the tie instead of making the word ambiguous.
  tables.unit = allWards().map((w) => ({ value: w.code, terms: norm([w.code, w.fi, w.en]), rank: inSite(w.code) ? 0 : 1 }));
  return tables;
}

/** Joins an abbreviated genus with its species: "e. coli" becomes "e.coli". */
function joinSpecies(tokens: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i] as string;
    const next = tokens[i + 1];
    if (/^[a-z]\.$/.test(tok) && next) {
      out.push(tok + next);
      i++;
    } else out.push(tok);
  }
  return out;
}

/** The best reading of each token, or null for the whole query when one token is not understood. */
export function classifyTokens(tokens: string[]): Classified[] | null {
  const parts = joinSpecies(tokens);
  const out: Classified[] = [];
  for (const token of parts) {
    let best: Classified | null = null;
    const consider = (c: Classified | null) => {
      if (c && (!best || c.score > best.score)) best = c;
    };
    const t = lookup();
    // the order is the tie-break: unit, specimen, syndrome, severity, phenotype, organism, antibiotic
    for (const facet of ["unit", "site", "syn"] as const) {
      const hit = bestOf(token, t[facet]);
      consider(hit && { facet, ...hit });
    }
    const sevScore = Math.max(...SEVERE_WORDS.map((w) => tokenScore(w, token)));
    if (sevScore >= MIN_CLASS_SCORE) consider({ facet: "sev", value: "severe", score: sevScore });
    for (const facet of ["ph", "org", "ab"] as const) {
      const hit = bestOf(token, t[facet]);
      consider(hit && { facet, ...hit });
    }
    if (!best) return null;
    out.push(best);
  }
  return out;
}

/** The unit the user is looking at, from the URL hash, when the query names none. */
function currentUnit(): string | null {
  if (typeof location === "undefined") return null;
  const p = hashParams();
  const code = p.get("unit") ?? p.get("cov.unit");
  return allWards().some((w) => w.code === code) ? code : null;
}

function compoundQueries(tokens: string[], locale: Locale): Result[] {
  const classes = classifyTokens(tokens);
  if (!classes?.length) return [];
  const get = (f: Facet) => classes.find((c) => c.facet === f)?.value;
  const facets = new Set(classes.map((c) => c.facet));
  const single = classes.length === 1 ? classes[0] : undefined;
  if (facets.size < 2 && !(single && (single.facet === "ab" || single.facet === "org"))) return [];

  const explicitUnit = get("unit");
  const unit = explicitUnit ?? (single ? null : currentUnit());
  const syn = get("syn");
  const synDef = syn ? guide().syndromes.find((x) => x.id === syn) : undefined;
  const def = synDef ? syndromeDefaults(synDef) : null;
  const site = get("site") ?? def?.specimen;
  const sev = get("sev") ?? def?.severity;
  const ab = get("ab");
  const org = get("org");
  const ph = get("ph");
  const out: Result[] = [];
  const push = (href: string, label: string, score: number) =>
    out.push({ id: `q:${href}`, group: "queries", label, sub: t(locale, "cmdQuerySub"), href, terms: [], score });

  const unitLabel = (code: string) => wardName(locale, code);
  if (explicitUnit || get("site") || syn || get("sev") || ab || org) {
    const q = new Query();
    if (unit) q.set("unit", unit);
    if (site) q.set("site", site);
    if (syn) q.set("syn", syn);
    if (sev === "severe") q.set("sev", "severe");
    if (ab) q.set("ab", ab);
    if (org) q.set("org", org);
    const label = [
      unit ? unitLabel(unit) : null,
      site ? specimenName(locale, site as never).toLowerCase() : null,
      synDef ? synDef.name[locale] : null,
      sev === "severe" ? t(locale, "cmdSevere") : null,
      ab ? (ANTIBIOTICS.find((a) => a.code === ab)?.[locale] ?? ab) : null,
      org ?? null,
    ].filter(Boolean);
    push(`#doctor?${q.toString()}`, t(locale, "cmdQueryDoctor", { what: label.join(" · ") }), QUERY_SCORE - (ph ? 1 : 0));
  }
  if (explicitUnit || ph) {
    const q = new Query();
    if (unit) q.set("unit", unit);
    if (ph) q.set("ph", ph);
    const label = [unit ? unitLabel(unit) : null, ph ? phenotypeName(ph as never) : null].filter(Boolean);
    push(`#research?${q.toString()}`, t(locale, "cmdQuerySignals", { what: label.join(" · ") }), QUERY_SCORE - (ph ? 0 : 1));
  }
  return out;
}

/** Builds a hash query the way the entries do (spaces as %20), skipping the order problem of URLSearchParams. */
class Query {
  private parts: string[] = [];
  set(key: string, value: string) {
    this.parts.push(`${key}=${encodeURIComponent(value)}`);
  }
  toString() {
    return this.parts.join("&");
  }
}
