import { useEffect, useRef, useState } from "react";
import { detectSignals } from "../engine/signals.ts";
import type { Catalog, Signal } from "../engine/types.ts";
import type { IsoDate, Result } from "../feed/types.ts";
import type { FromWorker, ToWorker } from "./signals.worker.ts";

/*
  useSignals(results, asOf, generation, catalog) -> { signals, signalsAsOf, signalsGen, pending }
  The same data flow as useMemo(() => detectSignals(results, asOf, catalog)),
  computed in a Web Worker. While a new day is being checked the previous
  signals stay on screen (pending = true). Falls back to the main thread when
  workers are unavailable.
*/

export interface SignalsState {
  signals: readonly Signal[];
  /** The day `signals` were computed for (null before the first result). */
  signalsAsOf: IsoDate | null;
  /** The feed generation `signals` belong to (see useFeed). */
  signalsGen: number;
  pending: boolean;
}

const EMPTY: readonly Signal[] = [];

export function useSignals(results: readonly Result[], asOf: IsoDate | null, generation: number, catalog: Catalog | null): SignalsState {
  const [state, setState] = useState<SignalsState>({ signals: EMPTY, signalsAsOf: null, signalsGen: -1, pending: false });
  const worker = useRef<Worker | null>(null);
  const broken = useRef(false);
  const sent = useRef<{ gen: number; count: number; first: Result | undefined }>({ gen: -1, count: 0, first: undefined });
  const lastId = useRef(0);
  const applied = useRef(0);
  const [fallback, setFallback] = useState(0);

  // Start the worker once.
  useEffect(() => {
    if (typeof Worker === "undefined") {
      broken.current = true;
      return;
    }
    let w: Worker;
    try {
      w = new Worker(new URL("./signals.worker.ts", import.meta.url), { type: "module" });
    } catch {
      broken.current = true;
      return;
    }
    w.onmessage = (event: MessageEvent<FromWorker>) => {
      const msg = event.data;
      if (msg.id < applied.current) return; // an older answer arriving late
      applied.current = msg.id;
      if (msg.type === "error") {
        setState((s) => ({ ...s, pending: msg.id < lastId.current }));
        return;
      }
      setState({ signals: msg.signals, signalsAsOf: msg.asOf, signalsGen: msg.gen, pending: msg.id < lastId.current });
    };
    w.onerror = () => {
      // Fall back to the main thread and redo the last request there.
      broken.current = true;
      worker.current = null;
      sent.current = { gen: -1, count: 0, first: undefined };
      w.terminate();
      setFallback((f) => f + 1);
    };
    worker.current = w;
    return () => {
      w.terminate();
      worker.current = null;
      sent.current = { gen: -1, count: 0, first: undefined };
    };
  }, []);

  useEffect(() => {
    if (!asOf || !catalog) return;
    const id = ++lastId.current;
    const w = worker.current;
    if (w && !broken.current) {
      const s = sent.current;
      const msgs: ToWorker[] = [];
      if (s.gen !== generation || results.length < s.count || results[0] !== s.first) {
        msgs.push({ type: "load", gen: generation, results: results as Result[] });
      } else if (results.length > s.count) {
        msgs.push({ type: "append", gen: generation, results: results.slice(s.count) });
      }
      msgs.push({ type: "compute", id, gen: generation, asOf, catalog: { units: catalog.units, antibiotics: catalog.antibiotics } });
      for (const m of msgs) w.postMessage(m);
      sent.current = { gen: generation, count: results.length, first: results[0] };
      setState((st) => (st.pending ? st : { ...st, pending: true }));
      return;
    }
    // Main-thread fallback, deferred one tick so the frame paints first.
    setState((st) => (st.pending ? st : { ...st, pending: true }));
    const timer = window.setTimeout(() => {
      if (id !== lastId.current) return;
      const signals = detectSignals(results, asOf, catalog);
      applied.current = id;
      setState({ signals, signalsAsOf: asOf, signalsGen: generation, pending: false });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [results, asOf, generation, catalog, fallback]);

  return state;
}
