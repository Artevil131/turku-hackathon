import type { FeedMeta, IsoDate } from "@aei/feed";
import { type AiAnswer, chatRequest, cleanQuestion, type Lang, parseReply, validateAnswer } from "@aei/question-filters";

export * from "@aei/question-filters";

// Optional AI layer: a plain-language question becomes filters the doctor can
// see and change. The team's small language model (an OpenAI-compatible
// llama.cpp server) is reached through the dev server's /llm proxy, which adds
// the Cloudflare Access credentials on the server side (vite.config.ts); the
// browser never holds them. Without the proxy, aiStatus() reports it off and
// the app works the same without it. The model only chooses from the feed's
// code lists; @aei/question-filters builds the request and checks everything
// it returns.

export const LLM_BASE = "/llm";
const STATUS_TIMEOUT_MS = 4_000;
const ASK_TIMEOUT_MS = 20_000;

export interface AiStatus {
  available: boolean;
  /** The model the server serves, when available. */
  model: string | null;
}

/**
 * Why a question got no answer (the UI shows `ai.error.<code>`):
 * off        no language model behind /llm
 * empty      nothing to ask
 * timeout    no answer within the time limit
 * busy       the model is loading or every slot is taken (HTTP 429/503)
 * network    the request failed (connection, proxy or Access error)
 * unreadable the reply was not usable JSON
 * aborted    the caller cancelled (show nothing)
 */
export type AiErrorCode = "off" | "empty" | "timeout" | "busy" | "network" | "unreadable" | "aborted";

export class AiError extends Error {
  readonly code: AiErrorCode;
  constructor(code: AiErrorCode, detail?: string) {
    super(detail ? `AI ${code}: ${detail}` : `AI ${code}`);
    this.name = "AiError";
    this.code = code;
  }
}

export interface AiOptions {
  /** Cancels the request (e.g. when a newer question replaces it). */
  signal?: AbortSignal;
  timeoutMs?: number;
  /** For tests. */
  fetch?: typeof fetch;
  base?: string;
}

export interface AiResult extends AiAnswer {
  model: string | null;
  /** Round trip in milliseconds. */
  ms: number;
}

let knownModel: string | null = null;
/** Which response_format the server accepted: 0 = json_schema, 1 = json_object with schema. */
let formatIndex = 0;

/** Forget the model found by aiStatus() (to check again after the model went away; also for tests). */
export function forgetAiStatus(): void {
  knownModel = null;
  formatIndex = 0;
}

/** An AbortSignal that fires on the caller's signal or after `ms`; `timedOut` tells the two apart. */
function deadline(ms: number, outer?: AbortSignal): { signal: AbortSignal; timedOut: () => boolean; done: () => void } {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, ms);
  const onAbort = () => controller.abort();
  if (outer?.aborted) controller.abort();
  else outer?.addEventListener("abort", onAbort, { once: true });
  return {
    signal: controller.signal,
    timedOut: () => timedOut,
    done: () => {
      clearTimeout(timer);
      outer?.removeEventListener("abort", onAbort);
    },
  };
}

/** Is the language model reachable? GET /llm/v1/models within 4 s. Never throws. */
export async function aiStatus(options: AiOptions = {}): Promise<AiStatus> {
  const doFetch = options.fetch ?? fetch;
  const d = deadline(options.timeoutMs ?? STATUS_TIMEOUT_MS, options.signal);
  try {
    const res = await doFetch(`${options.base ?? LLM_BASE}/v1/models`, { signal: d.signal, headers: { accept: "application/json" } });
    // Without the proxy the dev server answers with the app's HTML page, so the type matters.
    if (!res.ok || !(res.headers.get("content-type") ?? "").includes("json")) return { available: false, model: null };
    const body = (await res.json()) as { data?: { id?: unknown }[] };
    const ids = (body.data ?? []).map((m) => m.id).filter((id): id is string => typeof id === "string");
    const configured = res.headers.get("x-aei-model");
    const model = configured && (ids.length === 0 || ids.includes(configured)) ? configured : (ids[0] ?? configured ?? null);
    if (!model) return { available: false, model: null };
    knownModel = model;
    return { available: true, model };
  } catch {
    return { available: false, model: null };
  } finally {
    d.done();
  }
}

/**
 * A plain-language question (Finnish or English) turned into filters from
 * the feed's code lists. The period is resolved against `asOf` (the feed's
 * clock). Throws AiError.
 */
export async function askAi(text: string, lang: Lang, meta: FeedMeta, asOf: IsoDate, options: AiOptions = {}): Promise<AiResult> {
  const question = cleanQuestion(text);
  if (!question) throw new AiError("empty");
  if (options.signal?.aborted) throw new AiError("aborted");
  const doFetch = options.fetch ?? fetch;
  const base = options.base ?? LLM_BASE;
  const started = Date.now();

  if (!knownModel) {
    const status = await aiStatus({ ...options, timeoutMs: STATUS_TIMEOUT_MS });
    if (!status.available) throw new AiError(options.signal?.aborted ? "aborted" : "off");
  }

  const d = deadline(options.timeoutMs ?? ASK_TIMEOUT_MS, options.signal);
  try {
    let format = formatIndex as 0 | 1;
    for (let attempt = 0; attempt < 2; attempt++) {
      let res: Response;
      try {
        res = await doFetch(`${base}/v1/chat/completions`, {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify(chatRequest(question, lang, meta, knownModel, format)),
          signal: d.signal,
        });
      } catch (error) {
        if (d.timedOut()) throw new AiError("timeout");
        if (options.signal?.aborted) throw new AiError("aborted");
        throw new AiError("network", error instanceof Error ? error.message : undefined);
      }
      if (res.status === 429 || res.status === 503) throw new AiError("busy", String(res.status));
      // A server that rejects one response_format spelling gets the other once.
      if ((res.status === 400 || res.status === 422 || res.status === 500) && attempt === 0) {
        format = format === 0 ? 1 : 0;
        continue;
      }
      if (!res.ok)
        throw new AiError(res.status === 404 || res.status === 502 || res.status === 504 ? "off" : "network", String(res.status));
      let body: { choices?: { message?: { content?: unknown } }[] };
      try {
        body = (await res.json()) as typeof body;
      } catch {
        if (d.timedOut()) throw new AiError("timeout");
        if (options.signal?.aborted) throw new AiError("aborted");
        throw new AiError("unreadable", "body");
      }
      const content = body.choices?.[0]?.message?.content;
      const parsed = typeof content === "string" ? parseReply(content) : null;
      if (!parsed) throw new AiError("unreadable", "content");
      formatIndex = format;
      return { ...validateAnswer(parsed, meta, asOf, question), model: knownModel, ms: Date.now() - started };
    }
    throw new AiError("network", "response_format refused");
  } finally {
    d.done();
  }
}
