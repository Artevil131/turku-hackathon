import type { Alert } from "@aei/alerts";
import { useEffect, useMemo, useRef, useState } from "react";
import type { IsoDate, Result } from "../feed/types.ts";
import { toSignals } from "../model/alerts.ts";
import type { Signal } from "../model/types.ts";

/*
  useSignals(results, asOf, generation) -> { signals, signalsAsOf, signalsGen, pending }
  The server's alerts up to the clock (GET /api/alerts, the live set of
  D-014, D-020, D-021, D-031, grouped into incidents by D-034), shown as one
  signal per incident. Fetched again whenever the clock moves; while a new
  day is fetched the previous signals stay on screen (pending = true).
*/

export interface SignalsState {
  signals: readonly Signal[];
  /** The day `signals` were fetched for (null before the first answer). */
  signalsAsOf: IsoDate | null;
  /** The feed generation `signals` belong to (see useFeed). */
  signalsGen: number;
  pending: boolean;
}

interface Fetched {
  alerts: readonly Alert[];
  asOf: IsoDate | null;
  gen: number;
}

const NONE: Fetched = { alerts: [], asOf: null, gen: -1 };

export function useSignals(results: readonly Result[], asOf: IsoDate | null, generation: number, base = ""): SignalsState {
  const [fetched, setFetched] = useState<Fetched>(NONE);
  const [pending, setPending] = useState(false);
  const latest = useRef(0);

  useEffect(() => {
    if (!asOf) return;
    const id = ++latest.current;
    const ctrl = new AbortController();
    setPending(true);
    fetch(`${base}/api/alerts`, { signal: ctrl.signal })
      .then((res) => (res.ok ? (res.json() as Promise<{ asOf: IsoDate; alerts: Alert[] }>) : Promise.reject(new Error(String(res.status)))))
      .then((body) => {
        if (id !== latest.current) return;
        setFetched({ alerts: body.alerts, asOf: body.asOf, gen: generation });
        setPending(false);
      })
      .catch(() => {
        if (id === latest.current) setPending(false);
      });
    return () => ctrl.abort();
  }, [asOf, generation, base]);

  const signals = useMemo(() => toSignals(fetched.alerts, results), [fetched.alerts, results]);
  return { signals, signalsAsOf: fetched.asOf, signalsGen: fetched.gen, pending };
}
