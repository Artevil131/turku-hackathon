import type { AeiClient, Alert } from "@aei/contract";
import { useEffect, useMemo, useRef, useState } from "react";
import { backoffDelay } from "./backoff.ts";

// Every alert from the dataset start up to the replay date, for the timeline's
// seismograph. One read on mount and again after each reset; afterwards the
// app's single live stream (via `useLive`, whose list is the last four weeks)
// supplies what is new, so this hook opens no stream of its own.

const byDate = (a: Alert, b: Alert) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id);

export interface LiveAlerts {
  /** `useLive`'s alerts: the last four weeks, kept current by the stream. */
  alerts: Alert[];
  /** False while the live list is being read again (start, reset). */
  loaded: boolean;
  /** The newest date a stream `alerts` event covered. */
  to: string;
}

/** Alerts dated from `start`, oldest first; empty until the first read. Needs the client; without it nothing is read. */
export function useAlertsSinceStart(
  client: AeiClient | undefined,
  start: string | undefined,
  asOf: string | undefined,
  live: LiveAlerts,
): Alert[] {
  const [base, setBase] = useState<{ asOf: string; alerts: Alert[] } | null>(null);
  // Bumped when the live list restarts (a reset): the history is read again.
  const [round, setRound] = useState(0);
  const wasLoaded = useRef(live.loaded);
  const again = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (wasLoaded.current && !live.loaded) {
      setBase(null);
      setRound((n) => n + 1);
    }
    wasLoaded.current = live.loaded;
  }, [live.loaded]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `round` is the re-read trigger
  useEffect(() => {
    if (!client || !start) return;
    let closed = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let generation = 0;
    const load = (attempt: number, mine: number) => {
      client
        .alerts({ from: start })
        .then((r) => {
          if (closed || mine !== generation) return;
          setBase({ asOf: r.asOf, alerts: r.alerts });
        })
        .catch(() => {
          if (closed || mine !== generation) return;
          timer = setTimeout(() => load(attempt + 1, mine), backoffDelay(attempt));
        });
    };
    load(0, generation);
    again.current = () => load(0, ++generation);
    return () => {
      closed = true;
      again.current = null;
      if (timer) clearTimeout(timer);
    };
  }, [client, start, round]);

  // A seek forward may not send an alerts event for the span it skipped: read again when the date outruns the store.
  const known = live.to > (base?.asOf ?? "") ? live.to : (base?.asOf ?? "");
  useEffect(() => {
    if (!client || !asOf || !known || asOf <= known) return;
    const timer = setTimeout(() => again.current?.(), 400);
    return () => clearTimeout(timer);
  }, [client, asOf, known]);

  const liveList = live.alerts;
  return useMemo(() => {
    if (!base) return [];
    const seen = new Set(base.alerts.map((a) => a.id));
    const fresh = liveList.filter((a) => !seen.has(a.id));
    return [...base.alerts, ...fresh].sort(byDate);
  }, [base, liveList]);
}
