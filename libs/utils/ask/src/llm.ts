export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmConfig {
  baseUrl: string;
  model: string;
  apiKey?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

export interface Llm {
  json<T>(messages: ChatMessage[], schema: { name: string; schema: object }): Promise<T>;
}

export class LlmError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "LlmError";
  }
}

/** An OpenAI-compatible JSON-schema client for llama-server (Node >=22). */
export function createLlm(cfg: LlmConfig): Llm {
  return {
    async json<T>(messages: ChatMessage[], schema: { name: string; schema: object }): Promise<T> {
      try {
        const response = await (cfg.fetch ?? fetch)(`${cfg.baseUrl.replace(/\/+$/, "")}/v1/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}),
          },
          signal: AbortSignal.timeout(cfg.timeoutMs ?? 20_000),
          body: JSON.stringify({
            model: cfg.model,
            messages,
            temperature: 0,
            response_format: { type: "json_schema", json_schema: { ...schema, strict: true } },
            chat_template_kwargs: { enable_thinking: false },
          }),
        });
        if (!response.ok) throw new LlmError(`LLM HTTP ${response.status}`);
        const body: unknown = await response.json();
        const content = (body as { choices?: { message?: { content?: unknown } }[] } | null)?.choices?.[0]?.message?.content;
        if (typeof content !== "string") throw new LlmError("LLM response has no message content");
        return JSON.parse(content) as T;
      } catch (cause) {
        if (cause instanceof LlmError) throw cause;
        throw new LlmError("LLM request failed or returned invalid JSON", { cause });
      }
    },
  };
}

/** Read lazily: importing this module does not access Node's process global. */
export function llmConfigFromEnv(env: Record<string, string | undefined> = process.env): LlmConfig | undefined {
  if (!env.AEI_LLM_URL) return undefined;
  return { baseUrl: env.AEI_LLM_URL, model: env.AEI_LLM_MODEL ?? "", apiKey: env.AEI_LLM_KEY };
}
