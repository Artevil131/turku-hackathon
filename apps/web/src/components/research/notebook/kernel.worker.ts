// The notebook's Python kernel: Pyodide in a Web Worker, so a long cell never freezes the page. Pyodide comes from
// the CDN version the Reproduce window's JupyterLite build pins, and `aei` from that build's wheel (/notebook/pypi),
// so the browser caches one copy of each. urllib goes through a synchronous XHR, so `aei.connect(url)` reads the API.
// Messages: in {init, origin} and {run, id, code}; out {phase}, {out, id, output} and {done, id, ok}.

import type { KernelIn, KernelOut, Output } from "./kernel.ts";

/** jupyterlite-pyodide-kernel 0.8.6 (apps/notebook/uv.lock) loads this Pyodide. */
const PYODIDE = "https://cdn.jsdelivr.net/pyodide/v314.0.6/full/pyodide.mjs";

interface Pyodide {
  loadPackage(names: string[], opts?: { messageCallback?: (m: string) => void }): Promise<unknown>;
  loadPackagesFromImports(code: string, opts?: { messageCallback?: (m: string) => void }): Promise<unknown>;
  runPython(code: string, opts?: { globals?: unknown }): unknown;
  runPythonAsync(code: string, opts?: { globals?: unknown }): Promise<unknown>;
  setStdout(o: { batched: (s: string) => void }): void;
  setStderr(o: { batched: (s: string) => void }): void;
  globals: { get(name: string): unknown };
  toPy(v: unknown): unknown;
}

const scope = self as unknown as { postMessage(m: KernelOut): void; onmessage: ((e: MessageEvent<KernelIn>) => void) | null };
const post = (m: KernelOut) => scope.postMessage(m);
/** Pyodide's "Loading pandas…" lines are not the cell's output. */
const quiet = () => {};

// Runs in a namespace of its own; the researcher's variables live in Pyodide's globals.
const HELPER = `
import base64, io, os, sys, traceback, warnings
os.environ["MPLBACKEND"] = "AGG"
warnings.filterwarnings("ignore", message=".*non-interactive.*")
from pyodide.code import eval_code_async

def _urlopen(req, data=None, timeout=None):
    # urllib over a synchronous XMLHttpRequest (allowed in a worker), so aei.connect(url) reads the API.
    from js import XMLHttpRequest
    from urllib.error import HTTPError
    from urllib.request import Request
    if not isinstance(req, Request):
        req = Request(req, data)
    x = XMLHttpRequest.new()
    x.open(req.get_method(), req.full_url, False)
    for k, v in req.header_items():
        x.setRequestHeader(k, v)
    x.send(req.data.decode() if isinstance(req.data, bytes) else req.data)
    body = io.BytesIO(str(x.responseText).encode())
    if x.status >= 400 or x.status == 0:
        raise HTTPError(req.full_url, x.status, x.statusText or "network error", None, body)
    return body

import urllib.request, aei.client
urllib.request.urlopen = aei.client.urlopen = _urlopen

def _figures(emit):
    if "matplotlib.pyplot" not in sys.modules:
        return
    import matplotlib.pyplot as plt
    for n in plt.get_fignums():
        buf = io.BytesIO()
        plt.figure(n).savefig(buf, format="png", dpi=100, bbox_inches="tight")
        emit("image", base64.b64encode(buf.getvalue()).decode())
    plt.close("all")

def _show(value, emit):
    module = type(value).__module__ or ""
    if module.startswith("pandas"):
        import pandas as pd
        if isinstance(value, pd.Series):
            value = value.to_frame()
        if isinstance(value, pd.DataFrame):
            emit("table", value.head(50).to_html(), len(value), value.shape[1])
            return
    if module.startswith("matplotlib"):
        return  # an Axes or a Figure: the figure itself follows
    emit("result", repr(value))

def _trim(e):
    lines = traceback.format_exception(e)
    cell = next((i for i, l in enumerate(lines) if '"<cell>"' in l and l.startswith("  File")), None)
    if cell is None:
        return "".join(traceback.format_exception_only(e))
    return lines[0] + "".join(lines[cell:])

async def run(code, ns, emit):
    try:
        value = await eval_code_async(code, globals=ns, filename="<cell>")
    except BaseException as e:
        _figures(emit)
        emit("error", _trim(e))
        return False
    if value is not None:
        _show(value, emit)
    _figures(emit)
    return True
`;

let ready: Promise<{ py: Pyodide; run: (code: string, ns: unknown, emit: unknown) => Promise<boolean> }> | null = null;
let current = "";
let queue: Promise<unknown> = Promise.resolve();

async function boot(origin: string) {
  const { loadPyodide } = (await import(/* @vite-ignore */ PYODIDE)) as { loadPyodide: () => Promise<Pyodide> };
  const py = await loadPyodide();
  const stream = (s: string) => post({ type: "out", id: current, output: { kind: "stream", text: `${s}\n` } });
  py.setStdout({ batched: stream });
  py.setStderr({ batched: stream });
  await py.loadPackage(["micropip"], { messageCallback: quiet });
  const pointer = await fetch(`${origin}/notebook/pypi/aei.json`);
  // A dev server without the notebook build answers with the app's index.html (status 200): say what is missing.
  if (!pointer.ok || !(pointer.headers.get("content-type") ?? "").includes("json"))
    throw new Error(`no aei wheel at ${origin}/notebook/pypi: run apps/notebook/build.sh once, it publishes the notebook and the wheel`);
  const { wheel } = (await pointer.json()) as { wheel: string };
  const micropip = py.runPython("import micropip\nmicropip") as { install(u: string): Promise<void> };
  await micropip.install(`${origin}/notebook/pypi/${wheel}`);
  py.runPython("import aei, pandas");
  const ns = py.runPython("dict()");
  py.runPython(HELPER, { globals: ns });
  const run = (ns as { get(k: string): unknown }).get("run") as (code: string, g: unknown, emit: unknown) => Promise<boolean>;
  return { py, run };
}

scope.onmessage = (e) => {
  const m = e.data;
  if (m.type === "init") {
    ready = boot(m.origin);
    ready.then(
      () => post({ type: "phase", phase: "ready" }),
      (err: unknown) => post({ type: "phase", phase: "failed", error: err instanceof Error ? err.message : String(err) }),
    );
    return;
  }
  // Cells run one after another, in the order they were sent.
  queue = queue.then(async () => {
    let ok = false;
    try {
      if (!ready) throw new Error("not started");
      const { py, run } = await ready;
      current = m.id;
      post({ type: "start", id: m.id });
      await py.loadPackagesFromImports(m.code, { messageCallback: quiet });
      const emit = (kind: Output["kind"], a: string, rows?: number, cols?: number) => {
        const output: Output =
          kind === "table"
            ? { kind, html: a, rows: rows ?? 0, cols: cols ?? 0 }
            : kind === "image"
              ? { kind, png: a }
              : kind === "error"
                ? { kind, traceback: a }
                : kind === "result"
                  ? { kind, text: a }
                  : { kind: "stream", text: a };
        post({ type: "out", id: m.id, output });
      };
      ok = await run(m.code, py.globals, emit);
    } catch (err) {
      post({ type: "out", id: m.id, output: { kind: "error", traceback: err instanceof Error ? err.message : String(err) } });
    }
    post({ type: "done", id: m.id, ok });
  });
};
