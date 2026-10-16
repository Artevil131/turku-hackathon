import { beforeEach, describe, expect, it } from "vitest";
import type { FeedMeta } from "../feed/types.ts";
import { ai as aiMessages } from "../i18n/messages/ai.ts";
import {
  AiError,
  abbreviate,
  aiStatus,
  answerSchema,
  askAi,
  buildMessages,
  chatRequest,
  cleanQuestion,
  exampleTurns,
  fieldInQuestion,
  forgetAiStatus,
  inAgeGroup,
  isEmptyAnswer,
  MAX_QUESTION_CHARS,
  matchNamed,
  matchOrganism,
  organismInQuestion,
  parseReply,
  periodInQuestion,
  resolvePeriod,
  systemPrompt,
  toAskAnswer,
  unitInQuestion,
  validateAnswer,
} from "./index.ts";

// A made-up hospital, deliberately unlike the demo data: the AI layer must
// work from whatever the feed's meta lists.
const meta: FeedMeta = {
  start: "2024-03-01",
  end: "2026-12-31",
  units: [
    { code: "CARD", en: "Cardiology", fi: "Kardiologia", type: "in", institution: "hospital" },
    { code: "ICU", en: "Intensive care unit", fi: "Teho-osasto", type: "in", institution: "hospital" },
    { code: "HC-E", en: "Health centre East", fi: "Terveysasema Itä", type: "out", institution: "primary_care" },
    { code: "HC-W", en: "Health centre West", fi: "Terveysasema Länsi", type: "out", institution: "primary_care" },
  ],
  specimens: [
    { code: "urine", en: "urine", fi: "virtsa" },
    { code: "blood", en: "blood", fi: "veri" },
  ],
  organisms: ["Escherichia coli", "Klebsiella pneumoniae", "Klebsiella oxytoca", "Staphylococcus aureus"],
  antibiotics: [
    { code: "NIT", en: "nitrofurantoin", fi: "nitrofurantoiini", class: "nitrofurans", reportedFor: "urine" },
    { code: "CXM", en: "cefuroxime", fi: "kefuroksiimi", class: "cephalosporins", reportedFor: "all" },
  ],
  ai: false,
};
const asOf = "2025-05-12"; // a Monday

describe("answer schema and prompt", () => {
  it("takes every allowed value from the meta, with null for 'not said'", () => {
    const schema = answerSchema(meta) as { properties: Record<string, { enum?: unknown[] }>; required: string[] };
    expect(schema.properties.unit!.enum).toEqual(["CARD", "ICU", "HC-E", "HC-W", null]);
    expect(schema.properties.specimen!.enum).toEqual(["urine", "blood", null]);
    expect(schema.properties.organism!.enum).toEqual([...meta.organisms, null]);
    expect(schema.properties.antibiotic!.enum).toEqual(["NIT", "CXM", null]);
    expect(schema.properties.sex!.enum).toEqual(["F", "M", null]);
    expect(schema.required).toContain("unmatched");
    expect(schema.required).toContain("period");
  });

  it("lists codes with both names in the system prompt", () => {
    const prompt = systemPrompt(meta, "fi");
    expect(prompt).toContain("HC-E = Health centre East / Terveysasema Itä (outpatient)");
    expect(prompt).toContain("CARD = Cardiology / Kardiologia (inpatient ward)");
    expect(prompt).toContain("urine = urine / virtsa");
    expect(prompt).toContain("CXM = cefuroxime / kefuroksiimi");
    expect(prompt).toContain("Klebsiella oxytoca");
    expect(prompt).toContain("The question is in Finnish");
    expect(systemPrompt(meta, "en")).toContain("The question is in English");
  });

  it("builds its worked examples from the meta, and they pass its own checks", () => {
    const turns = exampleTurns(meta);
    expect(turns.map((t) => t.role)).toEqual(["user", "assistant", "user", "assistant"]);
    expect(turns[0]!.content).toContain("E. coli");
    const first = validateAnswer(JSON.parse(turns[1]!.content), meta, asOf, turns[0]!.content);
    expect(first.filters).toMatchObject({ ward: "CARD", specimen: "urine", organism: "Escherichia coli", sex: "F", ageGroup: "very_old" });
    expect(first.filters.period).toMatchObject({ from: "2025-04-29", to: asOf });
    const second = validateAnswer(JSON.parse(turns[3]!.content), meta, asOf, turns[2]!.content);
    expect(second.filters).toMatchObject({ ward: "ICU", specimen: "blood" });
    expect(second.filters.period).toMatchObject({ kind: "this", unit: "year", from: "2025-01-01" });
    expect(second.intent).toBe("treatment");
    expect(second.unmatched).toEqual(["Atlantiksen sairaala"]);
  });

  it("ends the messages with the cleaned question", () => {
    const messages = buildMessages("  ICU\n blood  ", "en", meta);
    expect(messages[0]!.role).toBe("system");
    expect(messages.at(-1)).toEqual({ role: "user", content: "ICU blood" });
    expect(cleanQuestion("x".repeat(1000))).toHaveLength(MAX_QUESTION_CHARS);
  });

  it("asks for JSON in both response_format spellings, at temperature 0, without thinking for Qwen3", () => {
    const a = chatRequest("ICU", "en", meta, "qwen3.5-4b", 0);
    expect(a.temperature).toBe(0);
    expect(a.model).toBe("qwen3.5-4b");
    expect(a.response_format).toMatchObject({ type: "json_schema", json_schema: { schema: answerSchema(meta) } });
    expect(a.chat_template_kwargs).toEqual({ enable_thinking: false });
    const b = chatRequest("ICU", "en", meta, "llama-3.2-3b", 1);
    expect(b.response_format).toMatchObject({ type: "json_object", schema: answerSchema(meta) });
    expect(b.chat_template_kwargs).toBeUndefined();
    expect(chatRequest("ICU", "en", meta, null, 0).model).toBeUndefined();
  });

  it("abbreviates Latin names", () => {
    expect(abbreviate("Escherichia coli")).toBe("E. coli");
    expect(abbreviate("Candida")).toBe("Candida");
  });
});

describe("reading the reply", () => {
  it("finds the JSON object around thinking and code fences", () => {
    expect(parseReply('{"unit":"ICU"}')).toEqual({ unit: "ICU" });
    expect(parseReply('<think>hmm {no}</think>\n```json\n{"unit":"ICU"}\n```')).toEqual({ unit: "ICU" });
    expect(parseReply("no idea")).toBeNull();
    expect(parseReply("[1,2]")).toBeNull();
  });

  it("matches codes and names in either language", () => {
    expect(matchNamed("icu", meta.units)?.code).toBe("ICU");
    expect(matchNamed("Teho-osasto", meta.units)?.code).toBe("ICU");
    expect(matchNamed("health centre east", meta.units)?.code).toBe("HC-E");
    expect(matchNamed("veri", meta.specimens)?.code).toBe("blood");
    expect(matchNamed("Ward 7", meta.units)).toBeUndefined();
  });

  it("matches organisms by full name, abbreviation or a word that fits one", () => {
    expect(matchOrganism("escherichia coli", meta.organisms)).toBe("Escherichia coli");
    expect(matchOrganism("E. coli", meta.organisms)).toBe("Escherichia coli");
    expect(matchOrganism("E.coli", meta.organisms)).toBe("Escherichia coli");
    expect(matchOrganism("K. oxytoca", meta.organisms)).toBe("Klebsiella oxytoca");
    expect(matchOrganism("aureus", meta.organisms)).toBe("Staphylococcus aureus");
    expect(matchOrganism("Klebsiella", meta.organisms)).toBeUndefined(); // two of them
    expect(matchOrganism("Acinetobacter baumannii", meta.organisms)).toBeUndefined();
  });
});

describe("periods", () => {
  it("counts back from the as-of date, both ends included", () => {
    const last = (count: number, unit: "day" | "week" | "month" | "year") => resolvePeriod({ kind: "last", count, unit }, asOf);
    expect(last(7, "day")).toMatchObject({ from: "2025-05-06", to: asOf, clamped: false });
    expect(last(1, "day")).toMatchObject({ from: asOf });
    expect(last(2, "week")).toMatchObject({ from: "2025-04-29" });
    expect(last(3, "month")).toMatchObject({ from: "2025-02-13" });
    expect(last(1, "year")).toMatchObject({ from: "2024-05-13" });
  });

  it("starts 'this' periods at the calendar boundary", () => {
    expect(resolvePeriod({ kind: "this", count: 1, unit: "year" }, asOf)?.from).toBe("2025-01-01");
    expect(resolvePeriod({ kind: "this", count: 1, unit: "month" }, asOf)?.from).toBe("2025-05-01");
    expect(resolvePeriod({ kind: "this", count: 1, unit: "week" }, "2025-05-15")?.from).toBe("2025-05-12");
  });

  it("cuts at the feed's first date and says so", () => {
    expect(resolvePeriod({ kind: "last", count: 3, unit: "year" }, asOf, meta.start)).toMatchObject({ from: "2024-03-01", clamped: true });
  });

  it("refuses anything but a whole, sensible length and a known unit", () => {
    for (const bad of [
      { kind: "last", count: 0, unit: "day" },
      { kind: "last", count: 1.5, unit: "month" },
      { kind: "last", count: "3", unit: "month" },
      { kind: "last", count: 9999, unit: "day" },
      { kind: "last", count: 2, unit: "decade" },
      { kind: "since", count: 2, unit: "month" },
      { from: "2020-01-01", to: "2020-12-31" },
      null,
    ]) {
      expect(resolvePeriod(bad, asOf), JSON.stringify(bad)).toBeNull();
    }
    expect(resolvePeriod({ kind: "last", count: 1, unit: "day" }, "2025-13-01")).toBeNull();
  });

  it("only keeps a period the question states", () => {
    const p = (kind: "last" | "this", count: number, unit: "day" | "week" | "month" | "year") => ({ kind, count, unit });
    expect(periodInQuestion("urine, last 3 months", p("last", 3, "month"))).toBe(true);
    expect(periodInQuestion("viimeisen kolmen kuukauden aikana", p("last", 3, "month"))).toBe(true);
    expect(periodInQuestion("viimeiset 2 viikkoa", p("last", 2, "week"))).toBe(true);
    expect(periodInQuestion("kahden viikon ajalta", p("last", 2, "week"))).toBe(true);
    expect(periodInQuestion("3kk", p("last", 3, "month"))).toBe(true);
    expect(periodInQuestion("puolen vuoden ajalta", p("last", 6, "month"))).toBe(true);
    expect(periodInQuestion("over the past two years", p("last", 2, "year"))).toBe(true);
    expect(periodInQuestion("tänä vuonna", p("this", 1, "year"))).toBe(true);
    expect(periodInQuestion("past month", p("last", 1, "month"))).toBe(true);
    expect(periodInQuestion("since March", p("this", 1, "month"))).toBe(false);
    expect(periodInQuestion("lately", p("last", 1, "month"))).toBe(false);
    expect(periodInQuestion("last 5 weeks", p("last", 3, "week"))).toBe(false);
  });
});

describe("grounding in the question", () => {
  it("knows when an organism is named", () => {
    expect(organismInQuestion("urine E. coli", "Escherichia coli", meta.organisms).named).toBe(true);
    expect(organismInQuestion("kolibakteeri virtsassa", "Escherichia coli", meta.organisms).named).toBe(true);
    expect(organismInQuestion("stafylokokki haavoissa", "Staphylococcus aureus", meta.organisms).named).toBe(true);
    expect(organismInQuestion("Acinetobacter on ward 7", "Escherichia coli", meta.organisms).named).toBe(false);
    expect(organismInQuestion("klebsiella in blood", "Klebsiella pneumoniae", meta.organisms)).toEqual({
      named: false,
      genusOnly: "klebsiella",
    });
    expect(organismInQuestion("K. pneumoniae in blood", "Klebsiella pneumoniae", meta.organisms).named).toBe(true);
  });

  it("knows when sex, age, onset or a sample is mentioned", () => {
    expect(fieldInQuestion("older men", "sex")).toBe(true);
    expect(fieldInQuestion("naisilla", "sex")).toBe(true);
    expect(fieldInQuestion("in geriatrics", "sex")).toBe(false);
    expect(fieldInQuestion("older men", "age")).toBe(true);
    expect(fieldInQuestion("yli 80-vuotiaat", "age")).toBe(true);
    expect(fieldInQuestion("lasten virtsanäytteet", "age")).toBe(true);
    expect(fieldInQuestion("pseudomonas in geriatrics", "age")).toBe(false);
    expect(fieldInQuestion("hospital-acquired", "onset")).toBe(true);
    expect(fieldInQuestion("UTIs in the ER", "specimen", meta.specimens[0])).toBe(true);
    expect(fieldInQuestion("veriviljelyt", "specimen", meta.specimens[1])).toBe(true);
    expect(fieldInQuestion("pseudomonas in geriatrics", "specimen", meta.specimens[1])).toBe(false);
  });

  it("finds a unit by its distinctive first word, never a shared one", () => {
    expect(unitInQuestion("onko teholla jotain poikkeavaa?", meta.units)?.code).toBe("ICU");
    expect(unitInQuestion("kardiologialla virtsa", meta.units)?.code).toBe("CARD");
    expect(unitInQuestion("anything on icu", meta.units)?.code).toBe("ICU");
    expect(unitInQuestion("terveysasemalla", meta.units)).toBeUndefined();
    expect(unitInQuestion("what works", meta.units)).toBeUndefined();
  });
});

describe("validateAnswer", () => {
  const reply = (over: Record<string, unknown>) => ({
    unit: null,
    specimen: null,
    organism: null,
    antibiotic: null,
    sex: null,
    age: null,
    onset: null,
    period: null,
    intent: null,
    unmatched: [],
    ...over,
  });

  it("keeps values the meta lists and the question names", () => {
    const q = "urine E. coli in older men at cardiology, nitrofurantoin, hospital-acquired, last 3 months";
    const a = validateAnswer(
      reply({
        unit: "CARD",
        specimen: "urine",
        organism: "Escherichia coli",
        antibiotic: "NIT",
        sex: "M",
        age: "older",
        onset: "hospital",
        period: { kind: "last", count: 3, unit: "month" },
      }),
      meta,
      asOf,
      q,
    );
    expect(a.filters).toEqual({
      ward: "CARD",
      specimen: "urine",
      organism: "Escherichia coli",
      antibiotic: "NIT",
      sex: "M",
      ageGroup: "older",
      onset: "hospital",
      period: { kind: "last", count: 3, unit: "month", from: "2025-02-13", to: asOf, clamped: false },
    });
    expect(a.unmatched).toEqual([]);
    expect(isEmptyAnswer(a)).toBe(false);
  });

  it("sends unknown values to unmatched and drops what the question never said", () => {
    const a = validateAnswer(
      reply({
        unit: "Ward 7",
        organism: "Escherichia coli",
        antibiotic: "CXM",
        sex: "F",
        age: "older",
        period: { kind: "this", count: 1, unit: "month" },
        unmatched: ["Acinetobacter", "Ward 7", "since March"],
      }),
      meta,
      asOf,
      "Acinetobacter on ward 7 since March",
    );
    expect(a.filters).toEqual({});
    expect(a.unmatched).toEqual(["Ward 7", "Acinetobacter", "since March"]);
    expect(isEmptyAnswer(a)).toBe(true);
  });

  it("puts an ambiguous genus in unmatched instead of picking a species", () => {
    const a = validateAnswer(reply({ organism: "Klebsiella pneumoniae" }), meta, asOf, "klebsiella veriviljelyt");
    expect(a.filters.organism).toBeUndefined();
    expect(a.unmatched).toEqual(["klebsiella"]);
  });

  it("takes no number or date from the reply except the period length", () => {
    const a = validateAnswer(
      {
        unit: "ICU",
        from: "2019-01-01",
        to: "2030-01-01",
        minAge: 3,
        period: { kind: "last", count: 2, unit: "week", from: "2019-01-01" },
      },
      meta,
      asOf,
      "ICU last 2 weeks",
    );
    expect(a.filters).toEqual({
      ward: "ICU",
      period: { kind: "last", count: 2, unit: "week", from: "2025-04-29", to: asOf, clamped: false },
    });
  });

  it("accepts names and loose casing, ignores junk, and removes repeated words", () => {
    const a = validateAnswer(
      {
        unit: "Teho-osasto",
        specimen: "Veri",
        organism: "S. aureus",
        sex: "f",
        age: "ancient",
        onset: "maybe",
        intent: "chat",
        unmatched: ["foo", "Foo", 3, ""],
      },
      meta,
      asOf,
    );
    expect(a.filters).toEqual({ ward: "ICU", specimen: "blood", organism: "Staphylococcus aureus", sex: "F" });
    expect(a.intent).toBeUndefined();
    expect(a.unmatched).toEqual(["foo"]);
    expect(validateAnswer("nonsense", meta, asOf)).toEqual({ filters: {}, unmatched: [] });
    expect(validateAnswer(null, meta, asOf)).toEqual({ filters: {}, unmatched: [] });
  });

  it("fills the unit from the question when the model missed an inflected name", () => {
    expect(validateAnswer(reply({ intent: "signals" }), meta, asOf, "onko teholla jotain poikkeavaa?")).toEqual({
      filters: { ward: "ICU" },
      intent: "signals",
      unmatched: [],
    });
  });

  it("converts to the feed's older AskAnswer shape", () => {
    const a = validateAnswer(
      reply({ unit: "ICU", age: "child", period: { kind: "this", count: 1, unit: "year" } }),
      meta,
      asOf,
      "children in ICU this year",
    );
    expect(toAskAnswer(a)).toEqual({ filters: { from: "2025-01-01", to: asOf, ward: "ICU" }, ageGroup: "child", unmatched: [] });
  });

  it("has age groups with inclusive bounds", () => {
    expect(inAgeGroup(17, "child")).toBe(true);
    expect(inAgeGroup(18, "child")).toBe(false);
    expect(inAgeGroup(64, "adult")).toBe(true);
    expect(inAgeGroup(65, "older")).toBe(true);
    expect(inAgeGroup(85, "older")).toBe(true);
    expect(inAgeGroup(79, "very_old")).toBe(false);
  });
});

// ---------- askAi / aiStatus against a fake server (no network) ----------

type Handler = (url: string, init: RequestInit) => Response | Promise<Response>;

function fakeFetch(handler: Handler) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fn = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    calls.push({ url, init });
    return handler(url, init);
  }) as typeof fetch;
  return { fn, calls };
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
const models = () => json({ object: "list", data: [{ id: "qwen3.5-4b" }] });
const completion = (content: unknown) => json({ choices: [{ message: { role: "assistant", content: JSON.stringify(content) } }] });

/** A fetch that never answers until aborted. */
const hanging: Handler = (_url, init) =>
  new Promise((_resolve, reject) => {
    init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
  });

async function errorCode(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return "none";
  } catch (e) {
    return e instanceof AiError ? e.code : `other: ${String(e)}`;
  }
}

describe("aiStatus", () => {
  beforeEach(() => forgetAiStatus());

  it("reports the served model", async () => {
    const { fn, calls } = fakeFetch(() => models());
    expect(await aiStatus({ fetch: fn })).toEqual({ available: true, model: "qwen3.5-4b" });
    expect(calls[0]!.url).toBe("/llm/v1/models");
  });

  it("prefers the configured model the proxy names", async () => {
    const { fn } = fakeFetch(() => json({ data: [{ id: "a" }, { id: "b" }] }, 200, { "x-aei-model": "b" }));
    expect(await aiStatus({ fetch: fn })).toEqual({ available: true, model: "b" });
  });

  it("is off without the proxy (the dev server answers with the HTML page), on errors and on timeout", async () => {
    const html = fakeFetch(() => new Response("<!doctype html>", { status: 200, headers: { "content-type": "text/html" } }));
    expect(await aiStatus({ fetch: html.fn })).toEqual({ available: false, model: null });
    const down = fakeFetch(() => new Response("bad gateway", { status: 502 }));
    expect(await aiStatus({ fetch: down.fn })).toEqual({ available: false, model: null });
    const broken = fakeFetch(() => Promise.reject(new TypeError("Failed to fetch")));
    expect(await aiStatus({ fetch: broken.fn })).toEqual({ available: false, model: null });
    const slow = fakeFetch(hanging);
    expect(await aiStatus({ fetch: slow.fn, timeoutMs: 20 })).toEqual({ available: false, model: null });
  });
});

describe("askAi", () => {
  beforeEach(() => forgetAiStatus());
  const q = "ICU blood cultures this year";

  it("asks the model and returns checked filters", async () => {
    const { fn, calls } = fakeFetch((url) =>
      url.endsWith("/models")
        ? models()
        : completion({ unit: "ICU", specimen: "blood", period: { kind: "this", count: 1, unit: "year" }, unmatched: [] }),
    );
    const result = await askAi(q, "en", meta, asOf, { fetch: fn });
    expect(result.filters).toEqual({
      ward: "ICU",
      specimen: "blood",
      period: { kind: "this", count: 1, unit: "year", from: "2025-01-01", to: asOf, clamped: false },
    });
    expect(result.model).toBe("qwen3.5-4b");
    expect(result.ms).toBeGreaterThanOrEqual(0);
    const chat = calls.find((c) => c.url === "/llm/v1/chat/completions")!;
    expect(chat.init.method).toBe("POST");
    const body = JSON.parse(String(chat.init.body)) as Record<string, unknown>;
    expect(body).toMatchObject({ model: "qwen3.5-4b", temperature: 0, chat_template_kwargs: { enable_thinking: false } });
    // No credentials leave the browser: the proxy adds them.
    expect(Object.keys(chat.init.headers as Record<string, string>).sort()).toEqual(["accept", "content-type"]);
  });

  it("tries the other response_format spelling once when the server refuses the first", async () => {
    const formats: string[] = [];
    const { fn } = fakeFetch((url, init) => {
      if (url.endsWith("/models")) return models();
      const body = JSON.parse(String(init.body)) as { response_format: { type: string } };
      formats.push(body.response_format.type);
      return body.response_format.type === "json_schema" ? json({ error: { message: "unsupported" } }, 400) : completion({ unit: "ICU" });
    });
    expect((await askAi(q, "en", meta, asOf, { fetch: fn })).filters.ward).toBe("ICU");
    // The working spelling is remembered.
    expect((await askAi(q, "en", meta, asOf, { fetch: fn })).filters.ward).toBe("ICU");
    expect(formats).toEqual(["json_schema", "json_object", "json_object"]);
  });

  it("says why it could not answer", async () => {
    const off = fakeFetch(() => new Response("<!doctype html>", { headers: { "content-type": "text/html" } }));
    expect(await errorCode(askAi(q, "en", meta, asOf, { fetch: off.fn }))).toBe("off");
    forgetAiStatus();
    expect(await errorCode(askAi("   ", "en", meta, asOf))).toBe("empty");

    const busy = fakeFetch((url) => (url.endsWith("/models") ? models() : new Response("loading", { status: 503 })));
    expect(await errorCode(askAi(q, "en", meta, asOf, { fetch: busy.fn }))).toBe("busy");

    const slow = fakeFetch((url, init) => (url.endsWith("/models") ? models() : hanging(url, init)));
    expect(await errorCode(askAi(q, "en", meta, asOf, { fetch: slow.fn, timeoutMs: 20 }))).toBe("timeout");

    const garbled = fakeFetch((url) =>
      url.endsWith("/models") ? models() : json({ choices: [{ message: { content: "Sorry, I can't." } }] }),
    );
    expect(await errorCode(askAi(q, "en", meta, asOf, { fetch: garbled.fn }))).toBe("unreadable");

    const unreachable = fakeFetch((url) => (url.endsWith("/models") ? models() : Promise.reject(new TypeError("Failed to fetch"))));
    expect(await errorCode(askAi(q, "en", meta, asOf, { fetch: unreachable.fn }))).toBe("network");
  });

  it("stops when the caller cancels", async () => {
    const controller = new AbortController();
    const { fn } = fakeFetch((url, init) => (url.endsWith("/models") ? models() : hanging(url, init)));
    const pending = errorCode(askAi(q, "en", meta, asOf, { fetch: fn, signal: controller.signal }));
    setTimeout(() => controller.abort(), 10);
    expect(await pending).toBe("aborted");
  });
});

describe("ai copy", () => {
  it("has every key in Finnish and English, with the same placeholders", () => {
    expect(Object.keys(aiMessages.fi).sort()).toEqual(Object.keys(aiMessages.en).sort());
    const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
    for (const [key, en] of Object.entries(aiMessages.en) as [keyof typeof aiMessages.en, string][]) {
      expect(key.startsWith("ai."), key).toBe(true);
      expect(vars(aiMessages.fi[key]), key).toEqual(vars(en));
    }
  });
});
