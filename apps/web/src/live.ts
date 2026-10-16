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

export function useLive(baseUrl = "") {
  const client: AeiClient = useMemo(() => createAeiClient({ baseUrl }), [baseUrl]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [clock, setClock] = useState<ClockState | null>(null);
  const [connection, setConnection] = useState<Connection>("connecting");
  const [findings, setFindings] = useState<Finding[]>([]);
  // Every isolate of the loaded period, flagged or not, for spread counts.
  const [records, setRecords] = useState<IsolateRecord[]>([]);
  // Alerts that need no statistics (D-014) and the relation layers for the last four weeks (D-013).
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [relations, setRelations] = useState<RelationsResponse | null>(null);
  const [lastArrivals, setLastArrivals] = useState<{ to: string; count: number } | null>(null);
  const retry = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadBacklog = useCallback(
    async (asOf: string) => {
      const [{ records }, recent] = await Promise.all([
        client.isolates({ from: shift(asOf, -BACKLOG_DAYS) }),
        client.alerts({ from: shift(asOf, 1 - BACKLOG_DAYS) }),
      ]);
      setRecords(records);
      setAlerts(recent.alerts);
      setFindings(toFindings(records, shift(asOf, -UNSEEN_DAYS)).slice(0, MAX_FINDINGS));
    },
    [client],
  );

  useEffect(() => {
    let closed = false;
    let close: (() => void) | null = null;

    async function connect() {
      try {
        const [m, c] = await Promise.all([client.meta(), client.clock()]);
        if (closed) return;
        setMeta(m);
        setClock(c);
        await loadBacklog(c.asOf);
        if (closed) return;
        close = client.live(
          (event) => {
            setConnection("open");
            if (event.type === "clock") setClock(event.clock);
            if (event.type === "reset") {
              setClock(event.clock);
              void loadBacklog(event.clock.asOf);
            }
            if (event.type === "arrivals") {
              setLastArrivals({ to: event.to, count: event.records.length });
              const cutoff = shift(event.to, -BACKLOG_DAYS);
              setRecords((list) => [...list.filter((r) => r.sampleDate > cutoff), ...event.records]);
              const fresh = toFindings(event.records, null);
              if (fresh.length) setFindings((list) => [...fresh, ...list].slice(0, MAX_FINDINGS));
            }
            if (event.type === "alerts") {
              const cutoff = shift(event.to, 1 - BACKLOG_DAYS);
              setAlerts((list) => [...event.alerts, ...list.filter((a) => a.date >= cutoff)]);
            }
          },
          () => setConnection("offline"),
        );
      } catch {
        if (closed) return;
        setConnection("offline");
        retry.current = setTimeout(connect, 4000);
      }
    }

    void connect();
    return () => {
      closed = true;
      close?.();
      if (retry.current) clearTimeout(retry.current);
    };
  }, [client, loadBacklog]);

  const asOf = clock?.asOf;
  useEffect(() => {
    if (!asOf) return;
    let stale = false;
    client
      .relations({ days: RELATION_DAYS })
      .then((r) => {
        if (!stale) setRelations(r);
      })
      .catch(() => setConnection("offline"));
    return () => {
      stale = true;
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

  return { meta, clock, connection, findings, records, alerts, relations, lastArrivals, command, acknowledge };
}
