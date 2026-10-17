import type { AeiClient, Alert } from "@aei/contract";
import { useEffect, useMemo, useState } from "react";
import { groupIncidents, type Incident, shift } from "./model.ts";

// The alerts of the last 365 days, grouped into incidents. One fetch per
// clock move; the board owns it so the list, the math panel and the map
// read the same incidents.

export const WINDOW_DAYS = 365;

export type IncidentLoad = { status: "loading" } | { status: "error" } | { status: "ready"; asOf: string; alerts: Alert[] };

export function useIncidents(client: AeiClient, asOf: string | null) {
  const [load, setLoad] = useState<IncidentLoad>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` is the retry trigger.
  useEffect(() => {
    if (!asOf) return;
    let stale = false;
    setLoad((l) => (l.status === "ready" ? l : { status: "loading" }));
    client
      .alerts({ from: shift(asOf, -WINDOW_DAYS) })
      .then((r) => !stale && setLoad({ status: "ready", asOf: r.asOf, alerts: r.alerts }))
      .catch(() => !stale && setLoad({ status: "error" }));
    return () => {
      stale = true;
    };
  }, [client, asOf, attempt]);
  const incidents = useMemo<Incident[]>(() => (load.status === "ready" ? groupIncidents(load.alerts) : []), [load]);
  return { load, incidents, retry: () => setAttempt((n) => n + 1) };
}
