import { describe, expect, it } from "vitest";
import {
  clampLayout,
  closeWindow,
  defaultLayout,
  equalize,
  fitLayout,
  fractions,
  type Layout,
  locate,
  MIN_BODY,
  maximizeWindow,
  migrateLayout,
  minWindowHeight,
  moveWindow,
  parseLayout,
  presetLayout,
  reopenWindow,
  resizeColumns,
  resizePair,
  resizeStack,
  STORAGE_KEY,
  serializeLayout,
  stackNeed,
  WIN_IDS,
} from "./layout.ts";

const ids = (l: Layout) => l.columns.map((c) => c.windows.map((w) => w.id));
const valid = (l: Layout) => {
  expect(l.columns.length).toBeLessThanOrEqual(3);
  if (l.columns.length) expect(l.columns.reduce((s, c) => s + c.width, 0)).toBeCloseTo(1);
  const all = [...l.columns.flatMap((c) => c.windows.map((w) => w.id)), ...Object.keys(l.closed)];
  expect(all.sort()).toEqual([...WIN_IDS].sort());
  for (const c of l.columns) {
    expect(c.width).toBeGreaterThanOrEqual(0.18);
    expect(c.windows.length).toBeGreaterThan(0);
    expect(c.windows.reduce((s, w) => s + w.size, 0)).toBeCloseTo(1);
    for (const w of c.windows) expect(w.size).toBeGreaterThanOrEqual(0.15999);
  }
};
describe("docked layout", () => {
  it("starts with signals | alert math over assistant | timeline over map, patient flow and the grid in the tray", () => {
    expect(ids(defaultLayout())).toEqual([["signals"], ["math", "assistant"], ["timeline", "map"]]);
    valid(defaultLayout());
  });
  it("fits the default to the board: at most two windows a column, and none below its minimum", () => {
    // A short laptop screen leaves about 600 px for the board.
    expect(ids(defaultLayout(600))).toEqual([["signals"], ["math"], ["map"]]);
    expect(Object.keys(defaultLayout(600).closed).sort()).toEqual(["assistant", "coverage", "graph", "grid", "reproduce", "timeline"]);
    expect(ids(defaultLayout(700))).toEqual([["signals"], ["math", "assistant"], ["map"]]);
    expect(ids(defaultLayout(stackNeed(["timeline", "map"])))).toEqual(ids(defaultLayout()));
    for (const height of [300, 500, 600, 620, 700, 800, 900, 1000, 1400]) {
      const l = defaultLayout(height);
      valid(l);
      for (const c of l.columns) {
        expect(c.windows.length).toBeLessThanOrEqual(2);
        if (c.windows.length > 1) expect(stackNeed(c.windows.map((w) => w.id))).toBeLessThanOrEqual(height);
      }
    }
  });
  it("keeps coverage in the tray in every preset, and can reopen and maximize it", () => {
    for (const preset of ["default", "map", "signals", "units"] as const) {
      const base = presetLayout(preset);
      expect(locate(base, "coverage")).toBeNull();
      expect(base.closed.coverage).toBeDefined();
      const opened = reopenWindow(base, "coverage");
      expect(locate(opened, "coverage")).not.toBeNull();
      expect(maximizeWindow(opened, "coverage").maximized).toBe("coverage");
      valid(opened);
    }
  });
  it("gives every window a useful minimum, the map room for its 440 px stage", () => {
    for (const id of WIN_IDS) expect(MIN_BODY[id]).toBeGreaterThanOrEqual(200);
    expect(MIN_BODY.map).toBeGreaterThanOrEqual(440);
    expect(minWindowHeight("math")).toBe(MIN_BODY.math + 42);
    expect(stackNeed(["math", "assistant"])).toBe(MIN_BODY.math + MIN_BODY.assistant + 2 * 42 + 8);
    expect(stackNeed([])).toBe(0);
  });
  it("inserts into another stack without changing unrelated columns", () => {
    const base = defaultLayout();
    const next = moveWindow(base, "math", { column: 2, index: 0 });
    expect(ids(next)).toEqual([["signals"], ["assistant"], ["math", "timeline", "map"]]);
    expect(next.columns[0]).toEqual(base.columns[0]);
    expect(base).toEqual(defaultLayout());
    valid(next);
  });
  it("reorders in the same stack, preserving window heights", () => {
    const base = defaultLayout();
    const next = moveWindow(base, "map", { column: 2, index: 0 });
    expect(ids(next)[2]).toEqual(["map", "timeline"]);
    expect(next.columns[2]?.windows.map((w) => w.size)).toEqual([0.68, 0.32]);
    expect(moveWindow(base, "timeline", { column: 2, index: 1 })).toBe(base);
    expect(ids(moveWindow(base, "timeline", { column: 2, index: 2 }))[2]).toEqual(["map", "timeline"]);
    valid(next);
  });
  it("clamps insertion indices and drops the column the move emptied", () => {
    let l = presetLayout("map");
    l = moveWindow(l, "map", { column: -10, index: 50 });
    expect(ids(l)).toEqual([["signals", "map"]]);
    expect(l.columns[0]?.width).toBe(1);
    valid(l);
  });
  it("creates a new edge column only below the three-column limit", () => {
    const base = presetLayout("signals");
    const next = moveWindow(base, "math", { column: 1, index: 0, newColumn: true });
    expect(ids(next)).toEqual([["signals"], ["math"], ["assistant"]]);
    expect(moveWindow(next, "graph", { column: 0, index: 0, newColumn: true })).toBe(next);
    valid(next);
  });
  it("closing a column's only window removes the column; the others share its width in proportion", () => {
    const base = defaultLayout(600); // Signals | Alert math | Map, one window each
    const next = closeWindow(base, "math");
    expect(ids(next)).toEqual([["signals"], ["map"]]);
    const [a, b, c] = base.columns.map((col) => col.width) as [number, number, number];
    expect(next.columns[0]?.width).toBeCloseTo(a / (a + c));
    expect(next.columns[1]?.width).toBeCloseTo(c / (a + c));
    expect(next.closed.math).toMatchObject({ column: "detail", columnIndex: 1, index: 0, width: b });
    valid(next);
  });
  it("moving a column's last window out removes the column", () => {
    const base = defaultLayout(600);
    const next = moveWindow(base, "math", { column: 2, index: 1 });
    expect(ids(next)).toEqual([["signals"], ["map", "math"]]);
    expect(next.columns.map((c) => c.id)).toEqual(["signals", "map"]);
    // Assistant's home was the removed column: reopening recreates it between the same neighbours.
    expect(ids(reopenWindow(next, "assistant"))).toEqual([["signals"], ["assistant"], ["map", "math"]]);
    valid(next);
    // With three columns, a lone window can still move to a new edge column (the count stays three).
    const edge = moveWindow(base, "signals", { column: 3, index: 0, newColumn: true });
    expect(ids(edge)).toEqual([["math"], ["map"], ["signals"]]);
    valid(edge);
  });
  it("reopens into a new column at its remembered position when its column is gone", () => {
    const base = defaultLayout(600);
    const closed = closeWindow(base, "math");
    const next = reopenWindow(closed, "math");
    expect(ids(next)).toEqual(ids(base));
    expect(next.columns.map((c) => c.id)).toEqual(base.columns.map((c) => c.id));
    for (const [i, c] of next.columns.entries()) expect(c.width).toBeCloseTo(base.columns[i]?.width as number);
    // Closing the left column too keeps the middle home pointing between Signals' old place and Map.
    const both = closeWindow(closed, "signals");
    expect(ids(both)).toEqual([["map"]]);
    expect(ids(reopenWindow(both, "math"))).toEqual([["math"], ["map"]]);
    expect(ids(reopenWindow(reopenWindow(both, "math"), "signals"))).toEqual(ids(base));
    valid(next);
  });
  it("closes immediately and reopens in the previous column and position", () => {
    const base = defaultLayout();
    const closed = closeWindow(base, "math");
    expect(locate(closed, "math")).toBeNull();
    expect(closed.closed.math).toMatchObject({ column: "detail", index: 0 });
    expect(closed.columns[0]).toEqual(base.columns[0]);
    const next = reopenWindow(closed, "math");
    expect(ids(next)).toEqual(ids(base));
    expect(next.columns[1]?.windows[0]?.size).toBeCloseTo(0.6);
    expect(closeWindow(closed, "math")).toBe(closed);
    expect(reopenWindow(base, "math")).toBe(base);
    valid(next);
  });
  it("reopens sensibly if its old column was removed", () => {
    let l = closeWindow(defaultLayout(), "math");
    l = moveWindow(l, "assistant", { column: 0, index: 0 });
    expect(l.columns).toHaveLength(2);
    l = reopenWindow(l, "math");
    expect(ids(l)).toEqual([["assistant", "signals"], ["math"], ["timeline", "map"]]);
    valid(l);
  });
  it("can close every window and reopen every window", () => {
    const closed = WIN_IDS.reduce(closeWindow, defaultLayout());
    expect(closed.columns).toEqual([]);
    valid(closed);
    valid(WIN_IDS.reduce(reopenWindow, closed));
  });
  it("maximizes without changing sizes/order; restore and close leave no hidden board", () => {
    const base = defaultLayout();
    const max = maximizeWindow(base, "math");
    expect(max.columns).toEqual(base.columns);
    expect(maximizeWindow(max, "math")).toEqual(base);
    expect(closeWindow(max, "math").maximized).toBeNull();
    expect(moveWindow(max, "math", { column: 0, index: 0 })).toBe(max);
    expect(reopenWindow(max, "grid").maximized).toBeNull();
  });
  it.each(["default", "map", "signals", "units"] as const)("preset %s is complete and reset is deterministic", (p) => {
    const l = presetLayout(p);
    valid(l);
    expect(parseLayout(serializeLayout(l))).toEqual(l);
    expect(presetLayout("default")).toEqual(defaultLayout());
  });
});
describe("splitters", () => {
  it("resizes only an adjacent column pair and clamps extremes", () => {
    const base = defaultLayout();
    const next = resizeColumns(base, 0, 20, 0.2);
    expect(next.columns[0]?.width).toBeCloseTo(0.4);
    expect(next.columns[1]?.width).toBeCloseTo(0.2);
    expect(next.columns[2]).toEqual(base.columns[2]);
    valid(next);
  });
  it("resizes a stack's adjacent heights without touching other windows", () => {
    const base = defaultLayout();
    const next = resizeStack(base, 2, 0, -20, 0.16);
    expect(next.columns[2]?.windows.map((w) => w.size)).toEqual([0.16, 0.84]);
    expect(next.columns.slice(0, 2)).toEqual(base.columns.slice(0, 2));
    valid(next);
  });
  it("stops a stack splitter at each window's own minimum", () => {
    const base = defaultLayout();
    const sizes = (l: Layout) => l.columns[2]?.windows.map((w) => w.size);
    expect(sizes(resizeStack(base, 2, 0, -1, [0.6, 0.3]))).toEqual([0.6, 0.4]);
    expect(sizes(resizeStack(base, 2, 0, 1, [0.6, 0.3]))?.map((n) => Number(n.toFixed(6)))).toEqual([0.7, 0.3]);
    // Floors that cannot both fit share the pair in their own proportion.
    expect(sizes(resizeStack(base, 2, 0, 1, [0.9, 0.9]))).toEqual([0.5, 0.5]);
  });
  it("equalizes widths or just one stack", () => {
    const base = defaultLayout();
    expect(equalize(base).columns.map((c) => c.width)).toEqual([1 / 3, 1 / 3, 1 / 3]);
    const next = equalize(base, 2);
    expect(next.columns[2]?.windows.map((w) => w.size)).toEqual([1 / 2, 1 / 2]);
    expect(next.columns.map((c) => c.width)).toEqual(base.columns.map((c) => c.width));
  });
  it("handles cramped splitters and invalid indices", () => {
    expect(resizePair([0.2, 0.3, 0.5], 0, 100, 0.9)).toEqual([0.25, 0.25, 0.5]);
    expect(resizePair([0.5, 0.5], -1, 1, 0.1)).toEqual([0.5, 0.5]);
    expect(resizePair([0.5, 0.5], 0, Number.NaN, 0.1)).toEqual([0.5, 0.5]);
  });
});
describe("persistence and migration", () => {
  it("uses a new key, ignores the old free grid, and falls back to default", () => {
    expect(STORAGE_KEY).not.toBe("aei.research.layout");
    expect(parseLayout('{"v":1,"wins":{},"order":[]}')).toBeNull();
    expect(migrateLayout('{"v":1,"wins":{},"order":[]}')).toEqual(defaultLayout());
    expect(migrateLayout(null)).toEqual(defaultLayout());
  });
  it("corrects a stored layout that would squash a window: lowest priority to the tray, homes kept", () => {
    // The previous default: three windows stacked in the right column.
    const old: Layout = {
      columns: [
        { id: "signals", width: 0.27, windows: [{ id: "signals", size: 1 }] },
        { id: "map", width: 0.36, windows: [{ id: "map", size: 1 }] },
        {
          id: "detail",
          width: 0.37,
          windows: [
            { id: "graph", size: 0.4 },
            { id: "math", size: 0.36 },
            { id: "assistant", size: 0.24 },
          ],
        },
      ],
      closed: {
        coverage: { column: "map", columnIndex: 1, index: 3, size: 0.6 },
        grid: { column: "map", columnIndex: 1, index: 1, size: 0.5 },
        reproduce: { column: "map", columnIndex: 1, index: 2, size: 0.6 },
      },
      maximized: null,
    };
    const raw = serializeLayout(old);
    const fitted = migrateLayout(raw, 600);
    expect(ids(fitted)).toEqual([["signals"], ["map"], ["math"]]);
    expect(fitted.closed.graph).toMatchObject({ column: "detail", index: 0 });
    expect(fitted.closed.assistant).toMatchObject({ column: "detail", index: 2 });
    valid(fitted);
    // Reopening puts a window back where it was; its column then scrolls rather than squashing.
    expect(ids(reopenWindow(fitted, "graph"))[2]).toEqual(["graph", "math"]);
    // A tall board keeps the stored arrangement as it was.
    expect(migrateLayout(raw, stackNeed(["graph", "math", "assistant"]))).toEqual(parseLayout(raw));
    expect(migrateLayout(raw)).toEqual(parseLayout(raw));
  });
  it("never trays a column's only window, a kept window, or anything while maximized", () => {
    const tall = defaultLayout();
    expect(ids(fitLayout(tall, 100))).toEqual([["signals"], ["math"], ["map"]]);
    const withGrid = reopenWindow(tall, "grid");
    expect(ids(fitLayout(withGrid, 600, ["grid"]))).toEqual([["signals"], ["math"], ["grid"]]);
    expect(fitLayout(maximizeWindow(tall, "map"), 300)).toEqual(maximizeWindow(tall, "map"));
    expect(fitLayout(tall, Number.NaN)).toBe(tall);
    expect(fitLayout(tall, 0)).toBe(tall);
  });
  it.each(["default", "map", "signals", "units"] as const)("preset %s fits a 600 px board without squashing", (p) => {
    const l = presetLayout(p, 600);
    valid(l);
    for (const c of l.columns) if (c.windows.length > 1) expect(stackNeed(c.windows.map((w) => w.id))).toBeLessThanOrEqual(600);
  });
  it("fixes a stored layout with an empty column on load", () => {
    const stored = closeWindow(defaultLayout(600), "math");
    const raw = serializeLayout({
      ...stored,
      columns: [stored.columns[0], { id: "detail", width: 0.33, windows: [] }, stored.columns[1]] as Layout["columns"],
    });
    const loaded = migrateLayout(raw, 600);
    expect(ids(loaded)).toEqual([["signals"], ["map"]]);
    expect(loaded.columns[0]?.width).toBeCloseTo(0.27 / 0.67, 2);
    valid(loaded);
    // An all-closed board stores no columns and still loads.
    const none = WIN_IDS.reduce(closeWindow, defaultLayout());
    expect(parseLayout(serializeLayout(none))).toEqual(none);
  });
  it("round-trips closed homes, stacks, sizes and maximize", () => {
    const l = maximizeWindow(closeWindow(defaultLayout(), "math"), "map");
    expect(parseLayout(serializeLayout(l))).toEqual(l);
  });
  it.each([null, "", "no", "null", "[]", '{"v":99}'])("rejects malformed input %s", (raw) => {
    expect(parseLayout(raw)).toBeNull();
  });
  it("puts window kinds added since a layout was saved in the tray, keeping the rest as saved", () => {
    const old = defaultLayout();
    delete old.closed.coverage;
    const parsed = parseLayout(serializeLayout(old));
    expect(parsed).not.toBeNull();
    expect(ids(parsed as Layout)).toEqual(ids(old));
    expect(parsed?.closed.coverage).toMatchObject({ column: "map", columnIndex: 2, index: 2 });
    valid(parsed as Layout);
  });
  it("rejects duplicates, invalid homes, column counts and closed maximize", () => {
    for (const mutate of [
      (l: Layout) => {
        l.columns[0]?.windows.push({ id: "map", size: 1 });
      },
      (l: Layout) => {
        if (l.columns[1]) l.columns[1].id = "signals";
      },
      (l: Layout) => {
        if (l.closed.grid) l.closed.grid.index = -1;
      },
      (l: Layout) => {
        l.maximized = "grid";
      },
    ]) {
      const l = defaultLayout();
      mutate(l);
      expect(parseLayout(serializeLayout(l))).toBeNull();
    }
  });
  it("clamps finite saved sizes and normalizes without NaNs", () => {
    const l = defaultLayout();
    for (const [i, c] of l.columns.entries()) {
      c.width = i === 1 ? 100000 : -10;
      if (i === 2 && c.windows[0]) c.windows[0].size = 0;
    }
    const parsed = parseLayout(serializeLayout(l));
    expect(parsed).not.toBeNull();
    if (parsed) valid(parsed);
    valid(clampLayout(l));
    expect(fractions([])).toEqual([]);
    expect(fractions([Number.NaN, Number.POSITIVE_INFINITY])).toEqual([0.5, 0.5]);
    expect(fractions([Number.MAX_VALUE, Number.MAX_VALUE])).toEqual([0.5, 0.5]);
  });
  it("round-trips extreme splitter positions without changing fractions", () => {
    const l = resizeStack(resizeColumns(defaultLayout(), 0, -100), 2, 0, 100);
    expect(parseLayout(serializeLayout(l))).toEqual(l);
  });
});
