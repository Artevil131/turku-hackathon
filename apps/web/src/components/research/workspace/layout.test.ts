import { describe, expect, it } from "vitest";
import { defaultSpec } from "../charts/spec.ts";
import {
  addChart,
  addWindow,
  CHART_MIN_SIZE,
  COLS,
  compactLayout,
  defaultLayout,
  fillLayout,
  fitLayout,
  focusLayout,
  insertBetween,
  MIN_SIZE,
  makeRoom,
  nearTop,
  parseLayout,
  patchWin,
  presetLayout,
  removeChart,
  removeCopy,
  serializeLayout,
  TIMELINE_ROWS,
  WIN_IDS,
  withCharts,
} from "./layout.ts";

const noOverlap = (l: ReturnType<typeof defaultLayout>) => {
  const open = WIN_IDS.filter((id) => l.wins[id].open).map((id) => l.wins[id]);
  for (const a of open) {
    for (const b of open) {
      if (a === b) continue;
      expect(a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y).toBe(false);
    }
  }
};

describe("compactLayout", () => {
  it("leaves the default layout alone", () => {
    const l = defaultLayout();
    expect(compactLayout(l).wins).toEqual(l.wins);
  });
  it("floats windows up into a gap", () => {
    const l = patchWin(patchWin(patchWin(defaultLayout(), "graph", { open: false }), "map", { open: false }), "math", { open: true });
    expect(compactLayout(l).wins.math.y).toBe(TIMELINE_ROWS);
  });
  it("opens with the Signals window large, the notebook wide beside it, and the card and the assistant in the tray", () => {
    const d = defaultLayout();
    expect(d.wins.signals.w).toBeGreaterThanOrEqual(3);
    expect(d.wins.math.open).toBe(false);
    expect(d.wins.assistant.open).toBe(false);
    expect(WIN_IDS.filter((id) => d.wins[id].open)).toEqual(["signals", "map", "graph", "notebook", "timeline"]);
    expect(d.wins.notebook.x).toBe(d.wins.signals.x + d.wins.signals.w);
    expect(d.wins.notebook.w).toBeGreaterThanOrEqual(3);
    noOverlap(d);
  });
  it("opens the notebook in the analysis layout, beside Signals", () => {
    const a = presetLayout("analysis");
    expect(a.wins.notebook.open).toBe(true);
    expect(a.wins.notebook.x).toBe(a.wins.signals.w);
    noOverlap(a);
  });
  it("gives a layout saved before the notebook existed the notebook's default place", () => {
    const { notebook: _n, ...wins } = defaultLayout().wins;
    const l = parseLayout(JSON.stringify({ v: 4, wins, charts: {}, order: ["signals", "map", "graph"] }));
    expect(l?.wins.notebook.open).toBe(true);
    expect(l?.wins.signals.open).toBe(true);
  });
  it("pushes the windows a moved one lands on down, with no overlaps", () => {
    const l = patchWin(defaultLayout(), "assistant", { y: 0, open: true });
    const c = compactLayout(l, "assistant");
    noOverlap(c);
    expect(c.wins.assistant.y).toBe(0);
    expect(c.wins.graph.y).toBeGreaterThanOrEqual(8);
  });
  it("resolves a stored layout that overlaps", () => {
    const l = patchWin(patchWin(defaultLayout(), "graph", { y: 2 }), "math", { y: 0, open: true });
    noOverlap(compactLayout(l));
  });
});

describe("focusLayout", () => {
  it("gives the focused window the whole width and the viewport's rows, and takes the others off the board", () => {
    const d = defaultLayout();
    const f = focusLayout(d, "math", 30);
    expect(f.wins.math).toEqual({ x: 0, y: 0, w: COLS, h: 30, open: true });
    expect(WIN_IDS.filter((id) => f.wins[id].open)).toEqual(["math"]);
    expect(f.order[f.order.length - 1]).toBe("math");
  });
  it("keeps a window taller than the viewport at its own height and leaves the source layout alone", () => {
    const d = defaultLayout();
    const f = focusLayout(d, "signals", 20);
    expect(f.wins.signals.h).toBe(d.wins.signals.h);
    expect(d.wins.map.open).toBe(true);
    expect(d.wins.signals.w).toBe(3);
  });
});

describe("chart windows in the layout", () => {
  const spec = defaultSpec({ unit: "ICU", window: { from: "2026-09-01", to: "2026-09-28" } });
  const saved = (extra: object) => JSON.stringify({ v: 4, ...defaultLayout(), ...extra });

  it("migrates a layout saved before charts existed to an empty charts record", () => {
    const old = { v: 4, wins: defaultLayout().wins, order: [...defaultLayout().order] };
    const l = parseLayout(JSON.stringify(old));
    expect(l?.charts).toEqual({});
    expect(l?.order).toEqual(defaultLayout().order);
  });
  it("adds a chart window that is closable, raised and not overlapping, and removes it again", () => {
    const { layout, id } = addChart(defaultLayout(), spec);
    expect(id).toBe("chart:1");
    expect(layout.order[layout.order.length - 1]).toBe(id);
    const c = compactLayout(fitLayout(layout), id);
    expect(c.charts[id]).toMatchObject({ w: 6, open: true, type: "share", unit: "ICU" });
    expect(c.charts[id]?.h).toBeGreaterThanOrEqual(CHART_MIN_SIZE.h);
    expect(addChart(layout, spec).id).toBe("chart:2");
    const gone = removeChart(layout, id);
    expect(gone.charts).toEqual({});
    expect(gone.order).not.toContain(id);
  });
  it("keeps charts through save and load, with the chart's spec", () => {
    const { layout } = addChart(defaultLayout(), spec);
    const back = parseLayout(JSON.stringify({ v: 4, ...layout }));
    expect(back?.charts["chart:1"]).toMatchObject({ ...spec, open: true });
    expect(back?.order).toContain("chart:1");
  });
  it("drops a malformed chart and keeps the rest", () => {
    const { layout } = addChart(defaultLayout(), spec);
    const bad = { "chart:1": { ...layout.charts["chart:1"], type: "pie" }, nope: layout.charts["chart:1"] };
    const l = parseLayout(saved({ charts: bad, order: [...layout.order, "chart:1"] }));
    expect(l?.charts).toEqual({});
    expect(l?.order).not.toContain("chart:1");
  });
  it("focuses a chart and takes everything else off the board", () => {
    const { layout, id } = addChart(defaultLayout(), spec);
    const f = focusLayout(layout, id, 30);
    expect(f.charts[id]).toMatchObject({ x: 0, w: COLS, open: true });
    expect(f.wins.math.open).toBe(false);
  });
  it("carries the charts over a preset", () => {
    const { layout, id } = addChart(defaultLayout(), spec);
    const p = withCharts(presetLayout("map"), layout);
    expect(p.charts[id]).toBeDefined();
    expect(p.order).toContain(id);
  });
});

describe("a window dropped between two others", () => {
  const two = () => {
    let l = defaultLayout();
    for (const id of WIN_IDS) l = patchWin(l, id, { open: false });
    l = patchWin(l, "signals", { x: 0, y: 0, w: 6, h: 20, open: true });
    l = patchWin(l, "graph", { x: 6, y: 0, w: 6, h: 20, open: true });
    return l;
  };
  it("narrows both neighbours so the dropped window sits in the middle on the same rows", () => {
    const l = compactLayout(patchWin(two(), "map", { x: 4, y: 0, w: 4, h: 20, open: true }), "map");
    expect(l.wins.signals).toMatchObject({ x: 0, w: 4, y: 0 });
    expect(l.wins.map).toMatchObject({ x: 4, w: 4, y: 0 });
    expect(l.wins.graph).toMatchObject({ x: 8, w: 4, y: 0 });
  });
  it("pushes a neighbour below when narrowing would take it under its minimum width", () => {
    const l = compactLayout(patchWin(two(), "map", { x: 1, y: 0, w: 5, h: 20, open: true }), "map");
    expect(l.wins.signals.y).toBeGreaterThanOrEqual(20);
    expect(l.wins.graph).toMatchObject({ x: 6, w: 6, y: 0 });
  });
  it("leaves the layout alone with nothing moved", () => {
    const l = two();
    expect(makeRoom(l)).toBe(l);
  });
});

describe("neighbours take the empty columns", () => {
  it("grows a window sideways into free columns up to the next window, and leaves the moved one alone", () => {
    let l = defaultLayout();
    for (const id of ["graph", "math", "assistant", "grid", "reproduce", "notebook"] as const) l = patchWin(l, id, { open: false });
    // Signals at 0–4 and the map at 6–10 on the same rows: a free column between them and two at the right edge.
    l = patchWin(l, "signals", { x: 0, y: 0, w: 4, h: 20, open: true });
    l = patchWin(l, "map", { x: 6, y: 0, w: 4, h: 20, open: true });
    const filled = fillLayout(l, "map");
    expect(filled.wins.signals).toMatchObject({ x: 0, w: 6 });
    expect(filled.wins.map).toMatchObject({ x: 6, w: 4 });
    const both = fillLayout(l);
    expect(both.wins.signals).toMatchObject({ x: 0, w: 6 });
    expect(both.wins.map).toMatchObject({ x: 6, w: COLS - 6 });
  });
  it("does not grow across a window on other rows' columns unless the rows overlap", () => {
    let l = defaultLayout();
    for (const id of ["graph", "math", "assistant", "grid", "reproduce", "map", "notebook"] as const) l = patchWin(l, id, { open: false });
    l = patchWin(l, "signals", { x: 0, y: 0, w: 4, h: 10, open: true });
    l = patchWin(l, "graph", { x: 8, y: 12, w: 4, h: 10, open: true });
    const f = fillLayout(l);
    expect(f.wins.signals).toMatchObject({ x: 0, w: COLS });
    expect(f.wins.graph).toMatchObject({ x: 0, w: COLS });
  });
});

describe("windows of the same kind", () => {
  it("opens the first window of a kind in place and gives the next one a copy", () => {
    const first = addWindow(defaultLayout(), "coverage", { x: 0, y: 20 });
    expect(first.id).toBe("coverage");
    expect(first.layout.wins.coverage).toMatchObject({ open: true, x: 0, y: 20 });
    const second = addWindow(first.layout, "coverage", { x: 6, y: 20 });
    expect(second.id).toBe("win:coverage:1");
    expect(second.layout.copies[second.id]).toMatchObject({ kind: "coverage", open: true, x: 6 });
    expect(addWindow(second.layout, "coverage").id).toBe("win:coverage:2");
  });
  it("keeps copies through a save, a reload and a layout change, and removes one on close", () => {
    const { layout, id } = addWindow(addWindow(defaultLayout(), "map").layout, "map", { x: 4, y: 40 });
    const again = parseLayout(serializeLayout(layout));
    expect(again?.copies[id]).toMatchObject({ kind: "map", open: true });
    expect(withCharts(presetLayout("signals"), layout).copies[id]).toBeDefined();
    expect(removeCopy(layout, id).copies[id]).toBeUndefined();
  });
  it("starts every layout with the timeline across the top", () => {
    for (const l of [defaultLayout(), presetLayout("map"), presetLayout("units"), presetLayout("analysis")])
      expect(l.wins.timeline).toMatchObject({ open: true, x: 0, y: 0, w: COLS, h: TIMELINE_ROWS });
  });
});

describe("a window between two windows", () => {
  const side = () => {
    let l = defaultLayout();
    l = patchWin(l, "signals", { x: 0, y: 11, w: 6, h: 30, open: true });
    return patchWin(l, "map", { x: 6, y: 11, w: 6, h: 30, open: true });
  };
  it("takes columns from both neighbours and keeps them touching it", () => {
    const l = insertBetween(side(), "assistant", "signals", "map", "x");
    expect(l).not.toBeNull();
    const { layout, id } = l as NonNullable<typeof l>;
    const n = layout.wins.assistant;
    expect(id).toBe("assistant");
    expect(layout.wins.signals.x + layout.wins.signals.w).toBe(n.x);
    expect(n.x + n.w).toBe(layout.wins.map.x);
    expect(layout.wins.map.x + layout.wins.map.w).toBe(COLS);
    expect(layout.wins.signals.w).toBeGreaterThanOrEqual(3);
  });
  it("gives up when the neighbours cannot spare the room", () => {
    let l = patchWin(side(), "signals", { w: 3 });
    l = patchWin(l, "map", { x: 3, w: 3 });
    expect(insertBetween(l, "grid", "signals", "map", "x")).toBeNull();
  });
  it("opens a window above another and pushes it down", () => {
    const l = patchWin(patchWin(defaultLayout(), "signals", { x: 0, y: 11, w: 6, h: 10, open: true }), "map", {
      x: 0,
      y: 21,
      w: 6,
      h: 10,
      open: true,
    });
    const r = insertBetween(l, "graph", "signals", "map", "y") as NonNullable<ReturnType<typeof insertBetween>>;
    const c = compactLayout(r.layout, r.id);
    expect(c.wins.graph.y).toBeLessThan(c.wins.map.y);
    expect(c.wins.map.y).toBeGreaterThanOrEqual(c.wins.graph.y + c.wins.graph.h);
  });
});

describe("nearTop", () => {
  it("takes the top-most free place that is on screen", () => {
    const l = patchWin(defaultLayout(), "map", { open: false });
    // the map's old columns are free again, under the timeline
    expect(nearTop(l, "math", 40)).toEqual({ x: 6, y: TIMELINE_ROWS });
  });
  it("goes under the timeline when nothing is free on screen, never to the bottom of a long board", () => {
    const at = nearTop(defaultLayout(), "math", 40);
    expect(at).toEqual({ x: 0, y: TIMELINE_ROWS });
    const placed = addWindow(defaultLayout(), "math", at);
    const c = compactLayout(placed.layout, placed.id);
    expect(c.wins.math.y).toBe(TIMELINE_ROWS);
  });
});

describe("the map in the default layout", () => {
  it("is tall enough to draw Finland and never below its minimum", () => {
    const m = defaultLayout().wins.map;
    expect(m.h).toBeGreaterThanOrEqual(MIN_SIZE.map.h);
    expect(m.h).toBeGreaterThanOrEqual(24);
    expect(m.w).toBeGreaterThanOrEqual(3);
  });
});
