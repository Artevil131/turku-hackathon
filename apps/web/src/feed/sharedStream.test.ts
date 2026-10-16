import { describe, expect, it } from "vitest";
import { type StreamEnv, type StreamEvent, subscribeShared } from "./sharedStream.ts";

// Several "tabs" in one test: a shared fake lock manager and channel bus, one
// fake EventSource class that records every stream opened.

class FakeSource {
  static opened: FakeSource[] = [];
  listeners = new Map<string, (e: MessageEvent<string>) => void>();
  onerror: ((e: Event) => void) | null = null;
  closed = false;
  constructor(readonly url: string) {
    FakeSource.opened.push(this);
  }
  addEventListener(type: string, fn: EventListener) {
    this.listeners.set(type, fn as (e: MessageEvent<string>) => void);
  }
  close() {
    this.closed = true;
  }
  emit(type: string, data: string) {
    this.listeners.get(type)?.({ data } as MessageEvent<string>);
  }
}

function bus() {
  const members = new Set<{ name: string; onmessage: ((e: MessageEvent) => void) | null }>();
  return class FakeChannel {
    onmessage: ((e: MessageEvent) => void) | null = null;
    constructor(readonly name: string) {
      members.add(this);
    }
    postMessage(data: unknown) {
      // Like BroadcastChannel: every other member with the same name, not the sender.
      for (const m of members) if (m !== this && m.name === this.name) queueMicrotask(() => m.onmessage?.({ data } as MessageEvent));
    }
    close() {
      members.delete(this);
    }
  };
}

function lockManager(): Pick<LockManager, "request"> {
  const held = new Set<string>();
  const queue: { name: string; grant: () => void }[] = [];
  const pump = () => {
    for (const item of [...queue]) {
      if (held.has(item.name)) continue;
      queue.splice(queue.indexOf(item), 1);
      held.add(item.name);
      item.grant();
    }
  };
  const request = (name: string, options: LockOptions, fn: () => unknown) =>
    new Promise((resolve, reject) => {
      const item = {
        name,
        grant: () => {
          Promise.resolve(fn()).then(
            (v) => {
              held.delete(name);
              resolve(v);
              pump();
            },
            (e) => {
              held.delete(name);
              reject(e);
              pump();
            },
          );
        },
      };
      options.signal?.addEventListener("abort", () => {
        const i = queue.indexOf(item);
        if (i >= 0) {
          queue.splice(i, 1);
          reject(new DOMException("aborted", "AbortError"));
        }
      });
      queue.push(item);
      pump();
    });
  return { request } as unknown as Pick<LockManager, "request">;
}

const tick = () => new Promise((r) => setTimeout(r, 0));

function sharedEnv(): StreamEnv {
  return { EventSource: FakeSource, BroadcastChannel: bus(), locks: lockManager() } as unknown as StreamEnv;
}

describe("subscribeShared", () => {
  it("opens one stream for many tabs and passes its events to all of them", async () => {
    FakeSource.opened = [];
    const env = sharedEnv();
    const got: StreamEvent[][] = [[], [], []];
    const closers = got.map((list) => subscribeShared("/api/live", ["clock"], (e) => list.push(e), undefined, env));
    await tick();
    expect(FakeSource.opened).toHaveLength(1);
    FakeSource.opened[0]?.emit("clock", '{"asOf":"2025-06-10"}');
    await tick();
    expect(got.map((l) => l.map((e) => e.data))).toEqual([['{"asOf":"2025-06-10"}'], ['{"asOf":"2025-06-10"}'], ['{"asOf":"2025-06-10"}']]);
    for (const close of closers) close();
  });

  it("hands the stream to another tab when the leading tab closes", async () => {
    FakeSource.opened = [];
    const env = sharedEnv();
    const second: string[] = [];
    const closeFirst = subscribeShared("/api/live", ["clock"], () => {}, undefined, env);
    const closeSecond = subscribeShared("/api/live", ["clock"], (e) => second.push(e.data), undefined, env);
    await tick();
    expect(FakeSource.opened).toHaveLength(1);
    closeFirst();
    await tick();
    expect(FakeSource.opened[0]?.closed).toBe(true);
    expect(FakeSource.opened).toHaveLength(2);
    FakeSource.opened[1]?.emit("clock", "after");
    expect(second).toEqual(["after"]);
    closeSecond();
  });

  it("tells every tab when the stream fails", async () => {
    FakeSource.opened = [];
    const env = sharedEnv();
    let errors = 0;
    const closers = [0, 1].map(() =>
      subscribeShared(
        "/api/live",
        ["clock"],
        () => {},
        () => errors++,
        env,
      ),
    );
    await tick();
    FakeSource.opened[0]?.onerror?.(new Event("error"));
    await tick();
    expect(errors).toBe(2);
    for (const close of closers) close();
  });

  it("falls back to a stream per tab without BroadcastChannel or Web Locks", () => {
    FakeSource.opened = [];
    const env = { EventSource: FakeSource } as unknown as StreamEnv;
    const got: string[] = [];
    const close = subscribeShared("/api/live", ["arrivals"], (e) => got.push(e.type), undefined, env);
    subscribeShared("/api/live", ["arrivals"], () => {}, undefined, env)();
    expect(FakeSource.opened).toHaveLength(2);
    FakeSource.opened[0]?.emit("arrivals", "[]");
    expect(got).toEqual(["arrivals"]);
    close();
  });
});
