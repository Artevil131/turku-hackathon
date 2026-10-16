import type { FeedMeta } from "@aei/feed";
import { beforeEach, describe, expect, it } from "vitest";
import { AiError, aiStatus, askAi, forgetAiStatus } from "./index.ts";

// The browser wrapper around @aei/question-filters (whose own tests cover the
// prompt, schema and validation).

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
