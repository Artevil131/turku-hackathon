import type { Result } from "@aei/feed";
import type { Catalog } from "@aei/isolates";
import { detectSignals } from "@aei/signals";

// Runs deviation detection off the main thread (local.ts), so a week's jump
// in the demo (hundreds of daily tests) never freezes the screen. It keeps its
// own copy of the released results, append-only like the app's, so the
// engine's per-day cache extends instead of recomputing.

export type ToWorker =
  | { type: "load"; gen: number; results: Result[] }
  | { type: "append"; gen: number; results: Result[] }
  | { type: "compute"; id: number; gen: number; asOf: string; catalog: Catalog };

export type FromWorker =
  | { type: "signals"; id: number; gen: number; asOf: string; signals: ReturnType<typeof detectSignals>; ms: number }
  | { type: "error"; id: number; message: string };

let gen = -1;
let list: Result[] = [];

// Typed loosely: the app's tsconfig uses the DOM lib, not the webworker lib.
const scope = self as unknown as { onmessage: ((event: MessageEvent<ToWorker>) => void) | null; postMessage: (msg: FromWorker) => void };

scope.onmessage = (event: MessageEvent<ToWorker>) => {
  const msg = event.data;
  if (msg.type === "load") {
    gen = msg.gen;
    list = msg.results;
    return;
  }
  if (msg.type === "append") {
    if (msg.gen !== gen) return;
    list = list.concat(msg.results);
    return;
  }
  if (msg.gen !== gen) return;
  try {
    const t0 = performance.now();
    const signals = detectSignals(list, msg.asOf, msg.catalog);
    const reply: FromWorker = { type: "signals", id: msg.id, gen, asOf: msg.asOf, signals, ms: performance.now() - t0 };
    scope.postMessage(reply);
  } catch (err) {
    const reply: FromWorker = { type: "error", id: msg.id, message: err instanceof Error ? err.message : String(err) };
    scope.postMessage(reply);
  }
};
