import { type AeiClient, ApiError, type AskResponse, type IsolateQuery } from "@aei/contract";
import type { IsolateRecord } from "@aei/domain";
import type { Locale } from "@aei/i18n";
import { useEffect, useRef, useState } from "react";

export type FilterChip = "ward" | "specimen" | "organism" | "sex" | "age" | "dates";

/** Shared request lifecycle; invalidated requests cannot replace newer filters or replay data. */
export function useQuestion(
  client: AeiClient,
  enabled: boolean,
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
    available: enabled && !disabled,
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
