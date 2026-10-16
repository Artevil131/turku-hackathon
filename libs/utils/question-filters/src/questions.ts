import type { AskAnswer, FeedMeta, IsoDate, Named } from "@aei/feed";
import { addDays, addMonths, isIsoDate, maxDate, type Onset, weekStart } from "@aei/isolates";

// Pure parts of the optional AI layer: plain-language question -> filters.
// The language model only picks from the code lists in FeedMeta and names a
// relative period; this code builds its prompt and answer schema from the
// meta, then checks every value it returns against the meta again and turns
// the period into dates against the feed's as-of date. The model never
// supplies a date or a figure, and nothing here assumes which units,
// specimens, organisms or antibiotics exist.

export type Lang = "fi" | "en";

/** Patient age groups the model may name. */
export type AgeGroup = "child" | "adult" | "older" | "very_old";

/** Inclusive age ranges in years (max null = no upper limit). Groups overlap: very_old is part of older. */
export const AGE_GROUPS: Record<AgeGroup, { min: number; max: number | null }> = {
  child: { min: 0, max: 17 },
  adult: { min: 18, max: 64 },
  older: { min: 65, max: null },
  very_old: { min: 80, max: null },
};

export type PeriodUnit = "day" | "week" | "month" | "year";

/**
 * A period as the question put it. last: the `count` units up to and including
 * the as-of date ("last 3 months"). this: the current calendar week, month or
 * year up to the as-of date ("this year").
 */
export interface RelativePeriod {
  kind: "last" | "this";
  count: number;
  unit: PeriodUnit;
}

/** A relative period resolved against the feed's as-of date; from and to are inclusive. */
export interface ResolvedPeriod extends RelativePeriod {
  from: IsoDate;
  to: IsoDate;
  /** True when the period reached back before the feed's first date and was cut there. */
  clamped: boolean;
}

/** What the question asks about, when it says. */
export type AiIntent = "treatment" | "signals";

/** Filters read from a question. Every code is one from FeedMeta; absent = the question did not say. */
export interface AiFilters {
  /** Unit code (FeedMeta.units). */
  ward?: string;
  /** Specimen code (FeedMeta.specimens). */
  specimen?: string;
  /** Organism name exactly as in FeedMeta.organisms. */
  organism?: string;
  /** Antibiotic code (FeedMeta.antibiotics). */
  antibiotic?: string;
  sex?: "F" | "M";
  ageGroup?: AgeGroup;
  onset?: Onset;
  period?: ResolvedPeriod;
}

export interface AiAnswer {
  filters: AiFilters;
  intent?: AiIntent;
  /** Words from the question that name something the filters could not use. */
  unmatched: string[];
}

/** Longest period accepted, per unit (about ten years). */
export const MAX_PERIOD: Record<PeriodUnit, number> = { day: 3660, week: 522, month: 120, year: 10 };

/** Questions longer than this are cut before they are sent. */
export const MAX_QUESTION_CHARS = 400;

const PERIOD_UNITS: readonly PeriodUnit[] = ["day", "week", "month", "year"];
const AGE_IDS = Object.keys(AGE_GROUPS) as AgeGroup[];
const MAX_UNMATCHED = 8;

// ---------- Answer schema ----------

/** JSON schema of the model's reply, with every list taken from the meta (constrains llama.cpp's grammar). */
export function answerSchema(meta: FeedMeta): Record<string, unknown> {
  const oneOf = (values: readonly string[]) => ({ enum: [...values, null] });
  return {
    type: "object",
    properties: {
      unit: oneOf(meta.units.map((u) => u.code)),
      specimen: oneOf(meta.specimens.map((s) => s.code)),
      organism: oneOf(meta.organisms),
      antibiotic: oneOf(meta.antibiotics.map((a) => a.code)),
      sex: oneOf(["F", "M"]),
      age: oneOf(AGE_IDS),
      onset: oneOf(["hospital", "community"]),
      period: {
        anyOf: [
          {
            type: "object",
            properties: {
              kind: { enum: ["last", "this"] },
              count: { type: "integer", minimum: 1, maximum: MAX_PERIOD.day },
              unit: { enum: [...PERIOD_UNITS] },
            },
            required: ["kind", "count", "unit"],
            additionalProperties: false,
          },
          { type: "null" },
        ],
      },
      intent: oneOf(["treatment", "signals"]),
      unmatched: { type: "array", items: { type: "string", maxLength: 60 }, maxItems: MAX_UNMATCHED },
    },
    required: ["unit", "specimen", "organism", "antibiotic", "sex", "age", "onset", "period", "intent", "unmatched"],
    additionalProperties: false,
  };
}

// ---------- Prompt ----------

const both = (item: Named) => (item.fi && item.fi !== item.en ? `${item.en} / ${item.fi}` : item.en || item.code);

/** The system prompt (English), listing the allowed values from the meta. */
export function systemPrompt(meta: FeedMeta, lang: Lang): string {
  const units = meta.units.map((u) => `${u.code} = ${both(u)} (${u.type === "in" ? "inpatient ward" : "outpatient"})`);
  const specimens = meta.specimens.map((s) => `${s.code} = ${both(s)}`);
  const antibiotics = meta.antibiotics.map((a) => `${a.code} = ${both(a)}`);
  return [
    "You turn a clinician's question about hospital laboratory results (bacteria and antibiotic susceptibility) into search filters. Reply with JSON only.",
    `The question is in ${lang === "fi" ? "Finnish" : "English"} (it may mix Finnish and English).`,
    "Set a field only when the question asks for it; otherwise null. Never guess, never add a filter the question does not mention.",
    "Finnish words are inflected or shortened: match them to the closest name (an ending such as -lla, -lle, -n, or only the first part of a compound name).",
    "A ward's name says nothing about the patients' age, sex or sample type.",
    "",
    "unit, the ward or health centre (one code):",
    ...units,
    "",
    "specimen, the sample type (one code), only when the question names a sample or an infection. An infection means the sample taken for it, if that sample is listed: urinary tract infection -> urine, bloodstream infection or sepsis -> blood, wound infection -> wound.",
    ...specimens,
    "",
    "organism (exact name; abbreviations like 'E. coli' mean the full name), only when the question names it. An organism that is not listed goes to unmatched, never to a similar one:",
    ...meta.organisms,
    "",
    "antibiotic (one code), only when the question names a drug:",
    ...antibiotics,
    "",
    "sex: F (women, girls, female, naiset, nainen) or M (men, boys, male, miehet, mies).",
    "age: child (0-17), adult (18-64), older (65 and over, elderly, iäkkäät, vanhukset), very_old (80 and over).",
    "onset: hospital (hospital-acquired, nosocomial, sairaalasyntyinen) or community (community-acquired).",
    'period: {"kind":"last","count":N,"unit":"day|week|month|year"} for "last N days/weeks/months/years", "past month", "viimeisen kuukauden aikana", "viime viikolla" (count 1 when no number is given; half a year = 6 months, a quarter = 3 months); {"kind":"this","count":1,"unit":"week|month|year"} for "this week/month/year", "tänä vuonna", "tässä kuussa"; null when no time is given, for "lately", "recently", "now", "viime aikoina", "nyt", and for a date or month name ("since March" goes to unmatched).',
    'intent: "treatment" when the question asks what works, what to give or which antibiotic (mikä tehoaa, mitä antaa); "signals" when it asks about outbreaks, clusters, spread, unusual findings or rising resistance; otherwise null.',
    "unmatched: words of the question that name a place, organism, drug, sample, group or time that is not in the lists above, copied as written. Nothing else (not filler words, not words you used).",
  ].join("\n");
}

/** Short first-letter abbreviation of a Latin name: "Escherichia coli" -> "E. coli". */
export function abbreviate(organism: string): string {
  const [genus, ...rest] = organism.split(/\s+/);
  return genus && rest.length ? `${genus[0]}. ${rest.join(" ")}` : organism;
}

/**
 * Two worked examples built from the meta itself (so they never name a value
 * the feed lacks): one in English, one in Finnish with a word that cannot be used.
 */
export function exampleTurns(meta: FeedMeta): { role: "user" | "assistant"; content: string }[] {
  const unit = meta.units[0];
  const unit2 = meta.units[1] ?? meta.units[0];
  const specimen = meta.specimens[0];
  const specimen2 = meta.specimens[1] ?? meta.specimens[0];
  const organism = meta.organisms[0];
  const empty = {
    unit: null,
    specimen: null,
    organism: null,
    antibiotic: null,
    sex: null,
    age: null,
    onset: null,
    period: null,
    intent: null,
    unmatched: [] as string[],
  };
  const turns: { role: "user" | "assistant"; content: string }[] = [];
  if (unit && specimen && organism) {
    turns.push(
      { role: "user", content: `${specimen.en} ${abbreviate(organism)} in women over 80 at ${unit.en.toLowerCase()}, last 2 weeks` },
      {
        role: "assistant",
        content: JSON.stringify({
          ...empty,
          unit: unit.code,
          specimen: specimen.code,
          organism,
          sex: "F",
          age: "very_old",
          period: { kind: "last", count: 2, unit: "week" },
        }),
      },
    );
  }
  if (unit2 && specimen2) {
    turns.push(
      {
        role: "user",
        content: `mikä tehoaa nyt? ${unit2.fi.toLowerCase()}, ${specimen2.fi.toLowerCase()}näytteet tänä vuonna, Atlantiksen sairaala`,
      },
      {
        role: "assistant",
        content: JSON.stringify({
          ...empty,
          unit: unit2.code,
          specimen: specimen2.code,
          period: { kind: "this", count: 1, unit: "year" },
          intent: "treatment",
          unmatched: ["Atlantiksen sairaala"],
        }),
      },
    );
  }
  return turns;
}

/** Messages for /v1/chat/completions. */
export function buildMessages(text: string, lang: Lang, meta: FeedMeta): { role: "system" | "user" | "assistant"; content: string }[] {
  return [{ role: "system", content: systemPrompt(meta, lang) }, ...exampleTurns(meta), { role: "user", content: cleanQuestion(text) }];
}

/** The OpenAI-compatible chat request body for one try; the two response_format spellings llama.cpp accepts. */
export function chatRequest(text: string, lang: Lang, meta: FeedMeta, model: string | null, format: 0 | 1): Record<string, unknown> {
  const schema = answerSchema(meta);
  return {
    ...(model ? { model } : {}),
    messages: buildMessages(text, lang, meta),
    temperature: 0,
    max_tokens: 400,
    stream: false,
    response_format:
      format === 0 ? { type: "json_schema", json_schema: { name: "aei_filters", strict: true, schema } } : { type: "json_object", schema },
    // Qwen3-family models think aloud unless told not to; that costs seconds and is not needed here.
    ...(model && /qwen-?3/i.test(model) ? { chat_template_kwargs: { enable_thinking: false } } : {}),
  };
}

/** Trimmed, single-spaced, at most MAX_QUESTION_CHARS. */
export function cleanQuestion(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, MAX_QUESTION_CHARS);
}

// ---------- Reading the reply ----------

/** The JSON object in the model's reply (tolerates a thinking block or code fences around it); null if none. */
export function parseReply(content: string): unknown {
  const text = content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  const candidates = [text];
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) candidates.push(text.slice(start, end + 1));
  for (const candidate of candidates) {
    try {
      const value: unknown = JSON.parse(candidate);
      if (value && typeof value === "object" && !Array.isArray(value)) return value;
    } catch {
      // try the next candidate
    }
  }
  return null;
}

const norm = (s: string) =>
  s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s._-]+/g, " ")
    .trim();

/** A Named item by code, or by its English or Finnish name (case and spacing ignored). */
export function matchNamed<T extends Named>(value: string, items: readonly T[]): T | undefined {
  const v = norm(value);
  if (!v) return undefined;
  return items.find((i) => norm(i.code) === v) ?? items.find((i) => norm(i.en) === v || norm(i.fi) === v);
}

/**
 * An organism name from the list: exact (case ignored), abbreviated
 * ("E. coli", "E.coli", "E coli"), or a genus or species word that fits exactly one.
 */
export function matchOrganism(value: string, organisms: readonly string[]): string | undefined {
  const v = norm(value);
  if (!v) return undefined;
  const exact = organisms.find((o) => norm(o) === v);
  if (exact) return exact;
  const words = v.split(" ");
  if (words.length >= 2 && words[0]!.length === 1) {
    const [initial, ...species] = words;
    const hits = organisms.filter((o) => {
      const [genus, ...rest] = norm(o).split(" ");
      return genus?.startsWith(initial!) && rest.join(" ") === species.join(" ");
    });
    if (hits.length === 1) return hits[0];
  }
  if (words.length === 1) {
    const hits = organisms.filter((o) => norm(o).split(" ").includes(v));
    if (hits.length === 1) return hits[0];
  }
  return undefined;
}

/** The period resolved against `asOf`; null when it is not a usable relative period. */
export function resolvePeriod(period: unknown, asOf: IsoDate, earliest?: IsoDate): ResolvedPeriod | null {
  if (!period || typeof period !== "object" || !isIsoDate(asOf)) return null;
  const p = period as Record<string, unknown>;
  const kind = p.kind;
  const unit = p.unit;
  if ((kind !== "last" && kind !== "this") || typeof unit !== "string" || !PERIOD_UNITS.includes(unit as PeriodUnit)) return null;
  const u = unit as PeriodUnit;
  let from: IsoDate;
  let count = 1;
  if (kind === "this") {
    if (u === "day") from = asOf;
    else if (u === "week") from = weekStart(asOf);
    else if (u === "month") from = `${asOf.slice(0, 7)}-01`;
    else from = `${asOf.slice(0, 4)}-01-01`;
  } else {
    const n = p.count;
    if (typeof n !== "number" || !Number.isInteger(n) || n < 1 || n > MAX_PERIOD[u]) return null;
    count = n;
    if (u === "day") from = addDays(asOf, -(n - 1));
    else if (u === "week") from = addDays(asOf, -(7 * n - 1));
    else from = addDays(addMonths(asOf, -(u === "month" ? n : 12 * n)), 1);
  }
  const clamped = earliest !== undefined && isIsoDate(earliest) && from < earliest;
  return { kind, count, unit: u, from: clamped ? maxDate(from, earliest!) : from, to: asOf, clamped };
}

// ---------- Grounding: is a value really in the question? ----------
//
// A small model sometimes fills a field the question never mentioned (a
// similar organism, a period from a month name, a patient group from a ward's
// name). So every filter except the unit must leave a trace in the question's
// own words: the organism or antibiotic name, a word for the period's unit
// (and its number), a word about sex, age or onset, a sample or infection
// word. A value with no trace is dropped. The unit is not checked (the model
// reads inflected Finnish ward names better than word matching does); when the
// model sets none, unitInQuestion() looks for a unit's distinctive first word.
// The word lists below are English and Finnish language, not data.

/** Lower-case letter/digit words of a text. */
export function questionWords(text: string): string[] {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/** Spelling variants so Latin and Finnish forms meet: Staphylococcus ~ stafylokokki, Citrobacter ~ sitrobakteeri. */
function variants(word: string): string[] {
  const base = word.replace(/ph/g, "f").replace(/th/g, "t").replace(/y/g, "i").replace(/ae/g, "e").replace(/x/g, "ks");
  return [...new Set([base.replace(/c/g, "k"), base.replace(/c/g, "s")])];
}

/** Same word, or both at least four letters long and alike in their first four (after spelling variants). */
function wordsMeet(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length < 4 || b.length < 4) return false;
  const va = variants(a).map((w) => w.slice(0, 4));
  return variants(b).some((w) => va.includes(w.slice(0, 4)));
}

/** The question's word that matches one of the name's words (letters only, 3+ long), if any. */
function findWord(words: readonly string[], name: string): string | undefined {
  const nameWords = questionWords(name).filter((w) => w.length >= 3 && /\p{L}/u.test(w));
  return words.find((q) => nameWords.some((n) => wordsMeet(q, n)));
}

/**
 * Whether the question names this organism: an abbreviation ("E. coli"), its
 * species word, or its genus when no other listed organism shares that genus.
 * `genusOnly` is the question's word when the genus fits several organisms.
 */
export function organismInQuestion(
  question: string,
  organism: string,
  organisms: readonly string[],
): { named: boolean; genusOnly?: string } {
  const words = questionWords(question);
  const [genus = "", ...rest] = questionWords(organism);
  const species = rest.join(" ");
  if (species) {
    const initial = genus[0] ?? "";
    const abbrev = new RegExp(`(^|[^\\p{L}])${initial}\\.?\\s*${species.replace(/\s+/g, "\\s+")}`, "iu");
    if (abbrev.test(question.normalize("NFKC"))) return { named: true };
    if (rest.some((s) => s.length >= 3 && words.some((q) => wordsMeet(q, s)))) return { named: true };
  }
  const genusWord = words.find((q) => wordsMeet(q, genus));
  if (!genusWord) return { named: false };
  const sameGenus = organisms.filter((o) => questionWords(o)[0] === genus);
  return sameGenus.length > 1 ? { named: false, genusOnly: genusWord } : { named: true };
}

// Words that show the question is about a sample type or an infection (prefixes).
const SPECIMEN_HINTS = [
  "infect",
  "infekt",
  "uti",
  "sepsi",
  "bacter",
  "bakter",
  "culture",
  "viljel",
  "sample",
  "näyt",
  "specimen",
  "cystit",
  "kystiit",
  "pyelo",
  "tulehd",
  "abscess",
  "absess",
  "absce",
];
const SEX_HINTS = [
  "men",
  "man",
  "male",
  "boy",
  "women",
  "woman",
  "female",
  "girl",
  "mies",
  "miehe",
  "miehi",
  "miest",
  "nais",
  "nain",
  "poik",
  "poja",
  "tytt",
  "tytö",
];
const AGE_HINTS = [
  "child",
  "kid",
  "paediatr",
  "pediatr",
  "infant",
  "baby",
  "newborn",
  "teen",
  "adolesc",
  "adult",
  "old",
  "older",
  "oldest",
  "elder",
  "aged",
  "senior",
  "over",
  "under",
  "laps",
  "lasten",
  "vauva",
  "nuor",
  "aikui",
  "iäk",
  "vanh",
  "ikä",
  "ikäi",
  "vuotia",
  "yli",
  "alle",
];
const ONSET_HINTS = ["hospital", "nosocom", "acquired", "community", "onset", "sairaala", "avohoi", "kotoa"];

const hinted = (words: readonly string[], hints: readonly string[]) =>
  words.some((w) => hints.some((h) => (h.length <= 3 ? w === h || w === `${h}s` : w.startsWith(h))));

/** Whether the question has a word for this kind of filter (sex, age, onset, or a sample/infection word for the specimen). */
export function fieldInQuestion(question: string, field: "specimen" | "sex" | "age" | "onset", specimen?: Named): boolean {
  const words = questionWords(question).flatMap((w) => w.match(/\p{L}+|\p{N}+/gu) ?? []);
  if (field === "sex") return hinted(words, SEX_HINTS);
  if (field === "onset") return hinted(words, ONSET_HINTS);
  if (field === "age") return hinted(words, AGE_HINTS);
  if (specimen && (words.includes(specimen.code.toLowerCase()) || findWord(words, specimen.en) || findWord(words, specimen.fi)))
    return true;
  return hinted(words, SPECIMEN_HINTS);
}

/**
 * The one unit whose distinctive first word (of its English or Finnish name,
 * shared by no other unit) or code the question uses, e.g. an inflected
 * Finnish ward name. Undefined when none or several fit.
 */
export function unitInQuestion<T extends Named>(question: string, units: readonly T[]): T | undefined {
  const words = questionWords(question);
  const firstWords = units.map((u) => [u.en, u.fi].map((n) => questionWords(n)[0] ?? "").filter((w) => w.length >= 4));
  const hits = units.filter((u, i) => {
    if (u.code.length >= 3 && words.includes(u.code.toLowerCase())) return true;
    return firstWords[i]!.some(
      (fw) => !firstWords.some((other, j) => j !== i && other.includes(fw)) && words.some((q) => wordsMeet(q, fw)),
    );
  });
  return hits.length === 1 ? hits[0] : undefined;
}

/** Whether the question names this antibiotic: its code as a word, or a word of its English or Finnish name. */
export function antibioticInQuestion(question: string, antibiotic: Named): boolean {
  const words = questionWords(question);
  if (words.includes(antibiotic.code.toLowerCase())) return true;
  return findWord(words, antibiotic.en) !== undefined || findWord(words, antibiotic.fi) !== undefined;
}

// Words that name a unit of time, in English and Finnish (prefixes, any inflection).
const UNIT_WORDS: Record<PeriodUnit, { prefixes: string[]; exact: string[] }> = {
  day: { prefixes: ["day", "daily", "today", "päiv", "tänään"], exact: ["d", "pv", "vrk"] },
  week: { prefixes: ["week", "fortnight", "viik"], exact: ["wk", "wks", "vk", "vko", "vkoa"] },
  month: { prefixes: ["month", "quarter", "kuuk", "kuussa", "kuun", "neljännes"], exact: ["mo", "mos", "kk", "q"] },
  year: { prefixes: ["year", "annual", "vuo", "ytd"], exact: ["yr", "yrs", "v"] },
};

// Number words 2-12 in English and Finnish (stems cover the inflected forms; up to three letters = whole word).
const NUMBER_WORDS: [number, string[]][] = [
  [2, ["two", "couple", "fortnight", "kaksi", "kahd", "kaht"]],
  [3, ["three", "quarter", "kolm"]],
  [4, ["four", "neljä"]],
  [5, ["five", "viisi", "viid", "viit"]],
  [6, ["six", "half", "kuusi", "kuud", "kuut", "puol"]],
  [7, ["seven", "seitsem"]],
  [8, ["eight", "kahdeksa"]],
  [9, ["nine", "yhdeksä"]],
  [10, ["ten", "kymmen"]],
  [11, ["eleven", "yksitoista"]],
  [12, ["twelve", "kaksitoista"]],
];

/**
 * Whether the question states this period: a word for its unit, and for
 * "last N" with N > 1, the number N (digits or a number word; "half a year"
 * and "a quarter" count as 6 and 3 months).
 */
export function periodInQuestion(question: string, period: RelativePeriod): boolean {
  const words = questionWords(question).flatMap((w) => w.match(/\p{L}+|\p{N}+/gu) ?? []);
  const hasUnit = (u: PeriodUnit) =>
    words.some((w) => UNIT_WORDS[u].exact.includes(w) || UNIT_WORDS[u].prefixes.some((p) => w.startsWith(p)));
  // "half a year" / "a quarter" are stated in months by the model.
  const halfOrQuarter = period.unit === "month" && (period.count === 6 || period.count === 3) && hasUnit("year");
  if (!hasUnit(period.unit) && !halfOrQuarter) return false;
  if (period.kind === "this" || period.count === 1) return true;
  if (words.includes(String(period.count))) return true;
  const stems = NUMBER_WORDS.find(([n]) => n === period.count)?.[1] ?? [];
  return words.some((w) => stems.some((s) => (s.length <= 3 ? w === s : w.startsWith(s))));
}

/**
 * The model's reply checked against the meta. Every value must be one the
 * meta lists (codes, or names that resolve to exactly one); anything else
 * goes to `unmatched`. No number is taken from the reply except the period
 * length, and dates are computed here from `asOf`. With the `question`,
 * an organism, antibiotic or period the question does not name is dropped.
 */
export function validateAnswer(raw: unknown, meta: FeedMeta, asOf: IsoDate, question?: string): AiAnswer {
  const r = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const filters: AiFilters = {};
  const unmatched: string[] = [];
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
  const reject = (v: unknown) => {
    if (typeof v === "string" && v.trim()) unmatched.push(v.trim());
  };

  const traced = (field: "specimen" | "sex" | "age" | "onset", specimen?: Named) =>
    question === undefined || fieldInQuestion(question, field, specimen);

  const unit = str(r.unit ?? r.ward);
  if (unit) {
    const hit = matchNamed(unit, meta.units);
    if (hit) filters.ward = hit.code;
    else reject(unit);
  } else if (question !== undefined) {
    const hit = unitInQuestion(question, meta.units);
    if (hit) filters.ward = hit.code;
  }
  const specimen = str(r.specimen);
  if (specimen) {
    const hit = matchNamed(specimen, meta.specimens);
    if (!hit) reject(specimen);
    else if (traced("specimen", hit)) filters.specimen = hit.code;
  }
  const organism = str(r.organism);
  if (organism) {
    const hit = matchOrganism(organism, meta.organisms);
    if (!hit) reject(organism);
    else if (question === undefined) filters.organism = hit;
    else {
      const named = organismInQuestion(question, hit, meta.organisms);
      if (named.named) filters.organism = hit;
      else if (named.genusOnly) reject(named.genusOnly);
    }
  }
  const antibiotic = str(r.antibiotic);
  if (antibiotic) {
    const hit = matchNamed(antibiotic, meta.antibiotics);
    if (!hit) reject(antibiotic);
    else if (question === undefined || antibioticInQuestion(question, hit)) filters.antibiotic = hit.code;
  }
  const sex = str(r.sex)?.toUpperCase();
  if ((sex === "F" || sex === "M") && traced("sex")) filters.sex = sex;
  const age = str(r.age ?? r.ageGroup);
  if (age && (AGE_IDS as string[]).includes(age) && traced("age")) filters.ageGroup = age as AgeGroup;
  const onset = str(r.onset);
  if ((onset === "hospital" || onset === "community") && traced("onset")) filters.onset = onset;
  if (r.period != null) {
    const period = resolvePeriod(r.period, asOf, meta.start);
    if (period && (question === undefined || periodInQuestion(question, period))) filters.period = period;
  }
  const intent = str(r.intent);

  if (Array.isArray(r.unmatched)) {
    for (const word of r.unmatched) if (typeof word === "string" && word.trim()) unmatched.push(word.trim().slice(0, 60));
  }
  const seen = new Set<string>();
  const words = unmatched.filter((w) => {
    const key = norm(w);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    filters,
    ...(intent === "treatment" || intent === "signals" ? { intent } : {}),
    unmatched: words.slice(0, MAX_UNMATCHED),
  };
}

/** True when the answer sets no filter at all. */
export function isEmptyAnswer(answer: AiAnswer): boolean {
  return Object.keys(answer.filters).length === 0;
}

/** The answer in the feed's older AskAnswer shape (period as from/to). */
export function toAskAnswer(answer: AiAnswer): AskAnswer {
  const f = answer.filters;
  return {
    filters: {
      ...(f.period ? { from: f.period.from, to: f.period.to } : {}),
      ...(f.ward ? { ward: f.ward } : {}),
      ...(f.specimen ? { specimen: f.specimen } : {}),
      ...(f.organism ? { organism: f.organism } : {}),
    },
    ...(f.ageGroup ? { ageGroup: f.ageGroup } : {}),
    unmatched: answer.unmatched,
  };
}

/** True when a patient of this age falls in the group. */
export function inAgeGroup(ageYears: number, group: AgeGroup): boolean {
  const { min, max } = AGE_GROUPS[group];
  return ageYears >= min && (max === null || ageYears <= max);
}
