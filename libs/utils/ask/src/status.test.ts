import { afterEach, describe, expect, it, vi } from "vitest";
import { type AiStatus, createAiMonitor, probeLlm } from "./index.ts";

afterEach(() => {
  vi.useRealTimers();
});

describe("probeLlm", () => {
  const ok = () => new Response(JSON.stringify({ object: "list", data: [{ id: "local" }] }), { status: 200 });

  it("asks GET /v1/models with the client's headers and accepts a model list", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(ok());
    const cfg = { baseUrl: "http://llm.test/", model: "m", apiKey: "k", headers: { "CF-Access-Client-Id": "id" }, fetch };
    expect(await probeLlm(cfg)).toBe(true);
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe("http://llm.test/v1/models");
    expect(init?.method).toBeUndefined();
    expect(init?.redirect).toBe("manual");
    expect(init?.headers).toEqual({ Authorization: "Bearer k", "CF-Access-Client-Id": "id" });
  });

  it("counts an error status, a non-list page, a redirect and a network failure as unreachable", async () => {
    const answers = [
      new Response("origin unreachable", { status: 530 }),
      new Response("<html>sign in</html>", { status: 200 }),
      new Response(null, { status: 302, headers: { location: "https://sign-in.test" } }),
    ];
    for (const answer of answers) {
      const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(answer);
      expect(await probeLlm({ baseUrl: "http://llm.test", model: "m", fetch })).toBe(false);
    }
    const fetch = vi.fn<typeof globalThis.fetch>().mockRejectedValue(new TypeError("fetch failed"));
    expect(await probeLlm({ baseUrl: "http://llm.test", model: "m", fetch })).toBe(false);
  });
});

describe("createAiMonitor", () => {
  it("is off without a probe and never changes", async () => {
    const monitor = createAiMonitor();
    monitor.start();
    expect(monitor.status()).toBe("off");
    expect(await monitor.check()).toBe("off");
    expect(await monitor.report(true)).toBe("off");
    expect(await monitor.settled()).toBe("off");
  });

  it("is offline until the first probe answers, then follows each probe", async () => {
    const answers = [true, false, true];
    const changes: AiStatus[] = [];
    const monitor = createAiMonitor({ probe: async () => answers.shift() ?? false, onChange: (s) => changes.push(s) });
    expect(monitor.status()).toBe("offline");
    expect(await monitor.check()).toBe("ready");
    expect(await monitor.check()).toBe("offline");
    expect(await monitor.check()).toBe("ready");
    expect(changes).toEqual(["ready", "offline", "ready"]);
  });

  it("shares one probe between concurrent checks and treats a throwing probe as offline", async () => {
    const probe = vi.fn(async () => {
      throw new Error("boom");
    });
    const monitor = createAiMonitor({ probe });
    const [a, b] = await Promise.all([monitor.check(), monitor.check()]);
    expect([a, b]).toEqual(["offline", "offline"]);
    expect(probe).toHaveBeenCalledTimes(1);
  });

  it("settles on the first probe's answer", async () => {
    const monitor = createAiMonitor({ probe: async () => true });
    monitor.start();
    expect(await monitor.settled()).toBe("ready");
    monitor.stop();
  });

  it("goes ready on a successful request and probes again after a failed one", async () => {
    let up = false;
    const probe = vi.fn(async () => up);
    const monitor = createAiMonitor({ probe });
    expect(await monitor.report(true)).toBe("ready");
    expect(probe).not.toHaveBeenCalled();
    expect(await monitor.report(false)).toBe("offline");
    expect(probe).toHaveBeenCalledTimes(1);
    up = true;
    expect(await monitor.report(false)).toBe("ready");
  });

  it("probes at start and then on every interval until stopped", async () => {
    vi.useFakeTimers();
    const probe = vi.fn(async () => true);
    const monitor = createAiMonitor({ probe, intervalMs: 1_000 });
    monitor.start();
    monitor.start(); // a second start keeps one timer
    expect(probe).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(3_000);
    expect(probe).toHaveBeenCalledTimes(4);
    monitor.stop();
    await vi.advanceTimersByTimeAsync(3_000);
    expect(probe).toHaveBeenCalledTimes(4);
  });
});
