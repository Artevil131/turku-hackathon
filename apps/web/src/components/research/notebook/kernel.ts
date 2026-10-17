import { useSyncExternalStore } from "react";

// The page's Python kernel (D-077): one Pyodide worker for the whole page, started by the first Run, so variables
// carry from cell to cell. Holds each code cell's live outputs; parses what the worker sends (a DataFrame's HTML
// into rows, a traceback into its last line). Stop ends the worker: Pyodide can only be interrupted in place when
// the page is cross-origin isolated, which it is not, so the next Run starts a fresh Python.

export type Output =
  | { kind: "stream"; text: string }
  | { kind: "result"; text: string }
  | { kind: "table"; html: string; rows: number; cols: number }
  | { kind: "image"; png: string }
  | { kind: "error"; traceback: string };

export type KernelIn = { type: "init"; origin: string } | { type: "run"; id: string; code: string };
export type KernelOut =
  | { type: "phase"; phase: "ready" | "failed"; error?: string }
  | { type: "start"; id: string }
  | { type: "out"; id: string; output: Output }
  | { type: "done"; id: string; ok: boolean };

export type Phase = "off" | "starting" | "ready" | "failed";
export type RunStatus = "queued" | "running" | "done" | "stopped";
export interface CellRun {
  status: RunStatus;
  ok: boolean;
  outputs: Output[];
}
export interface KernelState {
  phase: Phase;
  /** Date.now() when the current start began. */
  since: number;
  error: string;
  runs: Readonly<Record<string, CellRun>>;
}

interface WorkerLike {
  postMessage(m: KernelIn): void;
  terminate(): void;
  onmessage: ((e: MessageEvent<KernelOut>) => void) | null;
  onerror: ((e: ErrorEvent) => void) | null;
}

/** Where `aei.connect` reaches the API from the kernel: the configured API, else this page's origin (the proxy). */
export const apiOrigin = () => (import.meta.env?.VITE_AEI_API_URL || globalThis.location?.origin || "").replace(/\/$/, "");

export function createKernel(makeWorker: () => WorkerLike, origin: () => string = () => globalThis.location?.origin ?? "") {
  let state: KernelState = { phase: "off", since: 0, error: "", runs: {} };
  let worker: WorkerLike | null = null;
  const waiting = new Map<string, (r: CellRun) => void>();
  const listeners = new Set<() => void>();
  const set = (next: Partial<KernelState>) => {
    state = { ...state, ...next };
    for (const l of listeners) l();
  };
  const patchRun = (id: string, fn: (r: CellRun) => CellRun) => {
    const r = state.runs[id];
    if (r) set({ runs: { ...state.runs, [id]: fn(r) } });
  };
  const settle = (id: string) => {
    const r = state.runs[id];
    const resolve = waiting.get(id);
    waiting.delete(id);
    if (r && resolve) resolve(r);
  };

  function start() {
    if (worker) return;
    const w = makeWorker();
    worker = w;
    set({ phase: "starting", since: Date.now(), error: "" });
    w.onmessage = (e) => {
      if (w !== worker) return;
      const m = e.data;
      if (m.type === "phase") {
        set({ phase: m.phase, error: m.error ?? "" });
        if (m.phase === "failed") stopAll("done");
      } else if (m.type === "start") patchRun(m.id, (r) => ({ ...r, status: "running" }));
      else if (m.type === "out") patchRun(m.id, (r) => ({ ...r, outputs: [...r.outputs, m.output] }));
      else {
        patchRun(m.id, (r) => ({ ...r, status: "done", ok: m.ok }));
        settle(m.id);
      }
    };
    w.onerror = (e) => {
      if (w !== worker) return;
      set({ phase: "failed", error: e.message || "the worker stopped" });
      stopAll("done");
    };
    w.postMessage({ type: "init", origin: origin() });
  }

  /** Ends every queued and running cell with `status`. */
  function stopAll(status: RunStatus) {
    const runs = { ...state.runs };
    for (const [id, r] of Object.entries(runs)) if (r.status === "queued" || r.status === "running") runs[id] = { ...r, status };
    set({ runs });
    for (const id of [...waiting.keys()]) settle(id);
  }

  function kill() {
    worker?.terminate();
    worker = null;
  }

  return {
    getState: () => state,
    subscribe(l: () => void) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    start,
    /** Queues `code` for cell `id`; resolves with the finished run (or the stopped one). */
    run(id: string, code: string): Promise<CellRun> {
      if (state.phase === "failed") kill();
      start();
      waiting.get(id)?.(state.runs[id] as CellRun);
      set({ runs: { ...state.runs, [id]: { status: "queued", ok: false, outputs: [] } } });
      return new Promise((resolve) => {
        waiting.set(id, resolve);
        worker?.postMessage({ type: "run", id, code });
      });
    },
    /** Stops whatever runs; Python's state is lost (see the note above). */
    interrupt() {
      kill();
      stopAll("stopped");
      set({ phase: "off" });
    },
    restart() {
      kill();
      stopAll("stopped");
      set({ phase: "off", runs: {} });
      start();
    },
  };
}

export type Kernel = ReturnType<typeof createKernel>;

export const kernel = createKernel(
  () => new Worker(new URL("./kernel.worker.ts", import.meta.url), { type: "module" }) as unknown as WorkerLike,
);

export function useKernel(): KernelState {
  return useSyncExternalStore(kernel.subscribe, kernel.getState, kernel.getState);
}

// ---------- parsing what the worker sends ----------

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", nbsp: " " };
const decode = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? Number.parseInt(e.slice(2), 16) : Number(e.slice(1));
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
const cellsOf = (tr: string) =>
  [...tr.matchAll(/<(t[hd])\b[^>]*>([\s\S]*?)<\/\1>/gi)].map((c) => decode((c[2] ?? "").replace(/<[^>]*>/g, "")).trim());

/** pandas' `to_html` as text only: the header rows and the body rows, each a list of cell texts (index first). */
export function parseTable(html: string): { head: string[][]; body: string[][] } {
  const part = (tag: string) => {
    const m = html.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
    return m ? [...(m[1] ?? "").matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((tr) => cellsOf(tr[1] ?? "")) : [];
  };
  return { head: part("thead"), body: part("tbody") };
}

/** "ZeroDivisionError: division by zero": a traceback's last non-empty line. */
export function lastLine(traceback: string): string {
  const lines = traceback.split("\n").filter((l) => l.trim());
  return (lines[lines.length - 1] ?? "").trim();
}

/** A run's outputs as the text the page keeps (figures are not kept). */
export function outputText(outputs: readonly Output[]): string {
  const parts: string[] = [];
  for (const o of outputs) {
    if (o.kind === "stream") parts.push(o.text.replace(/\n$/, ""));
    else if (o.kind === "result") parts.push(o.text);
    else if (o.kind === "error") parts.push(lastLine(o.traceback));
    else if (o.kind === "table") {
      const { head, body } = parseTable(o.html);
      parts.push([...head, ...body].map((r) => r.join("\t")).join("\n"));
    }
  }
  return parts.join("\n");
}
