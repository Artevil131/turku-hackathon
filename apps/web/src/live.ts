import {
  type AeiClient,
  type Alert,
  type ClockCommand,
  type ClockState,
  createAeiClient,
  type Meta,
  type RelationsResponse,
} from "@aei/contract";
import type { IsolateRecord, Phenotype } from "@aei/domain";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { backoffDelay } from "./backoff.ts";

// Connects the web app to the AEI server through the shared contract
// client. Isolates carrying a resistant phenotype become findings that stay
// unseen until someone marks them seen. On connect, the last four weeks are
// loaded so the list is never empty on arrival; findings from the last
// three days start unseen.

export type Connection = "connecting" | "open" | "offline";

export interface Finding {
  id: string;
  phenotype: Phenotype;
  record: IsolateRecord;
  arrivedAt: string;
  seen: boolean;
}

const BACKLOG_DAYS = 28;
const UNSEEN_DAYS = 3;
const MAX_FINDINGS = 200;
const RELATION_DAYS = 28;

const shift = (iso: string, days: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

function toFindings(records: IsolateRecord[], seenBefore: string | null): Finding[] {
  return records
    .flatMap((record) =>
      record.phenotypes.map((phenotype) => ({
        id: `${record.isolateId}:${phenotype}`,
        phenotype,
        record,
        arrivedAt: record.sampleDate,
        seen: seenBefore !== null && record.sampleDate < seenBefore,
      })),
    )
    .sort((a, b) => (a.arrivedAt < b.arrivedAt ? 1 : a.arrivedAt > b.arrivedAt ? -1 : 0));
}

// The backend's origin comes from the environment so the web app can sit in
// front of a separately deployed API container; empty means same origin
// (the Vite dev server proxies /api).
const API_BASE_URL: string = import.meta.env.VITE_AEI_API_URL ?? "";

export function useLive(baseUrl = API_BASE_URL) {
  const client: AeiClient = useMemo(() => createAeiClient({ baseUrl }), [baseUrl]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [clock, setClock] = useState<ClockState | null>(null);
  const [connection, setConnection] = useState<Connection>("connecting");
  const [findings, setFindings] = useState<Finding[]>([]);
  // Every isolate of the loaded period, flagged or not, for spread counts.
  const [records, setRecords] = useState<IsolateRecord[]>([]);
  // Alerts that need no statistics (D-014) and the relation layers for the last four weeks (D-013).
  const [alerts, setAlerts] = useState<Alert[]>([]);
  // False until the alerts of the current clock date have been read, so "no alerts" and "not loaded" differ.
  const [alertsLoaded, setAlertsLoaded] = useState(false);
  // The newest date an `alerts` stream event covered; the timeline's history reads again only when the date outruns it.
  const [alertsTo, setAlertsTo] = useState<string>("");
  const [relations, setRelations] = useState<RelationsResponse | null>(null);
  const [lastArrivals, setLastArrivals] = useState<{ to: string; count: number } | null>(null);
  // Bumped to run the whole connection again (the browser came back online).
  const [reconnects, setReconnects] = useState(0);
  const metaLoaded = useRef(false);
  const backlogGeneration = useRef(0);

  // The browser's own network state: go offline at once, reconnect when it returns.
  useEffect(() => {
    const down = () => setConnection("offline");
    const up = () => setReconnects((n) => n + 1);
    window.addEventListener("offline", down);
    window.addEventListener("online", up);
    return () => {
      window.removeEventListener("offline", down);
      window.removeEventListener("online", up);
    };
  }, []);

  // `reconnects` is read only to re-run the effect.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reconnects restarts the connection on purpose
  useEffect(() => {
    let closed = false;
    let close: (() => void) | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, ms);
      });

    // Retries one read with backoff until it works, the backlog is replaced by a newer one, or the hook closes.
    async function retrying<T>(read: () => Promise<T>, apply: (v: T) => void, generation: number) {
      for (let attempt = 0; ; attempt++) {
        try {
          const v = await read();
          if (!closed && generation === backlogGeneration.current) apply(v);
          return;
        } catch {
          await wait(backoffDelay(attempt));
          if (closed || generation !== backlogGeneration.current) return;
        }
      }
    }

    // The isolates and the alerts load and retry on their own: one failing leaves the other working.
    function loadBacklog(asOf: string) {
      const generation = ++backlogGeneration.current;
      setAlerts([]);
      setAlertsTo("");
      setAlertsLoaded(false);
      void retrying(
        () => client.isolates({ from: shift(asOf, -BACKLOG_DAYS) }),
        ({ records }) => {
          setRecords(records);
          setFindings(toFindings(records, shift(asOf, -UNSEEN_DAYS)).slice(0, MAX_FINDINGS));
        },
        generation,
      );
      void retrying(
        () => client.alerts({ from: shift(asOf, 1 - BACKLOG_DAYS) }),
        (recent) => {
          setAlerts(recent.alerts);
          setAlertsLoaded(true);
        },
        generation,
      );
    }

    function openStream() {
      close?.();
      close = client.live(
        (event) => {
          setConnection("open");
          if (event.type === "clock") setClock(event.clock);
          if (event.type === "reset") {
            setClock(event.clock);
            loadBacklog(event.clock.asOf);
          }
          if (event.type === "arrivals") {
            setLastArrivals({ to: event.to, count: event.records.length });
            const cutoff = shift(event.to, -BACKLOG_DAYS);
            setRecords((list) => [...list.filter((r) => r.sampleDate > cutoff), ...event.records]);
            const fresh = toFindings(event.records, null);
            if (fresh.length) setFindings((list) => [...fresh, ...list].slice(0, MAX_FINDINGS));
          }
          if (event.type === "alerts") {
            setAlertsTo(event.to);
            const cutoff = shift(event.to, 1 - BACKLOG_DAYS);
            setAlerts((list) => [...event.alerts, ...list.filter((a) => a.date >= cutoff)]);
          }
        },
        () => setConnection("offline"),
      );
    }

    // The server must answer meta and the clock; everything else retries without a banner.
    async function connect() {
      for (let attempt = 0; !closed; attempt++) {
        try {
          const [m, c] = await Promise.all([client.meta(), client.clock()]);
          if (closed) return;
          setMeta(m);
          setClock(c);
          metaLoaded.current = true;
          loadBacklog(c.asOf);
          // The HTTP API answered, so the controls work; the stream's first event may lag behind a proxy.
          setConnection("open");
          openStream();
          return;
        } catch {
          if (closed) return;
          setConnection("offline");
          await wait(backoffDelay(attempt));
        }
      }
    }

    void connect();
    return () => {
      closed = true;
      close?.();
      if (timer) clearTimeout(timer);
    };
  }, [client, reconnects]);

  // While offline after a first connection, ask the clock now and then: a paused clock sends no stream event
  // that could clear the banner, and a failed command leaves no other way back.
  useEffect(() => {
    if (connection !== "offline" || !metaLoaded.current) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    const probe = () => {
      client
        .clock()
        .then((c) => {
          if (stopped) return;
          setClock(c);
          setConnection("open");
        })
        .catch(() => {
          if (stopped) return;
          timer = setTimeout(probe, backoffDelay(attempt++));
        });
    };
    timer = setTimeout(probe, backoffDelay(attempt++));
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [client, connection]);

  // The relation layers are secondary: a failure retries quietly and never raises the offline banner.
  const asOf = clock?.asOf;
  useEffect(() => {
    if (!asOf) return;
    let stale = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const load = (attempt: number) => {
      client
        .relations({ days: RELATION_DAYS })
        .then((r) => {
          if (!stale) setRelations(r);
        })
        .catch(() => {
          if (!stale) timer = setTimeout(() => load(attempt + 1), backoffDelay(attempt));
        });
    };
    load(0);
    return () => {
      stale = true;
      if (timer) clearTimeout(timer);
    };
  }, [client, asOf]);

  const command = useCallback(
    (c: ClockCommand) =>
      client
        .command(c)
        .then(setClock)
        .catch(() => setConnection("offline")),
    [client],
  );

  const acknowledge = useCallback((ids: string[]) => {
    const set = new Set(ids);
    setFindings((list) => list.map((f) => (set.has(f.id) ? { ...f, seen: true } : f)));
  }, []);

  // The last date the server confirmed: what the offline banner says the results are as of.
  const lastGoodAsOf = clock?.asOf ?? null;

  return {
    client,
    meta,
    clock,
    connection,
    findings,
    records,
    alerts,
    alertsLoaded,
    alertsTo,
    relations,
    lastArrivals,
    lastGoodAsOf,
    command,
    acknowledge,
  };
}
