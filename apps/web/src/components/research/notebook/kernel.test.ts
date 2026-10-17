import { describe, expect, it } from "vitest";
import { createKernel, type KernelIn, type KernelOut, lastLine, outputText, parseTable } from "./kernel.ts";

// pandas 2's df.head(50).to_html() for a two-column frame with a string index name.
const HTML = `<table border="1" class="dataframe">
  <thead>
    <tr style="text-align: right;">
      <th></th>
      <th>ward</th>
      <th>k</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>Kir &amp; Med</td>
      <td>12</td>
    </tr>
    <tr>
      <th>1</th>
      <td>&lt;NA&gt;</td>
      <td>3</td>
    </tr>
  </tbody>
</table>`;

const TRACEBACK = `Traceback (most recent call last):
  File "<cell>", line 2, in <module>
    1 / 0
    ~~^~~
ZeroDivisionError: division by zero
`;

describe("parsing the kernel's outputs", () => {
  it("reads a DataFrame's HTML as header and body rows of text, entities decoded, markup dropped", () => {
    expect(parseTable(HTML)).toEqual({
      head: [["", "ward", "k"]],
      body: [
        ["0", "Kir & Med", "12"],
        ["1", "<NA>", "3"],
      ],
    });
    expect(parseTable('<table><tbody><tr><td><img src=x onerror="alert(1)">a</td></tr></tbody></table>').body).toEqual([["a"]]);
  });

  it("takes a traceback's last line", () => {
    expect(lastLine(TRACEBACK)).toBe("ZeroDivisionError: division by zero");
    expect(lastLine("")).toBe("");
  });

  it("keeps a run as text: streams, reprs, tables as tab-separated rows, an error's last line, no figures", () => {
    expect(
      outputText([
        { kind: "stream", text: "2\n" },
        { kind: "result", text: "(0.1, 0.3)" },
        { kind: "table", html: HTML, rows: 2, cols: 2 },
        { kind: "image", png: "AAAA" },
        { kind: "error", traceback: TRACEBACK },
      ]),
    ).toBe("2\n(0.1, 0.3)\n\tward\tk\n0\tKir & Med\t12\n1\t<NA>\t3\nZeroDivisionError: division by zero");
  });
});

/** A stand-in worker: answers init with ready and each run with its code echoed as stdout. */
function fakeWorker(opts: { fail?: boolean } = {}) {
  const sent: KernelIn[] = [];
  let terminated = false;
  const w = {
    onmessage: null as ((e: MessageEvent<KernelOut>) => void) | null,
    onerror: null,
    terminate: () => {
      terminated = true;
    },
    postMessage(m: KernelIn) {
      sent.push(m);
      const reply = (r: KernelOut) => queueMicrotask(() => !terminated && w.onmessage?.({ data: r } as MessageEvent<KernelOut>));
      if (m.type === "init") reply(opts.fail ? { type: "phase", phase: "failed", error: "no wasm" } : { type: "phase", phase: "ready" });
      else if (m.code !== "hang") {
        reply({ type: "start", id: m.id });
        reply({ type: "out", id: m.id, output: { kind: "stream", text: `${m.code}\n` } });
        reply({ type: "done", id: m.id, ok: true });
      }
    },
  };
  return { w, sent, isTerminated: () => terminated };
}

describe("the kernel (worker mocked)", () => {
  it("starts once on the first run, with this origin, and runs cells in one worker", async () => {
    const workers: ReturnType<typeof fakeWorker>[] = [];
    const k = createKernel(
      () => {
        const f = fakeWorker();
        workers.push(f);
        return f.w;
      },
      () => "http://x",
    );
    expect(k.getState().phase).toBe("off");
    const a = await k.run("a", "print(1)");
    const b = await k.run("b", "x");
    expect(workers).toHaveLength(1);
    expect(workers[0]?.sent[0]).toEqual({ type: "init", origin: "http://x" });
    expect(a).toEqual({ status: "done", ok: true, outputs: [{ kind: "stream", text: "print(1)\n" }] });
    expect(b.outputs).toEqual([{ kind: "stream", text: "x\n" }]);
    expect(k.getState().phase).toBe("ready");
  });

  it("Stop ends the worker and the running cell; the next run starts a new one; restart clears outputs", async () => {
    const workers: ReturnType<typeof fakeWorker>[] = [];
    const k = createKernel(() => {
      const f = fakeWorker();
      workers.push(f);
      return f.w;
    });
    const hanging = k.run("a", "hang");
    k.interrupt();
    expect((await hanging).status).toBe("stopped");
    expect(workers[0]?.isTerminated()).toBe(true);
    expect(k.getState().phase).toBe("off");
    await k.run("a", "1");
    expect(workers).toHaveLength(2);
    k.restart();
    expect(workers).toHaveLength(3);
    expect(k.getState().runs).toEqual({});
  });

  it("a failed start ends the waiting cell and says why", async () => {
    const k = createKernel(() => fakeWorker({ fail: true }).w);
    const r = await k.run("a", "1");
    expect(r.status).toBe("done");
    expect(r.ok).toBe(false);
    expect(k.getState()).toMatchObject({ phase: "failed", error: "no wasm" });
  });
});
