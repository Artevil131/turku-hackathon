import type { AiStatus } from "@aei/ask";
import { type AeiClient, ApiError, type AskResponse, type IsolateQuery, type Meta } from "@aei/contract";
import type { IsolateRecord } from "@aei/domain";
import type { Locale } from "@aei/i18n";
import { useCallback, useEffect, useRef, useState } from "react";

export type FilterChip = "ward" | "specimen" | "organism" | "sex" | "age" | "dates";

/** How often the page reads /api/meta again; the server itself probes the model every minute (D-049). */
const AI_RECHECK_MS = 30_000;

/** A server without `aiStatus` reports only whether a model is configured. */
const statusOf = (m: Meta): AiStatus => m.aiStatus ?? (m.ai ? "ready" : "off");

/**
 * The assistant's live status from /api/meta, read again every half minute, when the
 * tab comes back into view and on `recheck`, so it switches back on by itself when the
 * model returns. null until the first answer; "off" if the server cannot be read.
 */
export function useAiStatus(client: AeiClient): { status: AiStatus | null; recheck: () => void } {
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [nudge, setNudge] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `nudge` is the recheck trigger.
  useEffect(() => {
    let stale = false;
    const read = () => {
      client
        .meta()
        .then((m) => !stale && setStatus(statusOf(m)))
        .catch(() => !stale && setStatus((s) => s ?? "off"));
    };
    const onView = () => {
      if (document.visibilityState === "visible") read();
    };
    read();
    const timer = setInterval(onView, AI_RECHECK_MS);
    window.addEventListener("focus", onView);
    document.addEventListener("visibilitychange", onView);
    return () => {
      stale = true;
      clearInterval(timer);
      window.removeEventListener("focus", onView);
      document.removeEventListener("visibilitychange", onView);
    };
  }, [client, nudge]);
  return { status, recheck: useCallback(() => setNudge((n) => n + 1), []) };
}

/** Shared request lifecycle; invalidated requests cannot replace newer filters or replay data. */
export function useQuestion(
  client: AeiClient,
  ai: AiStatus | null,
  asOf: string | null,
  visible: IsolateQuery,
  apply: (filters: IsolateQuery) => void,
) {
  const [answer, setAnswer] = useState<AskResponse | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [loaded, setLoaded] = useState<{ stamp: string; records: IsolateRecord[]; error: boolean } | null>(null);
  const sequence = useRef(0);
  const baseline = useRef<IsolateQuery>({});
  const mounted = useRef(true);
  // A failure from before the model came back no longer applies.
  useEffect(() => {
    if (ai === "ready") setError(false);
  }, [ai]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      sequence.current++;
    };
  }, []);

  // Visible selectors remain authoritative when the user adjusts them after asking.
  const filters = answer ? { ...answer.filters, ...visible } : null;
  const key = JSON.stringify(filters);
  useEffect(() => {
    const query = JSON.parse(key) as IsolateQuery | null;
    if (!query || !asOf) return;
    let stale = false;
    const stamp = `${asOf}:${key}`;
    client
      .isolates(query)
      .then((result) => {
        if (!stale) setLoaded({ stamp, records: result.records, error: false });
      })
      .catch(() => {
        if (!stale) setLoaded({ stamp, records: [], error: true });
      });
    return () => {
      stale = true;
    };
    // The serialised query prevents refetches on unrelated UI renders.
  }, [client, key, asOf]);

  async function ask(text: string, lang: Locale) {
    const request = ++sequence.current;
    const before = visible;
    setPending(true);
    setError(false);
    try {
      const result = await client.ask(text, lang);
      if (!mounted.current || request !== sequence.current) return;
      baseline.current = before;
      apply(result.filters);
      setAnswer(result);
    } catch (cause) {
      if (!mounted.current || request !== sequence.current) return;
      if (cause instanceof ApiError && cause.status === 503) setDisabled(true);
      else setError(true);
    } finally {
      if (mounted.current && request === sequence.current) setPending(false);
    }
  }

  function remove(chip: FilterChip) {
    if (!answer) return;
    const next = { ...answer.filters };
    const keys: (keyof IsolateQuery)[] = chip === "age" ? ["ageMin", "ageMax"] : chip === "dates" ? ["from", "to"] : [chip];
    const restored: IsolateQuery = {};
    for (const key of keys) {
      delete next[key];
      if (key === "ward" || key === "specimen" || key === "organism") Object.assign(restored, { [key]: baseline.current[key] });
    }
    apply(restored);
    setAnswer({ ...answer, filters: next, ...(chip === "age" ? { ageGroup: undefined } : {}) });
  }

  const current = loaded?.stamp === `${asOf}:${key}` ? loaded : null;
  return {
    available: ai === "ready" && !disabled,
    /** A model is configured but does not answer right now. */
    offline: ai === "offline" && !disabled,
    answer: answer && filters ? { ...answer, filters } : null,
    parsed: answer,
    active: answer !== null,
    records: current?.records ?? [],
    loading: answer !== null && !current,
    loadError: current?.error ?? false,
    pending,
    error,
    ask,
    remove,
    clear: () => {
      sequence.current++;
      setPending(false);
      setAnswer(null);
      apply(answer?.filters.ward ? { ...baseline.current, ward: baseline.current.ward } : baseline.current);
    },
  };
}

export type Question = ReturnType<typeof useQuestion>;
