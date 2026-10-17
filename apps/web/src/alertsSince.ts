import type { AeiClient, Alert } from "@aei/contract";
import { useEffect, useRef, useState } from "react";
import { backoffDelay } from "./backoff.ts";

// Every alert from the dataset start up to the replay date, for the timeline's
// seismograph. One read on mount and again on each `reset`; live `alerts`
// events append. Kept apart from `useLive`, whose alert list is the last four
// weeks only.

/** Alerts dated from `start`, oldest first; empty until the first read. Needs the client; without it nothing is read. */
export function useAlertsSinceStart(client: AeiClient | undefined, start: string | undefined, asOf: string | undefined): Alert[] {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  // The newest date the store is known to cover; a replay date beyond it triggers a fresh read.
  const covered = useRef<string>("");
  const reread = useRef<(() => void) | null>(null);

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
          covered.current = r.asOf;
          setAlerts([...r.alerts].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)));
        })
        .catch(() => {
          if (closed || mine !== generation) return;
          timer = setTimeout(() => load(attempt + 1, mine), backoffDelay(attempt));
        });
    };
    load(0, generation);
    reread.current = () => load(0, ++generation);

    const close = client.live(
      (event) => {
        if (event.type === "reset") {
          setAlerts([]);
          covered.current = "";
          load(0, ++generation);
        } else if (event.type === "alerts") {
          if (event.to > covered.current) covered.current = event.to;
          setAlerts((list) => {
            const seen = new Set(list.map((a) => a.id));
            const fresh = event.alerts.filter((a) => !seen.has(a.id));
            return fresh.length ? [...list, ...fresh].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)) : list;
          });
        }
      },
      () => {},
    );
    return () => {
      closed = true;
      reread.current = null;
      close();
      if (timer) clearTimeout(timer);
    };
  }, [client, start]);

  // A seek forward may not send an alerts event for the span it skipped: read again when the date outruns the store.
  useEffect(() => {
    if (!client || !asOf || !covered.current || asOf <= covered.current) return;
    const timer = setTimeout(() => reread.current?.(), 400);
    return () => clearTimeout(timer);
  }, [client, asOf]);

  return alerts;
}
