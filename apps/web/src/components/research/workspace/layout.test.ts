import { describe, expect, it } from "vitest";
import { defaultSpec } from "../charts/spec.ts";
import {
  addChart,
  CHART_MIN_SIZE,
  COLS,
  compactLayout,
  defaultLayout,
  fitLayout,
  focusLayout,
  parseLayout,
  patchWin,
  presetLayout,
  removeChart,
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
    const l = patchWin(patchWin(defaultLayout(), "graph", { open: false }), "math", { open: true });
    expect(compactLayout(l).wins.math.y).toBe(0);
  });
  it("opens with the Signals window large and the card and the assistant in the tray", () => {
    const d = defaultLayout();
    expect(d.wins.signals.w).toBeGreaterThanOrEqual(5);
    expect(d.wins.math.open).toBe(false);
    expect(d.wins.assistant.open).toBe(false);
    expect(WIN_IDS.filter((id) => d.wins[id].open)).toEqual(["signals", "map", "graph"]);
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
    expect(f.wins.signals.h).toBe(40);
    expect(d.wins.map.open).toBe(true);
    expect(d.wins.signals.w).toBe(5);
  });
});

describe("chart windows in the layout", () => {
  const spec = defaultSpec({ unit: "ICU", window: { from: "2026-09-01", to: "2026-09-28" } });
  const saved = (extra: object) => JSON.stringify({ v: 2, ...defaultLayout(), ...extra });

  it("migrates a layout saved before charts existed to an empty charts record", () => {
    const old = { v: 2, wins: defaultLayout().wins, order: [...defaultLayout().order] };
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
    const back = parseLayout(JSON.stringify({ v: 2, ...layout }));
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
