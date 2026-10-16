import { describe, expect, it, vi } from "vitest";
import {
  AGE_GROUPS,
  checkSlots,
  createLlm,
  explainAlert,
  fillSlots,
  LlmError,
  llmConfigFromEnv,
  NUMBER_WORDS,
  parseQuestion,
  reslot,
  type Vocabulary,
} from "./index.ts";

function mockLlm(output: unknown, status = 200) {
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(output) } }] }), { status }));
  return { llm: createLlm({ baseUrl: "http://localhost:8080/", model: "local", apiKey: "secret", fetch }), fetch };
}

const vocabulary: Vocabulary = {
  wards: [{ code: "ICU", en: "Intensive care", fi: "Teho-osasto" }],
  organisms: ["Escherichia coli"],
  specimens: [{ code: "urine", en: "urine", fi: "virtsa" }],
};

const empty = {
  ward: null,
  specimen: null,
  organism: null,
  sex: null,
  ageGroup: null,
  ageMin: null,
  ageMax: null,
  period: null,
  from: null,
  to: null,
  unmatched: [],
};

function parse(output: unknown, asOf = "2025-06-15", text = "urine E. coli in older men, last 3 months") {
  const { llm } = mockLlm(output);
  return parseQuestion(llm, { text, vocabulary, asOf });
}

describe("LLM client", () => {
  it("sends strict JSON schema, disabled thinking, temperature, auth and an abort signal", async () => {
    const { llm, fetch } = mockLlm({ ok: true });
    const messages = [{ role: "user" as const, content: "hello" }];
    const schema = { name: "result", schema: { type: "object" } };
    await expect(llm.json(messages, schema)).resolves.toEqual({ ok: true });
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe("http://localhost:8080/v1/chat/completions");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toEqual({ "Content-Type": "application/json", Authorization: "Bearer secret" });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(init?.body as string)).toEqual({
      model: "local",
      messages,
      temperature: 0,
      response_format: { type: "json_schema", json_schema: { ...schema, strict: true } },
      chat_template_kwargs: { enable_thinking: false },
    });
  });

  it("omits authorization when not configured", async () => {
    const { fetch } = mockLlm({});
    await createLlm({ baseUrl: "http://local", model: "m", fetch }).json([], { name: "x", schema: {} });
    expect(fetch.mock.calls[0]?.[1]?.headers).toEqual({ "Content-Type": "application/json" });
  });

  it("reads optional environment configuration", () => {
    expect(llmConfigFromEnv({})).toBeUndefined();
    expect(llmConfigFromEnv({ AEI_LLM_MODEL: "m" })).toBeUndefined();
    expect(llmConfigFromEnv({ AEI_LLM_URL: "http://local", AEI_LLM_MODEL: "m", AEI_LLM_KEY: "k" })).toEqual({
      baseUrl: "http://local",
      model: "m",
      apiKey: "k",
    });
    expect(llmConfigFromEnv({ AEI_LLM_URL: "http://local" })?.model).toBe("");
  });

  it("wraps HTTP, invalid JSON, absent content and timeouts in LlmError", async () => {
    await expect(mockLlm({}, 500).llm.json([], { name: "x", schema: {} })).rejects.toThrow(LlmError);
    for (const body of ["not json", JSON.stringify({ choices: [] }), JSON.stringify({ choices: [{ message: { content: "not json" } }] })]) {
      const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(body));
      await expect(createLlm({ baseUrl: "http://local", model: "m", fetch }).json([], { name: "x", schema: {} })).rejects.toThrow(LlmError);
    }
    const fetch = vi.fn<typeof globalThis.fetch>().mockRejectedValue(new DOMException("timed out", "TimeoutError"));
    await expect(
      createLlm({ baseUrl: "http://local", model: "m", timeoutMs: 1, fetch }).json([], { name: "x", schema: {} }),
    ).rejects.toThrow(LlmError);
  });
});

describe("question parsing", () => {
  it.each([
    ["month", 3, "2025-06-15", "2025-03-16"],
    ["month", 1, "2025-03-31", "2025-03-01"],
    ["month", 1, "2024-03-31", "2024-03-01"],
    ["year", 1, "2024-02-29", "2023-03-01"],
    ["year", 1, "2025-06-15", "2024-06-16"],
    ["week", 2, "2025-06-15", "2025-06-02"],
    ["day", 1, "2025-06-15", "2025-06-15"],
  ])("converts last %s × %i using replay time %s", async (unit, count, asOf, from) => {
    const result = await parse({ ...empty, period: { unit, count } }, asOf);
    expect(result.filters).toEqual({ from, to: asOf });
  });

  it.each(Object.entries(AGE_GROUPS))("converts age group %s in code", async (ageGroup, bounds) => {
    const { filters } = await parse({ ...empty, ageGroup });
    expect(filters.ageMin).toBe(bounds[0]);
    expect(filters.ageMax).toBe(bounds[1] ?? undefined);
  });

  it("lets explicit ages override the group and preserves group metadata", async () => {
    expect(await parse({ ...empty, ageGroup: "older", ageMin: 70, ageMax: 85 })).toEqual({
      filters: { ageMin: 70, ageMax: 85 },
      ageGroup: "older",
      unmatched: [],
    });
  });

  it("keeps vocabulary values and drops invented values into unmatched", async () => {
    const result = await parse({
      ...empty,
      ward: "MOON",
      specimen: "urine",
      organism: "Escherichia coli",
      sex: "M",
      unmatched: ["mystery", 8],
    });
    expect(result).toEqual({ filters: { specimen: "urine", organism: "Escherichia coli", sex: "M" }, unmatched: ["mystery", "MOON"] });
  });

  it("drops invalid ages and inconsistent bounds", async () => {
    for (const ages of [
      { ageMin: -1, ageMax: 121 },
      { ageMin: 4.5, ageMax: "50" },
      { ageMin: 90, ageMax: 20 },
    ]) {
      expect((await parse({ ...empty, ...ages })).filters).toEqual({});
    }
  });

  it("explicit dates win, reverse bounds swap, invalid dates drop", async () => {
    expect((await parse({ ...empty, from: "2025-05-01", to: "2025-04-01", period: { unit: "year", count: 1 } })).filters).toEqual({
      from: "2025-04-01",
      to: "2025-05-01",
    });
    expect((await parse({ ...empty, from: "2025-02-30", to: "tomorrow" })).filters).toEqual({});
    expect((await parse({ ...empty, from: "2025-01-01", period: { unit: "month", count: 1 } })).filters).toEqual({
      from: "2025-01-01",
      to: "2025-06-15",
    });
  });

  it("drops malformed output and periods without throwing", async () => {
    for (const output of [null, [], "wrong", 4, { period: { unit: "month", count: -1 } }, { period: { unit: "month", count: 1e100 } }]) {
      expect((await parse(output)).filters).toEqual({});
    }
    await expect(parseQuestion(mockLlm({}, 500).llm, { text: "q", vocabulary, asOf: "2025-06-15" })).rejects.toThrow(LlmError);
  });

  it("provides bilingual vocabulary, age meanings, and strict nullable schema", async () => {
    const { llm, fetch } = mockLlm(empty);
    const text = "virtsan E. coli iäkkäillä miehillä viimeiset 3 kk";
    await parseQuestion(llm, { text, vocabulary, asOf: "2025-06-15" });
    const body = JSON.parse(fetch.mock.calls[0]?.[1]?.body as string);
    expect(body.messages[0].content).toContain("Teho-osasto");
    expect(body.messages[0].content).toContain("Intensive care");
    expect(body.messages[0].content).toContain("(iäkäs, iäkkäät, vanhus) = older");
    expect(body.messages[0].content).toContain("Geriatrics alone does not mean older");
    expect(body.messages[1].content).toBe(text);
    const schema = body.response_format.json_schema.schema;
    expect(schema.required.sort()).toEqual(Object.keys(empty).sort());
    expect(schema.additionalProperties).toBe(false);
    expect(schema.properties.ward.enum).toEqual(["ICU", null]);
  });
});

const explanation = {
  lang: "en" as const,
  kind: "cpe",
  summary: "Carrier alert",
  facts: { count: 1234, date: "2025-06-15", ward: "ICU" },
  fallback: "{count} carriers in {ward} on {date}.",
};

describe("safe explanations", () => {
  it.each([
    "There are 3 carriers.",
    "There are three carriers.",
    "KOLME tapausta.",
    "Prosenttia enemmän.",
    "Kaksinkertaisen määrän.",
    "Viidellä potilaalla.",
    "Kuudesta potilaasta.",
    "Kahdenkymmenen potilaan.",
    "{unknown} carriers.",
    "{count",
    "{{count}}",
  ])("rejects ungrounded text: %s", (text) => expect(checkSlots(text, ["count"])).toBe(false));

  it("rejects every listed number word, case-insensitively", () => {
    for (const word of NUMBER_WORDS) expect(checkSlots(`${word.toUpperCase()} carriers`, [])).toBe(false);
  });

  it("accepts only known slots with non-numeric surrounding words", () => {
    expect(checkSlots("{count} carriers in {ward} on {date}.", Object.keys(explanation.facts))).toBe(true);
    expect(checkSlots("Someone is at risk; the ward reviewed the alert.", [])).toBe(true);
    expect(checkSlots("{count2} tapausta.", ["count2"])).toBe(true);
    expect(checkSlots("{toString}", [])).toBe(false);
  });

  it("formats numbers by locale, leaving strings unchanged", () => {
    for (const lang of ["en", "fi"] as const) {
      expect(fillSlots("{n} on {date}", { n: 1234.5, date: "2025-06-15" }, lang)).toBe(
        `${new Intl.NumberFormat(lang === "fi" ? "fi-FI" : "en-GB").format(1234.5)} on 2025-06-15`,
      );
    }
  });

  it("accepts grounded model text and gives the prompt fact names, hiding values with digits", async () => {
    const { llm, fetch } = mockLlm({ text: "{count} carriers in {ward} on {date}." });
    expect(await explainAlert(llm, explanation)).toEqual({ text: "1,234 carriers in ICU on 2025-06-15.", source: "model" });
    const body = JSON.parse(fetch.mock.calls[0]?.[1]?.body as string);
    expect(body.messages[1]).toMatchObject({ role: "user" });
    expect(body.messages[1].content).toContain('"count":"{count}"');
    expect(body.messages[1].content).toContain('"date":"{date}"');
    expect(body.messages[1].content).toContain('"ward":"ICU"');
    expect(body.messages[0].content).toContain("English");
  });

  it.each([{ text: "3 carriers." }, { text: "three carriers." }, { text: "{invented} carriers." }, { text: "" }, null, { text: 7 }])(
    "uses template on bad model text: %j",
    async (output) => {
      expect(await explainAlert(mockLlm(output).llm, explanation)).toEqual({
        text: "1,234 carriers in ICU on 2025-06-15.",
        source: "template",
      });
    },
  );

  it("uses the template on HTTP 500", async () => {
    expect(await explainAlert(mockLlm({}, 500).llm, explanation)).toEqual({
      text: "1,234 carriers in ICU on 2025-06-15.",
      source: "template",
    });
  });
});

describe("review additions", () => {
  it("sends Cloudflare Access headers from the environment", async () => {
    const config = llmConfigFromEnv({ AEI_LLM_URL: "https://x", AEI_LLM_MODEL: "m", AEI_LLM_ACCESS_ID: "id", AEI_LLM_ACCESS_SECRET: "s" });
    expect(config?.headers).toEqual({ "CF-Access-Client-Id": "id", "CF-Access-Client-Secret": "s" });
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: "{}" } }] })));
    await createLlm({ ...(config ?? { baseUrl: "", model: "" }), fetch }).json([], { name: "x", schema: {} });
    const headers = fetch.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(headers["CF-Access-Client-Secret"]).toBe("s");
  });

  it("accepts ordinary Finnish words that share a prefix with a number", () => {
    expect(checkSlots("Löydös viittaa siihen, että tartunta voi levitä osastolle {ward}.", ["ward"])).toBe(true);
    expect(checkSlots("Viittä potilasta seurataan.", [])).toBe(false);
    expect(checkSlots("Tuhannen näytteen joukossa.", [])).toBe(false);
  });
});

describe("hidden numeric facts", () => {
  const facts = { date: "2025-06-10", ward: "Urology", patientId: "P001234", observed: 9 };

  it("shows the model only placeholders for values with digits", async () => {
    const { llm, fetch } = mockLlm({ text: "On {date}, patient {patientId} in Urology." });
    const result = await explainAlert(llm, { lang: "en", kind: "cpe", summary: "s", facts, fallback: "f" });
    expect(result).toEqual({ text: "On 2025-06-10, patient P001234 in Urology.", source: "model" });
    const prompt = JSON.parse(String(fetch.mock.calls[0]?.[1]?.body)).messages[1].content as string;
    expect(prompt).not.toContain("2025-06-10");
    expect(prompt).not.toContain("P001234");
    expect(prompt).toContain('"ward":"Urology"');
  });

  it("re-slots verbatim copies of a fact value but still rejects reformatted or invented numbers", async () => {
    expect(reslot("Patient P001234 on 2025-06-10, 9 cases.", facts)).toBe("Patient {patientId} on {date}, {observed} cases.");
    const reformatted = await explainAlert(mockLlm({ text: "On 10.6.2025 in Urology." }).llm, {
      lang: "fi",
      kind: "cpe",
      summary: "s",
      facts,
      fallback: "pohja {ward}",
    });
    expect(reformatted).toEqual({ text: "pohja Urology", source: "template" });
  });
});

describe("template-only facts", () => {
  const input = {
    lang: "fi" as const,
    kind: "cpe",
    summary: "s",
    facts: { ward: "Urologia", patientId: "P000769", date: "2025-06-13" },
    templateOnly: ["patientId"],
    fallback: "{date}: potilas {patientId}, {ward}.",
  };

  it("never offers a patient identifier to the model", async () => {
    const { llm, fetch } = mockLlm({ text: "Osastolla Urologia {date}." });
    expect(await explainAlert(llm, input)).toEqual({ text: "Osastolla Urologia 2025-06-13.", source: "model" });
    const body = String(fetch.mock.calls[0]?.[1]?.body);
    expect(body).not.toContain("patientId");
    expect(body).not.toContain("P000769");
  });

  it("rejects a model text that names the patient, by slot or by copy, and keeps the ID in the template", async () => {
    for (const text of ["Potilas {patientId} osastolla Urologia.", "Potilas P000769 osastolla Urologia."]) {
      expect(await explainAlert(mockLlm({ text }).llm, input)).toEqual({
        text: "2025-06-13: potilas P000769, Urologia.",
        source: "template",
      });
    }
  });
});
