import { describe, expect, it } from "vitest";
import { addDays, createClockPool, createReleaseIndex, createReplayClock, daysBetween, type Scheduler } from "./index.ts";

function manualScheduler() {
  let fn: (() => void) | null = null;
  const scheduler: Scheduler = {
    setInterval: (f) => {
      fn = f;
      return 1;
    },
    clearInterval: () => {
      fn = null;
    },
  };
  return { scheduler, tick: () => fn?.(), active: () => fn !== null };
}

describe("dates", () => {
  it("crosses month, year and DST boundaries", () => {
    expect(addDays("2025-03-30", 1)).toBe("2025-03-31");
    expect(addDays("2025-12-31", 1)).toBe("2026-01-01");
    expect(daysBetween("2023-10-02", "2026-09-27")).toBe(1091);
  });
});

describe("replay clock", () => {
  it("advances while playing and stops at the end", () => {
    const m = manualScheduler();
    const clock = createReplayClock({ start: "2026-09-20", end: "2026-09-27", tickMs: 100, daysPerTick: 3, scheduler: m.scheduler });
    const seen: string[] = [];
    clock.subscribe((s) => seen.push(s.asOf));
    clock.play();
    m.tick();
    m.tick();
    m.tick();
    expect(clock.state().asOf).toBe("2026-09-27");
    expect(clock.state().running).toBe(false);
    expect(m.active()).toBe(false);
    expect(seen).toEqual(["2026-09-20", "2026-09-23", "2026-09-26", "2026-09-27"]);
  });

  it("clamps seek and step to the range", () => {
    const clock = createReplayClock({ start: "2026-01-01", end: "2026-01-10", tickMs: 100, daysPerTick: 1 });
    clock.seek("2025-06-01");
    expect(clock.state().asOf).toBe("2026-01-01");
    clock.step(30);
    expect(clock.state().asOf).toBe("2026-01-10");
  });
});

describe("clock pool", () => {
  const options = { start: "2026-01-01", end: "2026-12-31", tickMs: 100, daysPerTick: 1 };

  it("keeps one clock per key, so seeking one leaves the others", () => {
    const pool = createClockPool({ create: () => createReplayClock(options), max: 10, idleMs: 1000 });
    pool.get("a").seek("2026-03-01");
    pool.get("b").seek("2026-07-01");
    expect(pool.get("a").state().asOf).toBe("2026-03-01");
    expect(pool.get("b").state().asOf).toBe("2026-07-01");
    expect(pool.peek("c")).toBeUndefined();
    expect(pool.size).toBe(2);
  });

  it("drops an idle clock and stops its timer, but not one that is held", () => {
    let t = 0;
    const timers = { a: manualScheduler(), b: manualScheduler() };
    const evicted: string[] = [];
    const pool = createClockPool({
      create: (key) => createReplayClock({ ...options, scheduler: timers[key as "a" | "b"].scheduler }),
      max: 10,
      idleMs: 1000,
      now: () => t,
      onEvict: (key) => evicted.push(key),
    });
    pool.get("a").play();
    pool.get("b").play();
    const release = pool.hold("b");
    expect(timers.a.active() && timers.b.active()).toBe(true);
    t = 999;
    expect(pool.sweep()).toEqual([]);
    t = 1000;
    expect(pool.sweep()).toEqual(["a"]);
    expect(timers.a.active()).toBe(false);
    expect(timers.b.active()).toBe(true);
    expect(evicted).toEqual(["a"]);
    // Released, b's idle time counts from the release.
    t = 5000;
    release();
    t = 5999;
    expect(pool.sweep()).toEqual([]);
    t = 6000;
    expect(pool.sweep()).toEqual(["b"]);
    expect(timers.b.active()).toBe(false);
    expect(pool.size).toBe(0);
  });

  it("drops the least recently used unheld clock past the cap", () => {
    let t = 0;
    const m = manualScheduler();
    const pool = createClockPool({
      create: () => createReplayClock({ ...options, scheduler: m.scheduler }),
      max: 2,
      idleMs: 1e9,
      now: () => t++,
    });
    pool.hold("a");
    pool.get("b").play();
    pool.get("c");
    expect(pool.entries().map(([key]) => key)).toEqual(["a", "c"]);
    expect(m.active()).toBe(false);
    // Every clock held: the least recently used goes anyway.
    pool.hold("c");
    pool.get("d");
    expect(pool.entries().map(([key]) => key)).toEqual(["c", "d"]);
  });
});

describe("release index", () => {
  const rows = [{ d: "2026-01-03" }, { d: "2026-01-01" }, { d: "2026-01-02" }, { d: "2026-01-02" }];
  const index = createReleaseIndex(rows, (r) => r.d);

  it("returns records up to and including a date", () => {
    expect(index.upTo("2026-01-02").map((r) => r.d)).toEqual(["2026-01-01", "2026-01-02", "2026-01-02"]);
    expect(index.upTo("2025-12-31")).toEqual([]);
  });

  it("returns records in a half-open interval (from, to]", () => {
    expect(index.between("2026-01-01", "2026-01-03").map((r) => r.d)).toEqual(["2026-01-02", "2026-01-02", "2026-01-03"]);
    expect(index.between("2026-01-03", "2026-01-01")).toEqual([]);
  });
});
