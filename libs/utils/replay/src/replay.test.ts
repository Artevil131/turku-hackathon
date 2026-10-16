import { describe, expect, it } from "vitest";
import { addDays, createReleaseIndex, createReplayClock, daysBetween, type Scheduler } from "./index.ts";

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
