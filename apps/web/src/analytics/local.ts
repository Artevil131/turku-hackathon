import { coverage, monthly, reportMatrix, reportTable } from "@aei/empiric";
import type { Result } from "@aei/feed";
import { detectSignals, type Signal } from "@aei/signals";
import type { FromWorker, ToWorker } from "./signals.worker.ts";
import { type AnalyticsSource, type Released, Superseded, type SyncAnalytics } from "./types.ts";

/*
  The analysis in this browser: the gears run on the results useFeed holds.
  Coverage, monthly series and report tables are computed during render
  (`sync`), exactly as the screens did before; the gears keep their own caches
  (the first-isolate index and per-results contexts in @aei/empiric, the
  per-day hits in @aei/signals). Signals run in a Web Worker so a week's jump
  in the demo never freezes the screen; without workers (or when the worker
  fails) they run on the main thread, deferred one tick so the frame paints
  first.
*/

const sync: SyncAnalytics = {
  coverage: (at, query, rank) => coverage(at.results, at.asOf, query, at.catalog, { rank }),
  monthly: (at, query, antibiotic, months) => monthly(at.results, at.asOf, query, antibiotic, months, at.catalog),
  reportTable: (at, query) => reportTable(at.results, at.asOf, query, at.catalog),
  reportMatrix: (at, query, days) => reportMatrix(at.results, at.asOf, query, at.catalog, days),
};

/** Runs a synchronous answer as a promise (errors become rejections). */
function now<T>(compute: () => T): Promise<T> {
  try {
    return Promise.resolve(compute());
  } catch (err) {
    return Promise.reject(err);
  }
}

// ---------- Signals: one worker for the session ----------

interface Request {
  at: Released;
  resolve: (signals: Signal[]) => void;
  reject: (err: unknown) => void;
}

/** What the worker holds: the generation, how many results, and the first one (to notice a replaced array). */
interface Sent {
  gen: number;
  count: number;
  first: Result | undefined;
}

const NOTHING_SENT: Sent = { gen: -1, count: 0, first: undefined };

/** Every worker started in this module, so a dev hot reload can stop them (a session otherwise keeps its one worker). */
const workers = new Set<Worker>();
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    for (const w of workers) w.terminate();
    workers.clear();
  });
}

function signalRunner() {
  let worker: Worker | null = null;
  let broken = false;
  let sent: Sent = NOTHING_SENT;
  let lastId = 0;
  const waiting = new Map<number, Request>();

  function start(): Worker | null {
    if (worker || broken) return worker;
    if (typeof Worker === "undefined") {
      broken = true;
      return null;
    }
    let w: Worker;
    try {
      w = new Worker(new URL("./signals.worker.ts", import.meta.url), { type: "module" });
    } catch {
      broken = true;
      return null;
    }
    w.onmessage = (event: MessageEvent<FromWorker>) => {
      const msg = event.data;
      const req = waiting.get(msg.id);
      if (!req) return;
      waiting.delete(msg.id);
      if (msg.type === "error") req.reject(new Error(msg.message));
      else req.resolve(msg.signals);
    };
    w.onerror = () => {
      // Fall back to the main thread and redo the latest request there; older ones are superseded.
      broken = true;
      worker = null;
      sent = NOTHING_SENT;
      w.terminate();
      workers.delete(w);
      const pending = [...waiting];
      waiting.clear();
      for (const [id, req] of pending) {
        if (id === lastId) onMainThread(id, req);
        else req.reject(new Superseded());
      }
    };
    worker = w;
    workers.add(w);
    return w;
  }

  function onMainThread(id: number, req: Request): void {
    globalThis.setTimeout(() => {
      if (id !== lastId) {
        req.reject(new Superseded());
        return;
      }
      try {
        req.resolve(detectSignals(req.at.results, req.at.asOf, req.at.catalog));
      } catch (err) {
        req.reject(err);
      }
    }, 0);
  }

  return (at: Released, generation: number): Promise<Signal[]> =>
    new Promise<Signal[]>((resolve, reject) => {
      const id = ++lastId;
      const req: Request = { at, resolve, reject };
      const w = start();
      if (!w) {
        onMainThread(id, req);
        return;
      }
      const { results, asOf, catalog } = at;
      const msgs: ToWorker[] = [];
      if (sent.gen !== generation || results.length < sent.count || results[0] !== sent.first) {
        msgs.push({ type: "load", gen: generation, results: results as Result[] });
      } else if (results.length > sent.count) {
        msgs.push({ type: "append", gen: generation, results: results.slice(sent.count) });
      }
      msgs.push({ type: "compute", id, gen: generation, asOf, catalog: { units: catalog.units, antibiotics: catalog.antibiotics } });
      waiting.set(id, req);
      for (const m of msgs) w.postMessage(m);
      sent = { gen: generation, count: results.length, first: results[0] };
    });
}

/** The analysis in this browser (the default). */
export function localSource(): AnalyticsSource {
  const signals = signalRunner();
  return {
    where: "browser",
    sync,
    coverage: (at, query, rank) => now(() => sync.coverage(at, query, rank)),
    monthly: (at, query, antibiotic, months) => now(() => sync.monthly(at, query, antibiotic, months)),
    signals,
    reportTable: (at, query) => now(() => sync.reportTable(at, query)),
    reportMatrix: (at, query, days) => now(() => sync.reportMatrix(at, query, days)),
  };
}
