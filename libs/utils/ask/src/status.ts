import type { LlmConfig } from "./llm.ts";

/**
 * Whether the assistant can answer now: "off" when no model is configured,
 * "offline" when one is configured but its server does not answer (the team's
 * model runs only while its job is up), "ready" when it answered.
 */
export type AiStatus = "off" | "offline" | "ready";

/**
 * One cheap request to the model server: GET /v1/models with the client's
 * headers. True only for a JSON model list, so a redirect to a sign-in page
 * or a tunnel error page counts as unreachable. Never throws.
 */
export async function probeLlm(cfg: LlmConfig, timeoutMs = 4_000): Promise<boolean> {
  try {
    const response = await (cfg.fetch ?? fetch)(`${cfg.baseUrl.replace(/\/+$/, "")}/v1/models`, {
      headers: { ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}), ...cfg.headers },
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return false;
    const body = (await response.json()) as { data?: unknown } | null;
    return Array.isArray(body?.data);
  } catch {
    return false;
  }
}

export interface AiMonitorOptions {
  /** Probes the model; leave out when no model is configured (status stays "off"). */
  probe?: () => Promise<boolean>;
  /** Time between probes once started; default 60 s. */
  intervalMs?: number;
  /** Called on every change of status. */
  onChange?: (status: AiStatus) => void;
}

export interface AiMonitor {
  status(): AiStatus;
  /** Probes now; calls made while a probe runs share it. */
  check(): Promise<AiStatus>;
  /** The status once the first probe has finished (at once when nothing is configured or probed yet). */
  settled(): Promise<AiStatus>;
  /** A real request to the model succeeded (ready at once) or failed (probe again now). */
  report(ok: boolean): Promise<AiStatus>;
  /** Probes now and then every `intervalMs`; the timer does not keep the process alive. */
  start(): void;
  stop(): void;
}

/**
 * The assistant's live status. Configured but not yet probed counts as
 * "offline": it is only "ready" after the model has answered.
 */
export function createAiMonitor({ probe, intervalMs = 60_000, onChange }: AiMonitorOptions = {}): AiMonitor {
  let current: AiStatus = probe ? "offline" : "off";
  let running: Promise<AiStatus> | undefined;
  let first: Promise<AiStatus> | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;

  function set(next: AiStatus) {
    if (next === current) return;
    current = next;
    onChange?.(next);
  }

  function check(): Promise<AiStatus> {
    if (!probe) return Promise.resolve(current);
    running ??= probe()
      .catch(() => false)
      .then((ok) => {
        set(ok ? "ready" : "offline");
        return current;
      })
      .finally(() => {
        running = undefined;
      });
    first ??= running;
    return running;
  }

  return {
    status: () => current,
    check,
    settled: () => first ?? Promise.resolve(current),
    report(ok) {
      if (!probe) return Promise.resolve(current);
      if (!ok) return check();
      set("ready");
      return Promise.resolve(current);
    },
    start() {
      if (!probe || timer) return;
      void check();
      timer = setInterval(() => void check(), intervalMs);
      timer.unref?.();
    },
    stop() {
      clearInterval(timer);
      timer = undefined;
    },
  };
}
